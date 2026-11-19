---
name: pencil-to-figma
description: 用 Pencil 制作或更新 UI 设计稿，自动导出 SVG，并用本地 Figwright 脚本追加到指定 Figma Design 页面。用于 Pencil 转 Figma、已有 .pen 导入 Figma、Figma MCP 限额下的设计交付或自动导出 SVG。保留可编辑的 .pen 源稿。
---

# Pencil 到 Figma

默认交付可编辑的 .pen 源稿与每画板一份 SVG。任务包含导入且已有明确的 Figma 文件时，完成并验证画布导入再交付。导出和编辑器导入无需 Figma MCP。SVG 中的文字使用轮廓路径，保留中文外观。组件关系、变量、自动布局和文字编辑能力留在 .pen 源稿里。

## 制作画板

- 已提供 .pen 时优先使用原稿及用户指定的画板，纯导出任务直接进入下一节。根据用户的原型、更新记录和参考图确定当前样式及正文状态。
- 查找 Pencil 工具，读取其应用状态和当前版本的 execute/schema 说明后制作可编辑画板。创建新稿时通过 Pencil 打开目标 .pen，再通过应用状态核对活动文件。部分版本的 execute 会作用于活动画布，即使提供了 filePath。操作前确认是正确文档。
- 保留可编辑层级，完成后保存到用户指定路径或 outputs。检查画板实际存在于磁盘文件，核对遗漏、字体、遮挡及溢出。如果源稿引用本地相对路径的图片，随稿保留这些资源与目录结构。刚打开新稿后如果截图仅有底色，先确认画布已完成布局并缩放到可见范围，再重试。

## 自动导出

1. 从 Pencil 读取所需画板的 ID、名称、尺寸。组件主节点、注释和其他画板按本次交付范围选择。使用独立的临时目录，以免 Pencil 的固定文件名覆盖其他 PDF。
2. 如当前 Pencil 工具支持原生 SVG，优先使用并核对文字、图标及尺寸。否则调用 Pencil execute 的 PDF 导出，保留其矢量绘制结果。最稳妥的命名方式是每个画板一个独立目录，可在同一 execute 中调用多次。已确认 PDF 页序时也可一次批量导出。

   ~~~js
   Export(["画板ID"], "pdf", "D:/项目/work/pencil-export/01", {scale: 1})
   ~~~

3. 用此 skill 目录下的 [pdf_to_svg.py](scripts/pdf_to_svg.py) 逐页转为独立 SVG。需要能 import pymupdf 的 Python。优先使用已有安装或隔离环境，如缺失可在项目的临时环境安装 PyMuPDF。PDF 来自 Pencil 的 PDF 导出，保留矢量元素。对于多页 PDF，按实际页序依次重复传入 --name。

   ~~~text
   python <skill目录>/scripts/pdf_to_svg.py <临时目录>/export.pdf --output-dir <输出目录>/Figma-SVG --name "03 纪要 · 多人会议"
   ~~~

4. 核对文件数、页序、SVG 画板尺寸及转换脚本的图形统计。在浏览器或 SVG 查看器渲染成品，对照 Pencil 截图。检查中文、图标、图片、阴影和裁切。样稿意外全空时回到 Pencil 重新导出。用绝对路径链接 .pen 和 SVG，画板较多时可打包 SVG。

## 自动导入 Figma

- 当用户要求直接导入时，目标优先用本轮指定的链接或已明确的项目默认目的地。同一项目后续修改可沿用已明确的目的地。文件或页面无法确定时先完成本地制稿与导出，再索要缺少的定位信息。
- 默认执行 [本地 Figwright 脚本追加导入](references/figwright-import.md)。复用可用会话，连接中断时由 Codex 恢复窗口或启动插件。用户明确要求通过编辑器粘贴时，使用 [SVG 追加粘贴](references/figma-editor-import.md)。
- 只核对目标文件和页面，并按返回的 ID 验证本次新增画板。源页面内容、旧图层和样式都不参与导入。以视口中心布局新增画板，多个画板按输入顺序横向排列。
- 导入成功后返回目标文件或新画板链接及画板数。遇到只读、需登录或导入失败时，交付已检查的本地文件，并说明受阻位置与已经成功导入的部分。
- 用户要求 Figma 原生文字、组件、自动布局、原型连线或 .fig 时，使用有权限的原生 Figma 工作流。SVG 可作为视觉稿交付。
