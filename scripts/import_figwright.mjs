import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      server: { type: 'string' },
      session: { type: 'string' },
      file: { type: 'string' },
      page: { type: 'string' },
      probe: { type: 'boolean' },
    },
  });
  const { server, session, file, page, probe } = values;
  if (!server || !file || !page || (!probe && !positionals.length)) {
    throw Error('Usage: node import_figwright.mjs --server ENTRY [--session ID] --file NAME --page ID [--probe | SVG ...]');
  }
  const normalizedPage = page.replace('-', ':');
  const assets = [];
  for (const path of positionals) {
    const svg = await readFile(path, 'utf8');
    if (!/^(?:\s|<\?xml[^?]*\?>)*<svg[\s>]/i.test(svg)) {
      throw Error('Expected an SVG file: ' + path);
    }
    const name = basename(path).replace(/\.svg$/i, '');
    if (assets.some(asset => asset.name === name)) throw Error('Duplicate artboard name in batch: ' + name);
    assets.push({ name, svg });
  }

  const child = spawn(process.execPath, [server], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  child.stderr.resume();
  const reader = createInterface({ input: child.stdout });
  const pending = new Map();
  let sequence = 0;
  let closed = false;
  function disconnect(error) {
    closed = true;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  }
  child.on('error', disconnect);
  child.on('exit', () => disconnect(Error('Figwright transport closed')));
  child.stdin.on('error', disconnect);
  reader.on('line', (line) => {
    let reply;
    try { reply = JSON.parse(line); } catch { return; }
    pending.get(reply.id)?.receive(reply);
  });
  function call(method, params) {
    if (closed) throw Error('Figwright transport closed');
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error(method + ' timed out'));
      }, 45000);
      pending.set(id, {
        reject(error) { clearTimeout(timer); reject(error); },
        receive(reply) {
          clearTimeout(timer);
          pending.delete(id);
          if (reply.error) reject(Error(reply.error.message));
          else resolve(reply.result);
        },
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  async function tool(name, args) {
    const result = await call('tools/call', { name, arguments: args });
    const blocks = result.content.filter(block => block.type === 'text');
    if (result.isError || blocks.some(block => /PLUGIN OUT OF DATE/.test(block.text))) {
      throw Error(blocks.map(block => block.text).join('\n'));
    }
    return JSON.parse(blocks[0].text);
  }
  try {
    await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'pencil-to-figma', version: '1.0.0' } });
    child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    let sessionId = session;
    if (!sessionId) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { files } = await tool('list_files', {});
        const matching = files.filter(candidate => candidate.fileName === file && !candidate.error);
        if (matching.length > 1) throw Error('Ambiguous file name. Supply the verified session ID.');
        if (matching.length === 1) {
          sessionId = matching[0].sessionId;
          break;
        }
        if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    if (!sessionId) throw Error('No connected session for the requested file.');
    const bound = await tool('use_file', { sessionId });
    if (bound.bound?.sessionId !== sessionId || bound.bound?.fileName !== file) {
      throw Error('Connected session did not match the requested file.');
    }
    const target = await tool('get_metadata', {});
    if (target.fileName !== file || target.currentPage?.id !== normalizedPage || target.editorType !== 'figma') {
      throw Error('Target file or active page mismatch. Open the requested Design page first.');
    }
    console.log(JSON.stringify({ status: 'ready', file, page: normalizedPage }));
    if (probe) return;
    const { center } = await tool('get_viewport', {});
    let x = Math.round(center.x);
    const y = Math.round(center.y);
    for (const { name, svg } of assets) {
      let nodeId;
      try {
        const result = await tool('import_svg', { parentId: normalizedPage, name, svg, x, y });
        if (!result.ok || !result.nodeId) throw Error('Missing import acknowledgement');
        nodeId = result.nodeId;
        console.log(JSON.stringify({ status: 'created', name, nodeId }));
        const { node } = await tool('get_node', { nodeId });
        if (!node || node.id !== nodeId || node.name !== name || !(node.width > 0 && node.height > 0)) {
          throw Error('New artboard readback did not match');
        }
        console.log(JSON.stringify({ status: 'verified', name, nodeId, width: node.width, height: node.height }));
        x += Math.ceil(node.width) + 48;
      } catch (error) {
        console.error(JSON.stringify({ status: 'check_before_retry', name, nodeId, error: error.message }));
        process.exitCode = 1;
        return;
      }
    }
  } finally {
    reader.close();
    child.stdin.end();
    child.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
