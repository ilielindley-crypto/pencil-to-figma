# 自动启动 Figwright 并导入

Figwright 通过本机 Figma 插件写入。桌面操作只用于打开目标文件和启动插件，之后用 Figwright 工具导入与读回。Figma 编辑权限和正常登录仍是前提。

## 定位和启动

1. 查找 Figwright 的 `ping`、`list_files`、`use_file`、`import_svg` 和页面或节点读取工具。先查看已有会话。根据请求中的 Figma file key，通过桌面编辑器的文档 URL 核对文件身份和页面。Figwright 的公共开发插件可能只返回文件名，遇到同名不能凭名称下结论。
2. 已核对的目标会话可直接复用。未连接时优先用 agent-desktop 打开或恢复 Figma 桌面版并定位目标文件，核对正常 Design 编辑状态及目标页。Windows 上，窗口最小化时先恢复；使用快捷键前确认目标窗口获得焦点。Chromium 辅助功能树的 document 节点可能标为 readonly，即使画布可编辑。根据实际画布、编辑工具和权限提示判断。
3. 在目标文件中打开快速操作（Windows Ctrl+K），搜索 Figwright，进入 Plugins & widgets 结果并运行准确的 Figwright Development 条目。也可以从 Figma 主菜单 Plugins → Development → Figwright 启动。使用新快照里的控件，按实际语言和界面定位。搜索欄的语义写入有时延迟，先重新读回搜索文字，再决定是否补输。不要选择名称无关的社区插件。
4. 启动后轮询 `list_files`，确认插件连接、文件名和当前页。若出现清单选择器，用已知来源的本机 Figwright manifest.json 在正常文件对话框完成一次性注册，再运行插件。Windows 上若清单对话框无法聚焦，先恢复其 Figma 主窗口。版本不匹配时依据版本警告和官方发布说明更新已登记目录，再重启并核对连接。避免盲目重复启动或打开其他文件。
5. 使用核对过的 sessionId 调用 `use_file`，绑定文件会话后再进行任何写操作。核对目标 page ID；当前页与目标不同则定位后复核。若连接失败、会话不明确或文件只读，保留 SVG 并准确报告，或者在已核实目标可编辑时走编辑器导入。

连接可用时可以让 Figwright 面板使用 Run in background，隐藏面板并保留会话。后台运行指插件面板，Figma 桌面窗口最小化时连接探测可能仍通过，但切页或读取可能超时。发生此情况先恢复目标窗口，再用 `get_metadata` 核对实际响应和页 ID。

## 脚本追加导入和验证

- 用此 skill 的 [import_figwright.mjs](../scripts/import_figwright.mjs)，需要 Node.js，以及本机已安装且与插件版本相匹配的 Figwright MCP 程序。根据本机 Figwright 配置解析已安装程序的 JavaScript 入口，通常是 `@figwright/mcp` 的 `dist/index.mjs`。传入该绝对路径、已核对的会话 ID、文件名、当前 page ID 和每个 SVG 的绝对路径。脚本通过独立 stdio 会话连接本地桥，可直接读取大 SVG 文件。使用 `--probe` 只检查连接、文件和页面。

  ~~~text
  node <skill目录>/scripts/import_figwright.mjs --server <本机入口> --session <会话ID> --file "文件名" --page 0:1 <画板1.svg> <画板2.svg>
  ~~~

- 脚本以目标页面为父级，按当前视口中心和输入顺序追加画板。核对新画板只按脚本返回的 ID 读回。现有版面与本次追加无关。
- 若 Codex 内置的 Figwright 工具会话已断开，先在桌面核对目标文件身份，再运行脚本的 `--probe`。可省略 `--session`，脚本只接受唯一同名的已连接会话，并拒绝页面不符的会话。遇到同名文件时先定位明确的 session ID。
- 记录每个返回的 node ID。读回页面或节点，核对画板名称、尺寸、位置与矢量层。检查长页及有复杂蒙版、阴影的代表稿件。发生超时先按节点或名称查已写入内容，只补缺少的画板。报告实际导入数量并链接到已验证的节点。
- 大型页面先用 `get_metadata`、已知图层 ID 或限定名称、类型和根节点的查询定位。避免 `get_document` 或全页多类型扫描。若工具返回 Transport closed，重新连接 Figwright，或从本机已安装且版本相匹配的 Figwright MCP 程序启动新的 stdio 会话。重新绑定正确文件并回查目标节点后再决定是否续写。

[Figwright 项目文档](https://github.com/awdr74100/figwright)
