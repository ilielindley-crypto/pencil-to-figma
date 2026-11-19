# Pencil to Figma

一个 Codex Skill，用 Pencil（pen.dev）制作或修改设计稿，逐画板导出 SVG，再通过本机 Figwright 追加到指定的 Figma Design 页面。

## 安装

~~~sh
git clone https://github.com/ilielindley-crypto/pencil-to-figma.git
~~~

把克隆后的 `pencil-to-figma` 文件夹放入 Codex 的用户级 skills 目录。Windows 通常是 `%USERPROFILE%\.codex\skills`，macOS 和 Linux 通常是 `~/.codex/skills/`。如果配置了 `CODEX_HOME`，使用该目录下的 `skills`。目录结构应为 `skills/pencil-to-figma/SKILL.md`。

在 Codex 中输入：

> 使用 $pencil-to-figma，根据附件用 Pencil 出稿，并追加到我提供的 Figma 页面。保留 .pen 源稿和每个画板的 SVG。

如果当前对话未发现新 Skill，重新打开 Codex 或开始一个新对话再调用。

## 依赖

| 用途 | 环境 |
| --- | --- |
| 制稿、读取画板和导出 | [pen.dev](https://www.pen.dev/downloads) 桌面版及可用的 Pencil MCP |
| 将 Pencil PDF 转成 SVG | Python 和 PyMuPDF，仅在 Pencil 无法直接导出 SVG 时需要 |
| 从本地追加到 Figma | Node.js、[Figwright](https://github.com/awdr74100/figwright) 本地服务及对应版本的 Figma 开发插件 |
| 写入目标页 | Figma Design 的编辑权限 |

安装 Skill 不会自动安装上述依赖。Figwright 的首次安装和连接按其上游文档操作。已注册插件可由 Codex 启动，或复用现有会话。Figma 桌面窗口最小化时，可能需要恢复窗口才能完成导入。

## 交付结果

- 每个画板对应一个 SVG，同时保留可编辑的 `.pen` 源稿。
- 导入只定位目标页面并核对本次新建的画板。已有设计内容不参与转换。
- PDF 转 SVG 路径会将文字转为轮廓。原有文本、组件绑定和自动布局可在 Pencil 源稿中继续编辑。

入口和完整步骤见 [SKILL.md](SKILL.md)。

## 许可

本仓库的 Skill 指令与脚本采用 [MIT](LICENSE) 许可。Pencil、Figma、Figwright 和 PyMuPDF 是独立依赖，各自遵循原有许可。本项目与这些工具的维护方无隶属关系。
