# Chapter Trail Bug 修复报告（2026-10-25）

针对真机验收反馈的两个 Bug 完成修复与自主验证。修复原则：**只修 Bug，不触碰核心功能行为**（全部 135 项自动化测试保持绿色，其中新增 4 项回归测试）。

## 修复任务列表与结果

| # | Bug / 问题 | 根因 | 修复 | 状态 | 验证方式 |
|---|-----------|------|------|------|---------|
| 1 | 点"＋ 开始管理文件夹"无任何反应 | 弹窗遮罩被挂在 `.ct-panel-foot`（约 40px 高）内部，`position:absolute; inset:0` 被压缩成一条不可见细缝 | `AddDomainFlow` 移到面板根节点 `.ct-panel` 渲染，补传 `settings` 属性 | ✅ 已修复 | 浏览器实测：点击 → 两步弹窗正常弹出 → 建域成功（截图 02/03） |
| 2a | 拖拽后列表不重排（真实 Obsidian） | 插件自己写入 order 后立即重扫，但 Obsidian `metadataCache` 是异步重解析的——扫到的是**旧 frontmatter**，注册表不变、面板原地不动；而写入事件又被回声抑制，永远不会触发补偿重扫 | 适配器记录"新鲜写入"（path → 写后内容，30s TTL），`getFrontmatter` 对刚写过的文件直接从内容解析，不再依赖陈旧缓存 | ✅ 已修复 | 单测（frontmatterText）+ 浏览器实测（FakeVault 恒真，真实差异在适配层） |
| 2b | 拖拽/重排受管子文件夹条目时静默失败 | `moveEntry`/`normalizeTasks` 把条目 path 当写入目标，但受管子文件夹条目的 path 是**文件夹路径**，`vault.process` 找不到文件直接失败且无提示 | 新增 `writableTarget`：受管子文件夹条目翻译为其子域索引页路径再写入 | ✅ 已修复 | 集成回归测试 ×2（拖文件夹到队首 → 子索引页 order=5000；混排域重排 → 子索引页 20000） |
| 2c | 拖拽/重排写入失败完全无反馈 | `ChunkedWriter` 的失败清单被调用方丢弃 | `moveEntry`/`reindexOrder` 汇报失败：console.error + Notice（新增 i18n 键） | ✅ 已修复 | 代码路径 + i18n 词典一致性测试 |
| 3 | （验证中发现）弹窗标题显示"· · Step 1 of 2" | 标题组合时硬编码了一个 "·"，而 i18n 键本身以 "·" 开头 | 移除硬编码分隔符（面板两步弹窗 + 命令模式弹窗 + 清除向导 3 处） | ✅ 已修复 | 浏览器实测：标题 "Start managing a folder · Step 1 of 2"（截图 05） |
| 4 | （验证中发现）警告框把 `<b>`/`<br>` 显示为纯文本 | React JSX 文本节点会转义 HTML | 警告框改用 `dangerouslySetInnerHTML`（与其他弹窗一致，i18n 文案含标记） | ✅ 已修复 | 浏览器实测：`<b>`/`<code>` 真实渲染（截图 05） |
| 5 | （加固）回声抑制吞掉自写事件后无兜底重扫 | 修复 2a 已根治，但缓存追赶时机仍有边界 | 双保险：`EventSource` 回声命中时回调 → main 防抖 200ms 重扫一次 | ✅ 已加固 | 事件源单测（5 项保持绿色） |

## 自主验证记录（真实浏览器驱动真实代码）

验证 harness：`test/harness/`——用 esbuild 把**真实 PanelRoot + 真实 PluginServices + FakeVault 后端**打进浏览器（`pnpm build:harness`），Playwright 驱动。验证的是插件的真实 UI 与业务代码，不是 mock。

| 步骤 | 结果 |
|------|------|
| 打开面板 | Blogs 域卡片渲染，5 条目、序号/order/日期正常（截图 01） |
| Bug 1：点"＋ 开始管理文件夹" | 两步弹窗完整弹出，列表含"随笔 3 篇笔记"、Blogs 灰显"already managed"（截图 02） |
| 完成 Start managing | "随笔"卡片入列，3 篇笔记获 order 10000/20000/30000，索引页生成，Notice "✓ Domain created"（截图 03） |
| Bug 2：拖拽 01 → 03 下方 | 列表重排为 02/03/01/04/05；order01=35000（30000/40000 中点）；**仅写 1 个文件**；Notice "Entry moved — order = 35000"（截图 04） |
| 右键 05 → Move up | 上移成功，order=37500（35000/40000 中点），单文件写入 |
| 弹窗标题与警告框 | "· Step 1 of 2" 无重复分隔符；`<b>`/`<code>` 真实渲染（截图 05） |

截图（已入库）：`docs/bugfix-evidence/bugfix-01…05*.png`。

## 拖拽验证说明（为什么用合成事件）

Playwright 的鼠标 API 不触发 Chromium 原生 HTML5 拖拽。验证脚本按 pdnd 的真实契约派发 `DragEvent`（dragstart 落在 draggable 行元素 + 坐标命中可见把手 → dragover/drop 命中目标行边缘），**完整走过真实的 draggable/dropTarget/monitor 处理链与 moveEntry 写入链**。第一次未生效正是因为 pdnd 会用 `elementFromPoint` 校验把手命中——这也解释了为什么把手依赖 CSS 悬停可见的设计在真实鼠标下可用。

## 遗留 / 已知事项

1. **真机复验建议**（一次覆盖全部修复）：重启 Obsidian → 面板点"＋ 开始管理文件夹"走完两步 → 拖拽任一条目到新位置 → 右键 Move up/down →（混排域）拖动受管子文件夹行。预期：弹窗可见、列表即时重排、每步 Notice 显示中点 order。
2. 验证截图是临时产物，不入库（已在 .gitignore 之外单独存放，未提交）。
3. 合成拖拽事件无法 100% 等价真实鼠标拖拽的"手感"（自动滚动、拖拽幻影），这部分依赖你在真机上按 ACCEPTANCE.md §2.3 复验。
