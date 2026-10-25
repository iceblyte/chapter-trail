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


---

# 第二轮修复（2026-10-25）：真机验收反馈 6 项

| # | 反馈问题 | 根因 | 修复 | 状态 | 验证 |
|---|---------|------|------|------|------|
| 1 | 索引链接 `(./文字教程/2 - MBTI….md)` 点击不跳转 | 链接带 `./` 前缀且空格未编码，Quartz/Obsidian 均解析失败 | 新增 `encodeLinkPath`：空格、括号、#、%、& 等不安全字符按字节百分号编码（CJK 保留），索引页与导航链接统一改为无 `./` 前缀的裸相对路径（如 `文字教程/2%20-%20MBTI%20性格测试小程序.md`） | ✅ | 28 项编码单测 + 浏览器实测索引输出（截图 bugfix2-evidence-final） |
| 2 | 弹窗点击后不自动关闭，须点 × | `SpecModal.finish()` 只 resolve 了 Promise，从未调用 `this.close()` | finish() 统一 close()；Escape/取消/确认三条路径都走它 | ✅ | 浏览器实测：Rebuild index 确认后弹窗自动消失 |
| 3 | 中文界面残留英文（"1 file will be written"、"Cancel" 等） | 早期两个 i18n 补丁以 tab 缩进锚点写入 zh.ts，被 Biome 空格格式化后静默失效，共 10 个键从未落库；且无机制防再犯 | 补齐全部缺失键；新增 **i18n 源码覆盖率测试**（扫描 src/ 全部 t("…") 调用，缺键即红）+ `scripts/check-i18n-coverage.cjs` | ✅ | 覆盖率测试进 gate（125 调用键 = 205 词典键全覆盖） |
| 4 | Series 域内的子文件夹还能单独开始管理 | `startManaging` 无嵌套守卫（PRD：series 一次声明吃掉整个子树） | 三层拦截：services 守卫（Notice 说明原因）+ 文件夹选择器灰显"inside a series domain" | ✅ | 集成测试 ×2 + 浏览器实测（Blogs/进阶篇 灰显） |
| 5 | 排序操作应在 Obsidian 自带文件列表中 | 面板内拖拽只改 order；Obsidian 无文件树拖拽排序 API | 新增 `ExplorerSorter`：受管文件夹的**原生文件列表按链条顺序显示**（flex order 镜像，display-only，不改文件、不碰非受管区）；排序操作本身仍在面板中（拖拽/右键），文件树实时跟随 | ✅（display-only 方案） | jsdom 结构测试 ×2；这是 Obsidian API 的边界：文件树内直接拖拽排序需改 Obsidian 源码，社区插件（如 Custom File Explorer sorting）同用此法 |
| 6 | 笔记中无"上一篇/下一篇/总览" | 注入默认关（PRD 硬性不变量），且此前弹窗 Bug 2 阻断了开启流程 | 弹窗修复后链路打通：设置开启 → 确认 → 全部链条笔记写入顶部+底部 callout；链接同步新格式 | ✅ | 浏览器端到端：写入 5 篇，顶部/底部块齐全，链接编码正确 |

## 测试规模

第二轮后：**14 个测试文件、168 项测试全绿**（新增链接编码 28 项、series 守卫 2 项、ExplorerSorter 2 项、i18n 覆盖率 1 项；更新受链接格式影响的 13 项断言与 2 个黄金文件）。

## 对反馈 5 的方案说明（需要你知晓）

Obsidian 官方 API 不提供文件树拖拽排序。已实现的是社区通用方案：**插件面板里拖拽/右键排序（写入 order）→ 原生文件列表实时按链条顺序显示**。你在文件树里看到的就是排序结果，但拖拽动作本身要在面板里做。如果你期望"直接在文件树里拖"，那需要评估魔改 Obsidian 文件树的方案（复杂度高、升级易碎），建议先试用当前方案再决定。


---

# 第三轮修复（2026-10-25）：第二轮验收反馈

| # | 验收结果 | 处理 | 验证 |
|---|---------|------|------|
| 1 | 索引页链接可点 ✓ | 无需处理 | — |
| 2 | 弹窗自动消失 ✓ | 无需处理 | — |
| 3 | 取消按钮仍显示 "Cancel" | SpecModal 的兜底取消文案是硬编码英文；ObsidianConfirmPort 现注入语言感知 provider（main 传 i18n.t("Cancel")），显式 cancelLabel 仍优先 | 新增 jsdom 单测 ×3（provider 生效 / 显式覆盖 / 确认后关闭），obsidian 运行时替身 + vitest alias |
| 4 | series 内子文件夹不应出现在管理面板 | "开始管理"选择器现在**彻底过滤** series 域内的文件夹（此前是灰显），services 守卫保留为双保险 | 浏览器实测：选择器只剩 随笔 / Blogs（灰），Blogs/进阶篇 不再出现（截图 bugfix3-picker-filtered.png） |
| 5a | 面板拖拽可同步到文件列表 ✓ | 无需处理 | — |
| 5b | 文件夹一直排在最后 | series 模式的子文件夹是路径标签而非链条成员，ExplorerSorter 没给它们 rank → 全部落到 AFTER_CHAIN 沉底。现在 series 子文件夹按**其第一个文件的链序**插入（进阶篇 落在 03 与 04 之间） | 新增 jsdom 单测：[文件夹, 01, 04] → order [2, 1, 4] |
| 6 | 未开启注入时看不到导航 | 与 PRD"注入关=零写入"硬约束冲突 → **用户拍板：动态渲染**。新增 DynamicNav（display-only）：阅读视图实时渲染顶部/底部上下篇导航（可点击跳转），**不写任何文件**；注入开关语义不变（开启 = 额外静态写入供 Quartz 发布） | 单测 ×5（模型纯函数 + DOM 构建 + 点击回调）；i18n 覆盖率测试当场抓到 3 个缺失新键并补齐 |

## 动态渲染说明（第 6 项方案）

- **注入关（默认）**：阅读视图顶部/底部显示导航——纯 DOM 装饰，git diff 永远为零，硬性不变量不破坏。
- **注入开**：动态显示照旧，同时写入真实 callout（Quartz 发布用），双形态共存。
- 作用域：Obsidian 阅读视图（Reading mode）；Live Preview 编辑态不装饰（编辑器内不宜插入假元素）。点击链接走 openFile，与跳转命令同路径。

测试规模：16 文件 / **175 项测试全绿**（本轮 +7）。
