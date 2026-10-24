/* Chapter Trail 原型 · i18n 词典
 * 结构：window.CT_I18N_EN = { 中文原文(trim后) : 英文译文 }
 * zh 态直接显示原文（词典不含中文键即原文），en 态按键替换。
 * JS 动态字符串用 ctT(原文) 取词。文件名「目录.md」为插件默认索引文件名（可配置，预设 index），保留不译。 */
(function () {
  "use strict";
  window.CT_I18N_EN = {
    /* ---------- 全局 chrome / 导航 ---------- */
    "索引": "Index",
    "01 面板": "01 Panel",
    "02 状态": "02 States",
    "03 拖拽": "03 Drag",
    "04 开始管理": "04 Start",
    "05 弹窗": "05 Dialogs",
    "06 设置": "06 Settings",
    "07 进度": "07 Progress",
    "08 成品预览": "08 Preview",
    "Chapter Trail 原型": "Chapter Trail Prototype",
    "原型导航 · 非插件 UI": "Prototype navigation · not the plugin UI",
    "浅色": "Light",
    "深色": "Dark",

    /* ---------- 页标题 / 页头 ---------- */
    "Chapter Trail · HTML UI 原型集": "Chapter Trail · HTML UI Prototype Set",
    "Chapter Trail · UI 原型草图": "Chapter Trail · UI Wireframes",
    "Chapter Trail · UI 原型草图 v0.1 · 2026-10-06 · 确认后进入高保真原型开发": "Chapter Trail · UI Wireframes v0.1 · 2026-10-06 · hi-fi prototyping starts after sign-off",
    "Chapter Trail · UI 原型草图 v0.1（待确认）": "Chapter Trail · UI Wireframes v0.1 (pending confirmation)",
    "01 · 管理面板 — Chapter Trail 原型": "01 · Management Panel — Chapter Trail Prototype",
    "01 · 管理面板（MVP 核心 UI）": "01 · Management Panel (MVP core UI)",
    "02 · 域卡片状态大全": "02 · Domain Card States",
    "02 · 域卡片状态大全 — Chapter Trail 原型": "02 · Domain Card States — Chapter Trail Prototype",
    "03 · 拖拽重排 — Chapter Trail 原型": "03 · Drag to Reorder — Chapter Trail Prototype",
    "03 · 拖拽重排交互": "03 · Drag-to-Reorder Interaction",
    "04 · 开始管理 — Chapter Trail 原型": "04 · Start Managing — Chapter Trail Prototype",
    "04 · 开始管理流程（两步弹窗）": "04 · Start Managing Flow (two-step dialogs)",
    "05 · 确认弹窗合集 — Chapter Trail 原型": "05 · Confirmation Dialogs — Chapter Trail Prototype",
    "05 · 确认弹窗合集（显式且可逆）": "05 · Confirmation Dialogs (explicit & reversible)",
    "06 · 插件设置页 — Chapter Trail 原型": "06 · Plugin Settings — Chapter Trail Prototype",
    "06 · 插件设置页（Obsidian 原生 Setting API）": "06 · Plugin Settings (Obsidian native Setting API)",
    "07 · 批量写入进度 — Chapter Trail 原型": "07 · Bulk Write Progress — Chapter Trail Prototype",
    "07 · 批量写入进度（分块 + 可取消）": "07 · Bulk Write Progress (chunked + cancellable)",
    "08 · 成品效果预览 — Chapter Trail 原型": "08 · Final Output Preview — Chapter Trail Prototype",
    "08 · 成品效果预览（写入产物长什么样）": "08 · Final Output Preview (what the plugin writes look like)",

    /* ---------- index.html ---------- */
    "文件夹级自定义排序、自动维护的索引页（MOC）、静态可发布的系列导航": "Folder-level custom ordering, auto-maintained index pages (MOC), and statically publishable series navigation",
    "的三件一体能力 ——": "— the three-in-one capability of",
    "—— 的全套高保真界面原型。依据 PRD v1.5 与方案设计文档 v1.3；管理面板为 MVP 核心 UI（React 19 实现的对应物）。界面文案支持中英文切换（右上角，默认英文），示例笔记标题随语言同步翻译。所有页面支持浅色 / 深色主题切换（右上角）。": "— the full set of hi-fi UI prototypes. Based on PRD v1.5 and the design doc v1.3; the management panel is the MVP core UI (the React 19 counterpart). UI copy supports English / Chinese switching (top right, default English); sample note titles are translated accordingly. All pages support light / dark theme switching (top right).",
    "用户画像：教程 / 连载作者，约 1000 篇笔记、git 同步、发布到 Quartz。": "User persona: tutorial / serial author, ~1000 notes, git sync, publishing to Quartz.",
    "— Series 域，5 篇 + 「进阶篇」子树；": "— Series domain, 5 notes + the \"Advanced\" subtree;",
    "— Independent 域，直系文件与受管子文件夹混排；": "— Independent domain, direct files mixed with managed subfolders;",
    "— Series 域，小型域；": "— Series domain, a small domain;",
    "· 注入开关为全局设置（默认关），本套演示统一为开启，故所有域卡片均有 Rebuild injection 按钮；": "· The injection toggle is a global setting (default off); this prototype set demos it as on, so every domain card has the Rebuild injection button;",
    "· Vault 级黄条：已解散域「旧项目/周刊」遗留 12 个 order 字段。": "· Vault-level yellow banner: the dissolved domain \"Old Projects/Weekly\" left 12 legacy order fields.",
    "设计基线": "Design Baselines",
    "融入 Obsidian": "Blends into Obsidian",
    "：仅用主题 CSS 变量（": ": theme CSS variables only (",
    "等）+": " etc.) +",
    "前缀类名，跟随用户主题与强调色；": "-prefixed class names, following the user's theme and accent color;",
    "状态三色": "Three state colors",
    "：红 = 必须处理（断链 / 冲突），黄 = 建议处理（过期 / 重排 / 平手 / 遗留），蓝 = 待排序提示；": ": red = must handle (broken link / conflict), yellow = suggested (outdated / reorder / tie / legacy), blue = pending-sort hint;",
    "显式且可逆": "Explicit & reversible",
    "：批量写入前确认并显示数量，进度可取消，全部清除走逐域确认；": ": bulk writes confirm with counts first, progress is cancellable, remove-all walks domain by domain;",
    "条目行 32px 等高": "32px equal-height rows",
    "（虚拟化前提），order 等宽字体右对齐，日期受设置约束。": "(virtualization prerequisite); order is right-aligned monospace; dates follow the settings.",
    "草图与文档": "Wireframes & Docs",
    "00 · 线框草图（已确认基线）": "00 · Wireframe sketches (confirmed baseline)",
    "演示数据设定（全套页面共用）": "Demo Data (shared across all pages)",
    "本原型为静态 HTML / CSS / JS，不依赖外部资源；样式仅作布局与状态演示，实现阶段以 Obsidian 宿主主题变量为准。": "This prototype is static HTML / CSS / JS with no external dependencies; styles only demo layout and states — implementation will use Obsidian host theme variables.",

    /* ---------- 01-panel ---------- */
    "右侧边栏 ItemView，基准宽 400px。可交互：": "Right-sidebar ItemView, base width 400px. Interactive: ",
    "条目行右键 → Move up / Move down": "row right-click → Move up / Move down",
    "（演示中点插入与过密自动重排）；": " (demos midpoint insert and tight-gap auto re-normalize);",
    "⋮ 菜单 → Stop managing": "⋮ menu → Stop managing",
    "会清除黄色「Index outdated」芯片；底部按钮跳转 04 页开始管理流程。编辑区为源码模式，展示注入标记的真实位置。": " clears the yellow \"Index outdated\" chip; the bottom button leads to page 04 (start managing). The editor pane is in source mode, showing where the injection markers really live.",
    "文件管理器": "File Explorer",
    "源码模式 · Source mode": "Source mode",
    "首先 clone 官方仓库并安装依赖……（正文内容，插件绝不触碰）": "First clone the official repo and install dependencies… (body content — the plugin never touches this)",
    "① 行高 32px 等高（虚拟化前提）；series 域条目显示紫色路径前缀，independent 域中受管子文件夹为 ☰ 文件夹行（无日期，order 取其索引页 frontmatter）。② 日期受「Date display」设置约束，此处为 created。③ 注入开关为全局设置（默认关，本套演示统一为开启），故所有域卡片均有 Rebuild injection 按钮。④ 右键条目行可上移/下移——落点间隙过密（<10）时先整域规范化再取中点落位（DESIGN §4.3 时序），可实际演示。⑤ ⋮ 菜单提供 goto-index / stop-managing（goto-prev / goto-next 跳转命令见 PRD §2.6，不占用面板空间）。": "① Rows are 32px equal height (virtualization prerequisite); series entries show a purple path prefix; managed subfolders in independent domains render as ☰ folder rows (no date; order comes from their index page frontmatter). ② Dates follow the \"Date display\" setting — created here. ③ The injection toggle is a global setting (default off; this prototype demos it as on), so every card has Rebuild injection. ④ Right-click a row to move it up/down — when the landing gap is too tight (<10), the whole domain is normalized before the midpoint is computed (DESIGN §4.3 ordering); try it live. ⑤ The ⋮ menu offers goto-index / stop-managing (goto-prev / goto-next commands are in PRD §2.6; they don't take panel space).",
    "12 legacy ": "12 legacy ",
    "fields — “旧项目/周刊” was dissolved": "fields — \"Old Projects/Weekly\" was dissolved",
    "3 domains · 1 needs attention": "3 domains · 1 needs attention",
    "5 entries · virtualized list (32px rows) · right-click a row to move": "5 entries · virtualized list (32px rows) · right-click a row to move",
    "4 entries · managed subfolder shares the ordering (no date)": "4 entries · managed subfolder shares the ordering (no date)",
    "Legacy orders — 旧项目/周刊 (dissolved)": "Legacy orders — Old Projects/Weekly (dissolved)",
    "12 files still carry order fields · <b>Clear all</b> after confirmation": "12 files still carry order fields · <b>Clear all</b> after confirmation",
    "Vault rescanned": "Vault rescanned",
    "3 managed domains · 0 orphan index pages · 210 markdown files · 0.4s": "3 managed domains · 0 orphan index pages · 210 markdown files · 0.4s",
    "Stop managing this folder?": "Stop managing this folder?",
    "Deleting <b>目录.md</b> dissolves the domain <b id=\"stop-domain\">…</b>. The ordering data lives in each note’s frontmatter and will remain unless you clear it below.": "Deleting <b>目录.md</b> dissolves the domain <b id=\"stop-domain\">…</b>. The ordering data lives in each note’s frontmatter and will remain unless you clear it below.",
    "Also clear <code>order</code> fields": "Also clear <code>order</code> fields",
    "removes the field from all notes in the domain": "removes the field from all notes in the domain",
    "Also remove injected navigation": "Also remove injected navigation",
    "strips chapter-trail markers only — your own callouts are kept": "strips chapter-trail markers only — your own callouts are kept",
    "Delete index &amp; stop": "Delete index &amp; stop",
    "Rebuild the index page for <b id=\"rebuild-domain\">…</b>?": "Rebuild the index page for <b id=\"rebuild-domain\">…</b>?",
    "Rewrites the marked block in <code>目录.md</code>. Content outside the block — including your own preamble — is untouched.": "Rewrites the marked block in <code>目录.md</code>. Content outside the block — including your own preamble — is untouched.",
    "1 file will be written": "1 file will be written",
    "Rebuilding index — {n}/{total}": "Rebuilding index — {n}/{total}",
    "writing the marked block of 目录.md …": "writing the marked block of 目录.md …",
    "✓ Index rebuilt": "✓ Index rebuilt",
    "· 1 file written · entries sorted by order": "· 1 file written · entries sorted by order",
    "Order normalized — ": "Order normalized — ",
    " notes": " notes",
    "10000-step integers · chain sequence unchanged · Git diff limited to changed values": "10000-step integers · chain sequence unchanged · Git diff limited to changed values",
    "Rebuilding injection — {n}/{total}": "Rebuilding injection — {n}/{total}",
    "nav-begin / nav-end blocks · chunk 1/1": "nav-begin / nav-end blocks · chunk 1/1",
    "✓ Injection rebuilt": "✓ Injection rebuilt",
    "5 notes · top + bottom callouts · prev/next links follow the current chain": "5 notes · top + bottom callouts · prev/next links follow the current chain",
    "Domain dissolved": "Domain dissolved",
    "目录.md deleted · remaining order fields (if any) will surface in the vault banner": "目录.md deleted · remaining order fields (if any) will surface in the vault banner",
    "Entry moved": "Entry moved",
    " · 1 file written (midpoint insert, Git diff minimal)": " · 1 file written (midpoint insert, Git diff minimal)",
    "Gap too tight — reordered the whole domain, then placed the entry": "Gap too tight — reordered the whole domain, then placed the entry",
    "orders normalized to 10000-step · chain sequence unchanged · order = ": "orders normalized to 10000-step · chain sequence unchanged · order = ",
    "Vault rescanned · ": "Vault rescanned · ",

    /* ---------- 02-states ---------- */
    "红 / 黄 / 蓝三色状态（PRD §2.7，红色合并语义）。状态芯片可叠加；蓝色仅为提示不阻塞。可交互：冲突卡片上的": "Red / yellow / blue states (PRD §2.7, red semantics merged). Status chips stack; blue never blocks. Interactive: the",
    "会打开三选一弹窗（与 05 页 M4 相同），确认后芯片消失。": " button on the conflict card opens the three-way dialog (same as M4 on page 05); the chip disappears once resolved.",
    "red — broken link / structural conflict, needs action": "red — broken link / structural conflict, needs action",
    "yellow — rebuild / reorder suggested": "yellow — rebuild / reorder suggested",
    "blue — pending sort, informational": "blue — pending sort, informational",
    "健康：无芯片、无干扰元素。⋮ 菜单提供打开索引页 / 复制路径 / 停止管理。": "Healthy: no chips, no noise. The ⋮ menu offers open index page / copy path / stop managing.",
    "2 broken links": "2 broken links",
    "file not found — deleted or moved out of the vault": "file not found — deleted or moved out of the vault",
    "红-断链：删除链条成员后 watcher 标红（A4）；重建索引后死链消失，邻居 prev/next 由「Rebuild injection」重连。": "Red, broken link: the watcher flags red after a chain member is deleted (A4); after rebuilding the index the dead links vanish, and neighbors' prev/next are reconnected by \"Rebuild injection\".",
    "<code>进阶篇/目录.md</code> has <code>is-index: true</code> inside a series domain": "<code>进阶篇/目录.md</code> has <code>is-index: true</code> inside a series domain",
    "resolve: demote to note / delete / exclude folder": "resolve: demote to note / delete / exclude folder",
    "红-结构冲突：「吃掉子树」与嵌套受管不相容（A7）；Resolve 打开三选一弹窗。": "Red, structural conflict: \"swallow the subtree\" and nested management are incompatible (A7); Resolve opens the three-way dialog.",
    "20 need ordering": "20 need ordering",
    "…18 more · git sync batch — no auto-write, drag or use first-run assignment": "…18 more · git sync batch — no auto-write, drag or use first-run assignment",
    "待排序（蓝）：git 同步批量 20 篇整批蓝标、order 列显示「—」，不自动写入（A10）；首列蓝点增强可达性（不仅靠颜色）。": "Blue, pending sort: a 20-note git-sync batch is flagged blue as a whole, the order column shows \"—\", nothing is auto-written (A10); the leading blue dots keep the state accessible without relying on color alone.",
    "3 changes since last rebuild — entries or prev/next links may be stale": "3 changes since last rebuild — entries or prev/next links may be stale",
    "黄-索引过期：删除/新增/移动/改名只标黄不重写，重建全部手动触发；设置变更也会标黄。": "Yellow, index outdated: delete/create/move/rename only flags yellow, never rewrites — rebuilding is always manual; settings changes flag yellow too.",
    "Gaps too tight": "Gaps too tight",
    "2 tied orders": "2 tied orders",
    "黄-间隙过密（相邻差 <10）叠加黄-平手（同值 ⚑，文件名自然序兜底）：主按钮高亮 Reindex 引导规范化（A6）。芯片可叠加。": "Yellow, gaps too tight (adjacent diff <10) stacked with yellow, tied orders (same value ⚑, filename natural order as tiebreaker): the primary button highlights Reindex to guide normalization (A6). Chips stack.",
    "Nested index page detected": "Nested index page detected",
    "has <code>is-index: true</code>, but its folder is inside the series domain <b>Blogs/Quartz 建站教程</b>. Choose how to resolve:": "has <code>is-index: true</code>, but its folder is inside the series domain <b>Blogs/Quartz Tutorial</b>. Choose how to resolve:",
    "Demote to a normal note": "Demote to a normal note",
    "Remove <code>is-index</code> and the marked block; the file itself is kept.": "Remove <code>is-index</code> and the marked block; the file itself is kept.",
    "Delete the file": "Delete the file",
    "Move to system trash.": "Move to system trash.",
    "Exclude the folder": "Exclude the folder",
    "Add <code>进阶篇/</code> to excluded-folders; the domain ignores it.": "Add <code>进阶篇/</code> to excluded-folders; the domain ignores it.",
    "✓ Conflict resolved": "✓ Conflict resolved",
    "demoted to a normal note — is-index and the marked block removed, file kept; its notes rejoin the series chain": "demoted to a normal note — is-index and the marked block removed, file kept; its notes rejoin the series chain",

    /* ---------- 03-drag ---------- */
    "脚本化演示两阶段：普通拖拽单文件落位（中点插入）；过密间隙自动重排后落位。含边缘自动滚动与键盘降级。": "Scripted demo of two phases: a normal drag landing a single file (midpoint insert); and a tight gap triggering auto re-normalize before landing. Includes edge auto-scroll and the keyboard fallback.",
    "场景一 · 普通拖拽 — 单文件落位": "Scene 1 · Normal drag — single-file landing",
    "场景二 · 过密间隙 — 自动重排后落位": "Scene 2 · Tight gap — auto re-normalize, then land",
    "▶ 播放：把「02 环境搭建与部署」拖到 03 与 04 之间": "▶ Play: drag \"02 Setup & Deployment\" between 03 and 04",
    "▶ 播放：把「文献笔记与永久笔记」拖进 18755/18760 的间隙": "▶ Play: drag \"Literature & Permanent Notes\" into the 18755/18760 gap",
    "落位后 order = ⌊(30000+40000)/2⌋ = 35000，仅该文件的 frontmatter 被写入。": "After landing, order = ⌊(30000+40000)/2⌋ = 35000 — only that file's frontmatter is written.",
    "目标间隙 18755→18760 仅 5（<10）→ 先整域规范化为 10000 步长（次序不变），再取中点落位；对应 PRD §2.3 与设计文档 §4.3 的「normalize 先于中点」时序。": "The target gap 18755→18760 is only 5 (<10) → the whole domain is first normalized to 10000-step (sequence unchanged), then the midpoint is computed and the entry lands; this matches the \"normalize before midpoint\" ordering in PRD §2.3 and design doc §4.3.",
    "实现要点（对应设计文档 §3.4–3.5）": "Implementation notes (design doc §3.4–3.5)",
    "· pragmatic-drag-and-drop：只有渲染出来的虚拟行才绑定监听，天然兼容虚拟化；": "· pragmatic-drag-and-drop: only rendered virtual rows get listeners — a natural fit for virtualization;",
    "· 拖拽数据载荷": "· Drag payload",
    "，卡片级 monitor 统一监听。": ", with a card-level monitor listening centrally.",
    "· @tanstack/react-virtual：等高 32px 行、overscan 8；拖拽期间列表照常滚动；": "· @tanstack/react-virtual: equal-height 32px rows, overscan 8; the list keeps scrolling during a drag;",
    "· 落点换算为目标索引，经 midpointOrder 写单文件；过密时整域 normalize；": "· The drop point maps to a target index; midpointOrder writes a single file; tight gaps normalize the whole domain;",
    "← 跟随光标的拖拽幻影（源行位置留空，两侧行让位）": "← drag ghost follows the cursor (source row left blank, neighbors make room)",
    "↓ auto-scroll（拖到列表边缘持续滚动，500 行域也能一拖到底）": "↓ auto-scroll (keep scrolling at the list edge — even a 500-row domain drags through in one go)",
    "拖拽进行中的列表": "List mid-drag",
    "列表边缘自动滚动": "List edge auto-scroll",
    "无障碍降级（行右键 / 键盘）": "Accessibility fallback (row right-click / keyboard)",
    "绕开纯拖拽的键盘不可达问题，成本极低。": "Works around drag's keyboard inaccessibility at minimal cost.",
    "先整域规范化、再按中点落位": "Normalize the whole domain first, then land by midpoint",
    "「读书笔记/卡片盒笔记法」 orders normalized to 10000-step · chain sequence unchanged": "\"Reading Notes/Zettelkasten\" orders normalized to 10000-step · chain sequence unchanged",
    "orders normalized to 10000-step · 「随笔/数字花园周记」": "orders normalized to 10000-step · \"Essays/Digital Garden Weekly\"",

    /* ---------- 04-start-managing ---------- */
    "入口：面板底部「＋ Start managing a folder」，或命令面板": "Entry: the \"＋ Start managing a folder\" button at the panel bottom, or the command palette's",
    "。第一步选文件夹（模糊搜索、已受管的禁选），第二步选模式并明示后果。全流程可点击：选文件夹 → 选模式 → 创建成功后卡片出现在面板中。": ". Step 1 picks a folder (fuzzy search; managed folders disabled), step 2 picks a mode with consequences spelled out. The whole flow is clickable: pick folder → pick mode → the new card appears in the panel.",
    "Step 1 · 选择文件夹": "Step 1 · Pick a folder",
    "Step 2 · 选择模式（二选一）": "Step 2 · Pick a mode (either/or)",
    "Next: Pick a mode": "Next: Pick a mode",
    "✓ Domain created — ": "✓ Domain created — ",
    "Creating domain — {n}/{total}": "Creating domain — {n}/{total}",
    "writing 随笔/目录.md · is-index: true · marked block": "writing Essays/目录.md · is-index: true · marked block",
    "First run: review suggested order": "First run: review suggested order",
    "目录.md written (1 file) · existing notes got 10000-step order by filename order · review the suggested order in the panel": "目录.md written (1 file) · existing notes got 10000-step order by filename order · review the suggested order in the panel",

    /* ---------- 05-dialogs ---------- */
    "所有批量写入前都有确认框并显示写入数量；破坏性操作逐步确认、逐域执行。全部走 Obsidian 原生 Modal。弹窗内的选项均可交互。": "Every bulk write confirms with a count first; destructive operations confirm step by step, domain by domain. All use Obsidian native Modals. The options inside are interactive.",
    "重建确认、开启注入确认、同名采纳三选一、嵌套冲突三选一、停止管理、全部清除三步向导（逐域确认）。": "Rebuild confirmation, injection-enable confirmation, same-name adopt (three-way), nested conflict (three-way), stop managing, and the remove-all three-step wizard (per-domain confirmation).",
    "M1 · 重建索引确认": "M1 · Rebuild index confirmation",
    "M2 · 开启导航注入确认": "M2 · Enable navigation injection confirmation",
    "M3 · 同名索引页冲突（三选一）": "M3 · Same-name index page conflict (three-way)",
    "M4 · series 嵌套冲突（三选一）": "M4 · Series nested conflict (three-way)",
    "M5 · 停止管理（域解散）": "M5 · Stop managing (domain dissolved)",
    "M6 · 全部清除（三步向导）": "M6 · Remove all (three-step wizard)",
    "Chapter Trail will write a collapsible prev / next / index callout into <b>47 notes</b> across 3 domains. Each block is wrapped in <code>&lt;!-- chapter-trail:nav-* --&gt;</code> markers and can be removed anytime.": "Chapter Trail will write a collapsible prev / next / index callout into <b>47 notes</b> across 3 domains. Each block is wrapped in <code>&lt;!-- chapter-trail:nav-* --&gt;</code> markers and can be removed anytime.",
    "目录.md already exists": "目录.md already exists",
    "The target folder already has a file named <b>目录.md</b> without a chapter-trail marker. What should happen?": "The target folder already has a file named <b>目录.md</b> without a chapter-trail marker. What should happen?",
    "Adopt it": "Adopt it",
    "Keep all existing frontmatter keys; the existing list and body stay <b>outside</b> the plugin's marked block, byte-identical. The plugin only appends its keys and the marked block.": "Keep all existing frontmatter keys; the existing list and body stay <b>outside</b> the plugin's marked block, byte-identical. The plugin only appends its keys and the marked block.",
    "Rename and keep": "Rename and keep",
    "Keep the existing file under a new name, create a fresh index page.": "Keep the existing file under a new name, create a fresh index page.",
    "Do nothing.": "Do nothing.",
    "✓ Existing 目录.md adopted": "✓ Existing 目录.md adopted",
    "✓ Renamed to 目录-旧.md, fresh index created": "✓ Renamed to 目录-旧.md, fresh index created",
    "进阶篇/目录.md moved to system trash": "进阶篇/目录.md moved to system trash",
    "进阶篇/ added to excluded-folders · domain ignores it": "进阶篇/ added to excluded-folders · domain ignores it",
    "✓ Domain dissolved": "✓ Domain dissolved",
    "① Strip injected navigation — removes everything inside <code>chapter-trail:nav-begin/end</code> markers across 3 domains. Your own callouts are never touched.": "① Strip injected navigation — removes everything inside <code>chapter-trail:nav-begin/end</code> markers across 3 domains. Your own callouts are never touched.",
    "② Delete index pages — confirmed domain by domain.": "② Delete index pages — confirmed domain by domain.",
    "③ Clear order fields — confirmed domain by domain.": "③ Clear order fields — confirmed domain by domain.",
    "will be removed, <b>including any not created by Chapter Trail</b>": "will be removed, <b>including any not created by Chapter Trail</b>",
    "Open wizard": "Open wizard",
    "打开弹窗": "Open dialog",
    "Blogs/Quartz 建站教程 · chunk 6/8 ·": "Blogs/Quartz Tutorial · chunk 6/8 ·",

    /* ---------- 06-settings ---------- */
    "共三项设置（PRD T1）；字段名": "Four settings in total (PRD T1); the field names",
    "共三项设置；字段名": "Four settings in total; the field names",
    "固定不可配。可交互：": "are fixed and not configurable. Interactive:",
    "开关——打开会弹出写入确认框（注入默认关，开关是写入路径的唯一闸门），关闭会出现清除询问；切换日期显示会提示相关域标黄。": "toggle — turning it on pops the write confirmation (injection defaults off; the toggle is the only gate of the write path), turning it off asks whether to clear; switching the date display flags affected domains yellow.",
    "Index file name": "Index file name",
    "Date display": "Date display",
    "Write prev/next navigation": "Write prev/next navigation",
    "Language": "Language",
    "UI language — English (default) / 中文": "UI language — English (default) / 中文",
    "Remove all Chapter Trail data": "Remove all Chapter Trail data",
    "Open the remove-all wizard…": "Open the remove-all wizard…",
    "affected domains marked Index outdated": "affected domains marked Index outdated",
    "Settings saved": "Settings saved",
    "Clear markers": "Clear markers",
    "Keep them": "Keep them",
    "injection is now off — existing markers kept until you clear them": "injection is now off — existing markers kept until you clear them",

    /* ---------- 07-progress ---------- */
    "批量写入按 25 篇一块执行、块间让出主线程；自绘 Notice 进度条（Obsidian 无公开进度 API）；失败文件跳过并汇总，不中断整批。": "Bulk writes run 25 notes per chunk, yielding to the main thread between chunks; progress is a hand-drawn Notice (Obsidian has no public progress API); failed files are skipped and summarized without aborting the batch.",
    "触发批量任务": "Trigger bulk tasks",
    "First-run order assignment — 读书笔记/卡片盒笔记法 · 20 notes": "First-run order assignment — Reading Notes/Zettelkasten · 20 notes",
    "任务运行中再次点击无效；多次任务依次排队。每次写入前都会登记回声抑制账本（EchoLedger），插件自身写入不触发级联处理。": "Clicking again while a task runs does nothing; multiple tasks queue up. Every write registers with the echo-suppression ledger (EchoLedger) first — the plugin's own writes never cascade.",
    "实现要点（设计文档 §5.5）": "Implementation notes (design doc §5.5)",
    "· 每块 25 篇，块间": "· 25 notes per chunk, with",
    "让出主线程；": " yielding to the main thread in between;",
    "· 进度：Notice 常驻实例 + 内嵌进度条，完成替换为结果文案；": "· Progress: a persistent Notice instance + embedded progress bar, replaced by the result text on completion;",
    "· 取消：当前块完成即停，粒度 = 单文件；": "· Cancel: stops when the current chunk finishes; granularity = one file;",
    "· 失败：单文件锁定等 → 跳过 + 汇总 Notice + 面板黄标；": "· Failure: a locked file etc. → skip + summary Notice + panel yellow flag;",
    "· 回声抑制：写入前登记内容指纹，5s TTL 内命中即弃。": "· Echo suppression: content fingerprints registered before writing; hits within the 5s TTL are dropped.",
    "事件日志（示意 ChunkedWriter 输出）": "Event log (simulating ChunkedWriter output)",
    "// idle — 从左侧触发一个批量任务": "// idle — trigger a bulk task on the left",
    "Rebuilding all indexes": "Rebuilding all indexes",
    "Rebuilding all injections": "Rebuilding all injections",
    "Assigning first-run orders": "Assigning first-run orders",
    "confirm ok · EchoLedger armed · ChunkedWriter start": "confirm ok · EchoLedger armed · ChunkedWriter start",
    "files written · skipped (locked) · ": "files written · skipped (locked) · ",

    /* ---------- 08-preview ---------- */
    "展示「静态 Markdown → Quartz 原样发布即可点击」的核心卖点：索引页在 Obsidian 阅读视图的渲染、注入导航的阅读态、以及 Quartz 发布后的效果（未知 callout 类型走默认样式，对应 T0-③ 实验）。": "Shows the core selling point — \"static Markdown → published by Quartz as-is, clickable\": the index page rendered in Obsidian's reading view, the injected navigation in reading state, and the result after Quartz publishing (unknown callout types fall back to the default style; T0-③ experiment).",
    "8a · 索引页「目录.md」阅读视图（series 模式）": "8a · Index page \"目录.md\" in reading view (series mode)",
    "8a · 索引页（series）阅读视图 — 标记区块不可见，用户序言保留": "8a · Index page (series) reading view — the marked block is invisible, the user preamble is kept",
    "这是我手写的导读，重建索引时不会动它一个字节。": "This is my hand-written preamble — rebuilding the index won't touch a single byte of it.",
    "标记区块本身不可见；区块上方用户手写的序言原样保留（产权划分）；无索引页的子文件夹 = 纯文本粗体节点、不带链接（避免 Quartz 无效跳转）；日期按设置显示，子文件夹条目无日期。": "The marked block itself is invisible; the user-written preamble above it is preserved byte-for-byte (property split); subfolders without an index page = plain bold text nodes, no links (avoids dead Quartz jumps); dates follow the settings, and subfolder entries have none.",
    "8b · 笔记阅读视图（注入开启后）": "8b · Note reading view (after injection)",
    "顶部块位于 frontmatter 之后第一行、底部块位于文末，内容相同；首篇省「上一篇」、末篇省「下一篇」、单篇仅「总览」；callout 类型": "The top block sits on the first line after the frontmatter and the bottom block at end of file, with identical content; the first entry omits \"Prev\", the last omits \"Next\", a single-entry chain keeps only \"Overview\"; the callout type",
    "为可折叠（T0 验证连字符类型，异常则回退": " is collapsible (T0 verifies the hyphenated type; falls back to",
    "8b · 笔记阅读视图 — 顶部/底部折叠导航 callout": "8b · Note reading view — top/bottom collapsible navigation callouts",
    "——Obsidian 里正常渲染，Quartz 原样发布即可点击，不依赖任何动态代码块。callout 可点击折叠展开。": " — renders normally in Obsidian, publishes through Quartz as-is and stays clickable, with no dynamic code blocks involved. Click a callout to fold/unfold it.",
    "8c · Quartz 发布效果（同一篇笔记）": "8c · Quartz published result (same note)",
    "注入的 callout 是真实 Markdown，Quartz 构建后原样发布；未知 callout 类型走默认 note 样式（对应 T0-③ 实验，必要时随插件分发 CSS snippet）。「目录」链接在 Quartz 中的 slug 行为为 T0-② 待验证项。": "The injected callout is real Markdown, published as-is by the Quartz build; unknown callout types use the default note style (T0-③ experiment; a CSS snippet ships with the plugin if needed). The slug behavior of the \"目录\" link in Quartz is a T0-② open question.",
    "我的数字花园": "My Digital Garden",
    "min read": "min read",
    "8c · Quartz 发布效果 — 导航随页面一起发布、可点击": "8c · Quartz published result — navigation ships with the page, clickable",
    "对照 · 为什么不用动态代码块方案": "Comparison · Why not dynamic code blocks",
    "✗ Folder Overview / Waypoint 形态": "✗ Folder Overview / Waypoint style",
    "✓ Chapter Trail 形态": "✓ Chapter Trail style",
    "发布到 Quartz 后：代码块没有渲染器 → 显示为死代码，目录不可用。": "After publishing to Quartz: no renderer for the code block → dead code, the index is unusable.",
    "导航与目录都是真实 Markdown 内容": "Navigation and index are real Markdown content",
    "标准 Markdown 链接 → Quartz 原样编译为可点击链接；插件删除后内容依然成立（状态即文件）。": "Standard Markdown links → Quartz compiles them into clickable links as-is; content still stands after the plugin is removed (state-as-files).",
    "索引页阅读视图、注入 callout 阅读态（可折叠）、Quartz 发布效果，以及与动态代码块方案的对照。": "Index page reading view, injected callout reading state (collapsible), the Quartz published result, and the comparison against the dynamic code-block approach.",
    "展示一篇已注入导航的笔记（与 W8 的阅读视图渲染对照）。": "Shows a note with injected navigation (compare with W8's reading-view rendering).",
    "https://notes.example.com/blogs/quartz-tutorial/02-环境搭建与部署": "https://notes.example.com/blogs/quartz-tutorial/02-setup-and-deployment",

    /* ---------- 00-sketch 专有 ---------- */
    "Chapter Trail · UI 原型草图 v0.1 · 2026-10-06 · 确认后进入高保真原型开发 ": "Chapter Trail · UI Wireframes v0.1 · 2026-10-06 · hi-fi prototyping starts after sign-off ",
    "Obsidian 插件": "Obsidian plugin",
    "灰阶线框 = 确认布局与信息架构": "Grayscale wireframes = confirm layout & information architecture",
    "风格板 = 确认视觉方向": "Style tile = confirm visual direction",
    "风格板": "Style Tile",
    "待确认清单": "Open Questions",
    "待确认清单（回复时请逐条给出结论）": "Open questions (please answer each one in your reply)",
    "设计风格板 Style Tile": "Design Style Tile",
    "设计方向：": "Design direction:",
    "面板为右侧边栏 ItemView（基准宽 380px，可拖宽），深色主题示例。左侧为 Obsidian 壳（文件树受管文件夹带紫点），中间编辑区以": "The panel is a right-sidebar ItemView (base width 380px, resizable), dark theme example. Left is the Obsidian shell (managed folders in the file tree carry a purple dot), the editor pane in the middle uses",
    "——面板视觉完全跟随用户当前主题（含第三方主题与自定义强调色），信息密度对齐 Obsidian 侧栏习惯（紧凑行、小字号、弱边框）。高保真阶段所有颜色将使用": " — the panel visuals fully follow the user's current theme (including third-party themes and custom accent colors), with information density aligned to Obsidian sidebar conventions (compact rows, small type, subtle borders). In the hi-fi stage every color will use",
    "等主题变量 +": " theme variables +",
    "前缀类名；下表数值仅为独立浏览器预览时的近似回退值。图标使用 Obsidian 内置 lucide 图标（线框中以字符占位）。": "-prefixed class names; the values below are approximate fallbacks for standalone browser preview only. Icons use Obsidian's built-in lucide set (characters stand in for them in the wireframes).",
    "主题覆盖": "Theme coverage",
    "Dark 主题（近似默认值）": "Dark theme (approximate defaults)",
    "Light 主题（近似默认值）": "Light theme (approximate defaults)",
    "面板/卡片标题": "Panel / card titles",
    "条目行文本（13px）": "Row text (13px)",
    "辅助信息（11–12px）": "Secondary info (11–12px)",
    "order 数值（等宽）": "order values (monospace)",
    "#999999 · 弱化（order 值等）": "#999999 · muted (order values etc.)",
    "#5c5c5c · 次要文字": "#5c5c5c · secondary text",
    "边框/分隔线": "Borders / dividers",
    "#f6f6f6 · 侧栏底": "#f6f6f6 · sidebar background",
    "#ffffff · 编辑区/卡片底": "#ffffff · editor / card background",
    "强调紫（跟随用户主题色）": "Accent purple (follows the user's theme color)",
    "组件（Dark 底示例）": "Components (dark background example)",
    "交互程度": "Interactivity",
    "纯静态展示 / 可点击演示（弹窗开合、开关下拉可操作、拖拽用动画演示）/ 全交互（真实指针拖拽排序，JS 模拟）。草图建议「可点击演示」。": "Static only / clickable demo (dialogs open/close, toggles work, drags animated) / fully interactive (real pointer-drag reordering, JS-simulated). The wireframe suggests \"clickable demo\".",
    "「Obsidian 阅读视图渲染 + Quartz 发布效果」这组屏是否纳入原型范围？": "Should the \"Obsidian reading-view rendering + Quartz published result\" screens be in prototype scope?",
    "高保真原型：亮/暗双主题都出（顶部切换，验证双主题无违和），还是只出其一？草图建议双主题。": "Hi-fi prototypes: both light/dark themes (top-right switch, verifying neither looks off) or just one? The wireframe suggests both.",
    "① 面板头部加「全量重扫 ⟳」按钮；② 条目行内显示 created 日期（可由设置关闭）。PRD 未明确要求，是否接受？": "① Add a \"full re-scan ⟳\" button to the panel header; ② show the created date inside rows (can be turned off in settings). Not explicitly required by the PRD — accepted?",
    "以上线框与风格板是否可以作为高保真原型开发的基线？需要调整的点请直接指出（可只改局部）。": "Can these wireframes and the style tile serve as the baseline for hi-fi prototyping? Point out anything to adjust (partial changes are fine).",
    "此组屏为提案，需确认是否纳入": "This screen group is a proposal — confirm whether to include it",
    "两个提案细节": "Two proposed details",
    "W1 · 管理面板总览（MVP 核心 UI）": "W1 · Management Panel Overview (MVP core UI)",
    "W2 · 域卡片状态大全（红 / 黄 / 蓝）": "W2 · Domain Card States (red / yellow / blue)",
    "W3 · 拖拽重排交互": "W3 · Drag-to-Reorder Interaction",
    "W4 · 开始管理流程（两步弹窗）": "W4 · Start Managing Flow (two-step dialogs)",
    "W5 · 确认弹窗合集（显式且可逆）": "W5 · Confirmation Dialogs (explicit & reversible)",
    "W6 · 插件设置页（Obsidian 原生 Setting API）": "W6 · Plugin Settings (Obsidian native Setting API)",
    "W7 · 批量写入进度（分块 + 可取消）": "W7 · Bulk Write Progress (chunked + cancellable)",
    "W8 · 成品效果预览": "W8 · Final Output Preview",
    "W1 面板总览": "W1 Panel overview",
    "W2 状态大全": "W2 States",
    "W3 拖拽交互": "W3 Drag",
    "W4 开始管理": "W4 Start managing",
    "W5 弹窗合集": "W5 Dialogs",
    "W6 设置页": "W6 Settings",
    "W7 写入进度": "W7 Write progress",
    "W8 成品预览": "W8 Output preview",
    "Obsidian 壳 + 右侧边栏面板：VaultSummary、遗留 order 黄条、Series / Independent 域卡片。可右键移动条目、重建索引、停止管理。": "Obsidian shell + right-sidebar panel: VaultSummary, the legacy-order yellow banner, and Series / Independent domain cards. Rows can be right-click-moved; index can be rebuilt; managing can be stopped.",
    "浅色主题。六种卡片形态：健康、红-断链、红-结构冲突、蓝-待排序、黄-索引过期、黄-间隙过密 + 平手。状态芯片可叠加，图例置顶。": "Light theme. Six card states: healthy, red broken-link, red structural conflict, blue pending-sort, yellow index-outdated, yellow gaps-too-tight + ties. Chips stack; legend on top.",
    "两步弹窗：选文件夹 → 选模式。第一步选文件夹（模糊搜索、已受管的禁选），第二步选模式并明示后果（将创建带": "Two-step dialog: pick folder → pick mode. Step 1 picks a folder (fuzzy search; managed folders disabled), step 2 picks a mode with consequences spelled out (it will create",
    "与标记区块的索引页）。": "with the marked block).",
    "重建确认、开启注入确认、同名采纳三选一、嵌套冲突三选一、停止管理、全部清除三步向导（逐域确认）。": "Rebuild confirmation, injection-enable confirmation, same-name adopt (three-way), nested conflict (three-way), stop managing, remove-all three-step wizard (per-domain confirmation).",
    "25 篇/块、块间让出主线程、可取消、失败跳过汇总；右下角 Notice 即真实呈现位置，附事件日志。": "25 notes per chunk, yielding between chunks, cancellable, failures skipped and summarized; the bottom-right Notice is exactly where it would really appear, with an event log.",
    "25 篇/块": "25 notes/chunk",
    "索引页阅读视图、注入导航的阅读态、Quartz 发布效果——「状态即文件」的最终呈现。": "Index page reading view, injected navigation in reading state, Quartz published result — the final form of \"state as files\".",
    "M1 重建索引（单域/全部同理，计数=写入文件数）": "M1 rebuild index (same for single/all; count = files written)",
    "M2 开启注入（设置开关触发，注入默认关）": "M2 enable injection (triggered from the settings toggle; injection defaults off)",
    "M3 同名冲突三选一（A11：用户键逐字节保留）": "M3 same-name conflict, three-way (A11: user keys preserved byte-for-byte)",
    "M4 series 嵌套冲突三选一（A7）": "M4 series nested conflict, three-way (A7)",
    "M5 停止管理（删除索引页 = 域解散 + 遗留 order 提示）": "M5 stop managing (deleting the index page = domain dissolved + legacy order notice)",
    "M6 全部清除三步向导（可逆性契约 A8：每域逐个确认）": "M6 remove-all three-step wizard (reversibility contract A8: confirmed per domain)",
    "面板挂在右侧边栏（ItemView）；⟳ 为全量重扫（启动扫描的补扫入口），⚙ 跳转插件设置。此为提案，PRD 未明确要求。": "The panel lives in the right sidebar (ItemView); ⟳ is a full re-scan (a supplemental entry point to the startup scan), ⚙ opens plugin settings. This is a proposal — not explicitly required by the PRD.",
    "VaultSummary：受管域数量 + 异常计数 + 红黄蓝图例（PRD §2.7「面板顶部汇总」）。": "VaultSummary: managed-domain count + issue count + red/yellow/blue legend (PRD §2.7 \"panel-top summary\").",
    "Vault 级黄条：遗留 order 提示（删除索引页 = 域解散后），一键 Review 进入清理（PRD §2.5）。": "Vault-level yellow banner: legacy order notice (after deleting an index page = domain dissolved); one-click Review starts cleanup (PRD §2.5).",
    "卡片头：域路径 + 模式徽标（Series/Independent）+ ⋮ 菜单（Open index page / Stop managing…）。": "Card header: domain path + mode badge (Series/Independent) + ⋮ menu (Open index page / Stop managing…).",
    "操作按钮：重建索引 / 重排 order / 重建注入——注入开关为全局设置（默认关），本套草图统一演示开启状态，故每张卡片均有第三个按钮。": "Action buttons: rebuild index / reindex order / rebuild injection — the injection toggle is a global setting (default off); these wireframes demo the on state, so every card has the third button.",
    "条目行 32px 等高：悬停出现拖拽把手 ⠿；标题左侧数字为链条序号；": "Rows are 32px equal height: the drag grip ⠿ appears on hover; the number left of the title is the chain position;",
    "series 域显示路径前缀": "series entries show the path prefix",
    "（紫色）；日期取 created（设置项）；order 右对齐等宽。": "(purple); dates use created (a setting); order is right-aligned monospace.",
    "independent 域中受管子文件夹显示为文件夹行（☰ 前缀、无日期，order 取其索引页 frontmatter）——对应 PRD「直系文件与受管子文件夹混排」。": "Managed subfolders in independent domains render as folder rows (☰ prefix, no date; order comes from their index page frontmatter) — matching the PRD's \"direct files mixed with managed subfolders\".",
    "编辑区（源码模式）：注入的包裹标记位于 frontmatter 之后第一行与文末，callout 内容为标准 md 链接；order 字段在 properties 中。注入默认关闭，此为开启后的效果。": "Editor pane (source mode): the injected wrapped markers sit on the first line after the frontmatter and at end of file; the callout content is standard md links; the order field lives in properties. Injection defaults off — this shows the on state.",
    "健康卡片：无芯片。⋮ 菜单含打开索引页 / 停止管理。": "Healthy card: no chips. The ⋮ menu has open index page / stop managing.",
    "断链：条目渲染为红色删除线 + 「not found」说明行；重建索引后死链消失（A4）。": "Broken link: the entry renders with a red strikethrough + a \"not found\" explanation row; dead links vanish after rebuilding the index (A4).",
    "series 嵌套索引冲突：Resolve… 打开三选一弹窗（见 W5-M4，A7）。": "Series nested index conflict: Resolve… opens the three-way dialog (see W5-M4, A7).",
    "蓝-待排序：批量新增（≥5，防抖窗口）整批蓝标、不逐个写入（A10）；蓝点列保证不依赖颜色也能识别。": "Blue, pending sort: bulk additions (≥5 within the debounce window) are flagged blue as a whole, never written one by one (A10); the blue-dot column keeps it identifiable without color alone.",
    "间隙过密（相邻差 <10）+ 平手（同 order 值 ⚑ 标注）：主按钮高亮 Reindex 引导重排（A6）。": "Gaps too tight (adjacent diff <10) + ties (same order value, ⚑ marked): the primary button highlights Reindex to guide normalization (A6).",
    "选文件夹 → 选模式（Independent / Series）两步弹窗，明示「将创建目录.md」后果；成功后卡片入列。": "Pick folder → pick mode (Independent / Series) two-step dialog, spelling out the \"目录.md will be created\" consequence; the card joins the panel on success.",
    "重建确认、开启注入确认、同名采纳三选一、嵌套冲突三选一、停止管理、全部清除三步向导。": "Rebuild confirmation, injection-enable confirmation, same-name adopt (three-way), nested conflict (three-way), stop managing, remove-all three-step wizard.",
    "批量写入按": "Bulk writes run in",
    "执行、块间让出主线程（UI 不冻结）；进度为自绘 Notice（Obsidian 无公开进度 API），": "chunks, yielding between them (UI never freezes); progress is a hand-drawn Notice (Obsidian has no public progress API),",
    "——取消在当前块完成后停止，已写入的文件保留内容（写入粒度是单文件，无半篇状态）；单文件失败跳过并汇总，不中断整批。右下角 Notice 即真实插件中的呈现位置。": " — cancel stops after the current chunk finishes; written files keep their content (write granularity is one file — no half-written state); single-file failures are skipped and summarized without aborting the batch. The bottom-right Notice is exactly where the real plugin would show it.",
    "目标文件夹已有同名文件：采纳（保留用户键）/ 重命名保留 / 取消（A11）。": "The target folder already has a same-name file: adopt (user keys kept) / rename and keep / cancel (A11).",
    "可逆性契约：① 剥注入包裹 → ② 删索引页（逐域确认）→ ③ 清 order（逐域确认，明示连带范围）（A8）。": "Reversibility contract: ① strip injection wrappers → ② delete index pages (per-domain confirmation) → ③ clear order (per-domain confirmation, scope spelled out) (A8).",
    "整体确认": "Confirm all",
    "打开向导": "Open wizard",
    "索引文件名、日期显示方式、「写入上下篇导航」开关（默认关，开关即注入唯一闸门，开关联动确认框）。": "Index file name, date display, and the \"write prev/next navigation\" toggle (default off; the toggle is the only gate of the write path, wired to its confirmation dialog).",
    "共三项设置；字段名": "Three settings in total; the field names",
    "固定不可配。": "are fixed and not configurable.",
    "展示「静态 Markdown → Quartz 原样发布即可点击」的核心卖点：索引页在 Obsidian 阅读视图的渲染、注入导航的阅读态、以及 Quartz 发布后的效果。": "Shows the core selling point — \"static Markdown → published by Quartz as-is, clickable\": the index page rendered in Obsidian's reading view, the injected navigation in reading state, and the Quartz published result.",
    "这是我手写的导读，重建索引不会动它。": "This is my hand-written preamble — rebuilding the index won't touch it.",
    "目录（受管域树入口）": "目录 (managed-domain tree entry)",
    "目标插入位置": "Target insertion point",
    "过密间隙拖入 → 自动重排提示（Notice）": "Dragging into a tight gap → auto re-normalize notice (Notice)",
    "拖放产生「目标插入位置」→ 取前后 order 的整数中点（日常只写 1 个文件，Git diff 最小化）；落入过密间隙（<10）时": "A drop produces a \"target insertion point\" → the integer midpoint of the neighbors' orders (daily operation writes just 1 file, minimal Git diff); when landing in a tight gap (<10),",
    "并提示。实现基于 pragmatic-drag-and-drop（逐元素绑定，兼容虚拟列表），v1 仅鼠标，键盘经右键菜单降级。下方为脚本化演示，点按钮播放。": "first, then land, with a notice. Built on pragmatic-drag-and-drop (per-element binding, virtualization-friendly); v1 is mouse-only, keyboard falls back to the right-click menu. Scripted demos below — press a button to play.",
    "面板内拖拽 = 修改目标位置的前后 order 中点（日常只写 1 个文件）；落入过密间隙（<10）时自动重排整域再落位并提示。基于 pragmatic-drag-and-drop（逐元素绑定，兼容虚拟化列表），v1 仅鼠标。": "In-panel drag = set the entry's order to the midpoint of its new neighbors (daily operation writes just 1 file); landing in a tight gap (<10) auto-normalizes the whole domain before landing, with a notice. Built on pragmatic-drag-and-drop (per-element binding, virtualization-friendly); v1 is mouse-only.",
    "虚拟化列表：只有渲染出来的行参与拖拽监听；拖拽期间列表照常滚动。": "Virtualized list: only rendered rows take drag listeners; the list keeps scrolling mid-drag.",
    "↓ 拖到边缘持续滚动，500 行域也能一拖到底": "↓ keep scrolling at the edge — even a 500-row domain drags through in one go",
    "入口：面板底部「＋ Start managing a folder」或命令面板「Start managing current folder」。第一步选文件夹（模糊搜索），第二步选模式并明示后果（将创建带": "Entry: the \"＋ Start managing a folder\" button at the panel bottom, or the \"Start managing current folder\" command. Step 1 picks a folder (fuzzy search), step 2 picks a mode with consequences spelled out (it will create",
    "阅读方式：": "How to read this:",
    "附录 · 待确认": "Appendix · Open questions",
    "其他说明": "Other notes",
    "确认后进入高保真原型开发": "hi-fi prototyping starts after sign-off",

    /* ---------- JS 动态字符串（ctT 用） ---------- */
    "如何写一篇短文": "How to Write a Short Piece",
    "数字花园的缓慢生长": "The Slow Growth of a Digital Garden",
    "周更的节奏": "The Rhythm of Weekly Updates",
    "项目的三条兴奋线": "The Three Excitement Lines of a Project",
    "从卡片盒到 Zettelkasten": "From Card Box to Zettelkasten",
    "Blogs/Quartz 建站教程": "Blogs/Quartz Tutorial",
    "读书笔记/卡片盒笔记法": "Reading Notes/Zettelkasten",
    "随笔/数字花园周记": "Essays/Digital Garden Weekly",
    "Quartz 建站教程": "Quartz Tutorial",
    "读书笔记": "Reading Notes",
    "卡片盒笔记法": "Zettelkasten",
    "随笔": "Essays",
    "数字花园周记": "Digital Garden Weekly",
    "旧项目/周刊": "Old Projects/Weekly",
    "项目/旧周刊": "Projects/Old Weekly",
    "为什么选择 Quartz": "Why Quartz",
    "环境搭建与部署": "Setup & Deployment",
    "配置详解": "Configuration Guide",
    "插件机制": "Plugin Internals",
    "主题定制": "Theme Customization",
    "进阶篇": "Advanced",
    "进阶篇/": "Advanced/",
    "进阶篇/配置详解": "Advanced/Configuration Guide",
    "进阶篇/插件机制": "Advanced/Plugin Internals",
    "进阶篇/主题定制": "Advanced/Theme Customization",
    "01 为什么选择 Quartz": "01 Why Quartz",
    "01 为什么选择 Quartz.md": "01 Why Quartz.md",
    "02 环境搭建与部署": "02 Setup & Deployment",
    "02 环境搭建与部署.md": "02 Setup & Deployment.md",
    "03 配置详解": "03 Configuration Guide",
    "04 插件机制": "04 Plugin Internals",
    "05 主题定制": "05 Theme Customization",
    "2025-11-09 · 进阶篇/ 前缀 · 虚拟化提示": "2025-11-09 · Advanced/ prefix · virtualization hint",
    "- [01 为什么选择 Quartz](./01 为什么选择 Quartz.md)": "- [01 Why Quartz](./01 Why Quartz.md)",
    "- [02 环境搭建与部署](./02 环境搭建与部署.md)": "- [02 Setup & Deployment](./02 Setup & Deployment.md)",
    "[01 为什么选择 Quartz](./01 为什么选择 Quartz.md)": "[01 Why Quartz](./01 Why Quartz.md)",
    "[03 配置详解](./进阶篇/03 配置详解.md)": "[03 Configuration Guide](./Advanced/03 Configuration Guide.md)",
    "title: 02 环境搭建与部署": "title: 02 Setup & Deployment",
    "## 环境搭建": "## Setup & Deployment",
    "✓ Chapter Trail 形态 ": "✓ Chapter Trail style ",
    "✗ Folder Overview / Waypoint 形态 ": "✗ Folder Overview / Waypoint style ",
    "── ": "── ",
    /* ---------- v1.5 补充（覆盖率检查后补齐） ---------- */
    "域卡片状态大全": "Domain Card States",
    "开始管理流程": "Start Managing Flow",
    "成品效果预览": "Final Output Preview",
    "批量写入进度": "Bulk Write Progress",
    "拖拽重排交互": "Drag-to-Reorder Interaction",
    "插件设置页": "Plugin Settings",
    "方案设计文档 v1.2": "Design doc v1.2",
    "确认弹窗合集": "Confirmation Dialogs",
    "管理面板总览": "Management Panel Overview",
    "红（断链 / 结构冲突）、黄（索引过期 / 间隙过密 / 平手）、蓝（待排序）六种卡片形态与图例。": "Six card states with legend: red (broken link / structural conflict), yellow (index outdated / gaps too tight / ties), blue (pending sort).",
    "附": "Appendix",
    "> [!chapter-trail]- 上一篇：": "> [!chapter-trail]- Prev: ",
    "> [!chapter-trail]- 上一篇：… | 总览：… | 下一篇：…（底部块，与顶部相同）": "> [!chapter-trail]- Prev: … | Overview: … | Next: … (bottom block, same as top)",
    "> [!chapter-trail]- 上一篇：… | 总览：… | 下一篇：…": "> [!chapter-trail]- Prev: … | Overview: … | Next: …",
    "Chapter Trail · Blogs/Quartz 建站教程": "Chapter Trail · Blogs/Quartz Tutorial",
    "Choose a mode for “读书笔记/卡片盒笔记法”": "Choose a mode for “Reading Notes/Zettelkasten”",
    "v0.1 · 待确认": "v0.1 · pending confirmation",
    "| 下一篇：": "| Next: ",
    "| 总览：": "| Overview: ",
    "|  下一篇：": "| Next: ",
    "|  总览：": "| Overview: ",
    "|  下一篇：": "| Next: ",
    "|  总览：": "| Overview: ",
    "— 上一篇：": "— Prev: ",
    "上一篇：": "Prev: ",
    "下一篇：": "Next: ",
    "总览：": "Overview: ",
    "⠿ 02 环境搭建与部署": "⠿ 02 Setup & Deployment",
    "。线框中界面文案用英文（PRD 约束 v1 仅英文 UI），示例笔记内容用中文（贴近真实 vault）。颜色为近似占位值，高保真阶段将直接引用 Obsidian 主题变量。": ". Wireframe UI copy is English (the v1 constraint at wireframe time), sample notes use Chinese (close to a real vault). Colors are approximate placeholders; the hi-fi stage references Obsidian theme variables directly.",
    "上一篇：01 为什么选择 Quartz | 总览：目录 | 下一篇：03 配置详解": "Prev: 01 Why Quartz | Overview: 目录 | Next: 03 Configuration Guide",
    "从卡片盒到 Zettelkasten.md": "From Card Box to Zettelkasten.md",
    "依据：PRD v1.5（2026-10-24 基线）+ 方案设计文档 v1.3 · 生成日期 2026-10-06 · 插件 ID": "Based on: PRD v1.5 (2026-10-24 baseline) + design doc v1.3 · generated 2026-10-06 · plugin ID",
    "卡片的三种类型": "Three Types of Cards",
    "周记 #37": "Weekly #37",
    "周记 #38": "Weekly #38",
    "周记 #39": "Weekly #39",
    "周记 #39 ⚑": "Weekly #39 ⚑",
    "周记 #40 ⚑": "Weekly #40 ⚑",
    "引言：卢曼的盒子": "Introduction: Luhmann's Boxes",
    "文献笔记与永久笔记": "Literature & Permanent Notes",
    "第一部分 · 原理": "Part 1 · Principles",
    "项目的三条兴奋线.md": "The Three Excitement Lines of a Project.md",
    "日记": "Diary",
    "模板": "Templates",
    "源码模式": "Source mode",
    "图例 Legend": "Legend",
    "文件管理器（示意）": "File Explorer (illustrative)",
    "此为提案，PRD 未明确要求。": "This is a proposal — not explicitly required by the PRD.",
    "所有批量写入前都有确认框并显示写入数量；破坏性操作（停止管理 / 全部清除）逐步确认。全部走 Obsidian 原生 Modal。": "Every bulk write confirms with a count first; destructive operations (stop managing / remove all) confirm step by step. All use Obsidian native Modals.",
    "条目行固定 32px（虚拟化前提）· 组件间距 4/8/12 · 圆角 6/8/12": "Rows fixed at 32px (virtualization prerequisite) · spacing 4/8/12 · radius 6/8/12",
    "状态色语义（PRD §2.7 已确认，红色合并语义）：红 = 断链 / 结构冲突（必须处理）；黄 = 索引过期 / order 平手 / 间隙过密 / 遗留 order（建议处理）；蓝 = 待排序（仅提示）。取 Obsidian 内置调色板 red": "State color semantics (PRD §2.7 confirmed; red merged): red = broken link / structural conflict (must handle); yellow = index outdated / order ties / tight gaps / legacy order (suggested); blue = pending sort (hint only). Uses the Obsidian built-in palette red",
    "融入 Obsidian 原生": "Blends into native Obsidian",
    "行高与间距": "Row height & spacing",
    "面板挂在右侧边栏（ItemView）；⟳ 为全量重扫（启动扫描的补扫入口），⚙ 跳转插件设置。": "The panel lives in the right sidebar (ItemView); ⟳ is a full re-scan (supplemental to the startup scan), ⚙ opens plugin settings.",
    "首先 clone 官方仓库并安装依赖，随后执行构建命令……": "First clone the official repo and install dependencies, then run the build command…",
    "首先 clone 官方仓库并安装依赖，随后执行构建命令……（正文）": "First clone the official repo and install dependencies, then run the build command… (body)",
    "首先 clone 官方仓库并安装依赖，随后执行构建命令。本章假设你已经装好 Node 22 与 pnpm……": "First clone the official repo and install dependencies, then run the build command. This chapter assumes Node 22 and pnpm are installed…",
    "部署到 Vercel 只需三步……": "Deploying to Vercel takes three steps…",
    "部署到 Vercel 只需三步：导入仓库、设置构建命令、绑定域名。": "Deploying to Vercel takes three steps: import the repo, set the build command, bind the domain.",
    "部署到 Vercel 只需三步：导入仓库、设置构建命令、绑定域名……": "Deploying to Vercel takes three steps: import the repo, set the build command, bind the domain…",
    "🔒  https://notes.example.com/blogs/quartz-tutorial/02-环境搭建与部署": "🔒  https://notes.example.com/blogs/quartz-tutorial/02-setup-and-deployment",
    "🔒  https://notes.example.com/blogs/quartz-tutorial/02-环境搭建与部署": "🔒  https://notes.example.com/blogs/quartz-tutorial/02-setup-and-deployment",
    "绕开纯拖拽的键盘不可达问题；01 页的条目行支持真实右键操作。": "Works around drag's keyboard inaccessibility; rows on page 01 support real right-click actions.",
    "默认": "Default",
    "删除索引页 = 域解散；可选同时清除 order / 注入标记。": "Deleting the index page dissolves the domain; optionally clear order / injection markers at the same time.",
    "注入默认关；开启 = 向 N 篇笔记写入包裹标记，分块执行可取消。": "Injection defaults off; enabling = writing wrapped markers into N notes, chunked and cancellable.",
    "确认框显示写入文件数；区块外内容不动。触发：面板按钮 / 命令。": "The confirmation shows the file count; content outside the block is untouched. Triggered from: panel buttons / commands.",
    "降级为普通笔记 / 删除 / 加入 excluded-folders（A7）。": "Demote to a normal note / delete / add to excluded-folders (A7).",
    "共四项设置；字段名": "Four settings in total; the field names",
    "写入上下篇导航": "Write prev/next navigation",
    "开关——打开会弹出写入确认框（注入默认关，开关是写入路径的唯一闸门），关闭会出现清除询问；切换日期显示会提示相关域标黄；切换语言（Language）即时生效并持久化，默认英文。": "toggle — turning it on pops the write confirmation (injection defaults off; the toggle is the only gate of the write path), turning it off asks whether to clear; switching the date display flags affected domains yellow; switching the language takes effect immediately, persists, and defaults to English.",
    "可取消": "cancellable",
    "核心卖点：": "Core selling point: ",
    "间隙过密（相邻差 <10）+ 平手（同 order 值 ⚑ 标注）：主按钮高亮 Reindex 引导规范化（A6）。": "Gaps too tight (adjacent diff <10) + ties (same order value, ⚑ marked): the primary button highlights Reindex to guide normalization (A6).",
  };

  /* ---------- 语言状态与运行时 ---------- */
  var stored = null;
  try { stored = localStorage.getItem("ct-lang"); } catch (e) {}
  window.CT_LANG = (stored === "zh") ? "zh" : "en"; // 默认英文

  window.ctT = function (zh) {
    if (window.CT_LANG !== "en") return zh;
    var en = window.CT_I18N_EN[zh];
    return en !== undefined ? en : zh;
  };

  var CJK = /[\u4e00-\u9fff\u00b7\u3000-\u303f\uff00-\uffef]/;
  var ctTextStore = new Map(); // TextNode → 原文

  function translateTextNode(node) {
    var v = node.nodeValue;
    if (!v || ctTextStore.has(node) || !/[\u4e00-\u9fff]/.test(v)) return;
    var trimmed = v.trim();
    var en = window.CT_I18N_EN[trimmed];
    if (en === undefined) return;
    var i = v.indexOf(trimmed);
    ctTextStore.set(node, v);
    node.nodeValue = v.slice(0, i) + en + v.slice(i + trimmed.length);
  }

  window.ctApplyLang = function () {
    var en = window.CT_LANG === "en";
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        return p && !(p.nodeName === "SCRIPT" || p.nodeName === "STYLE") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    if (en) {
      nodes.forEach(translateTextNode);
    } else {
      nodes.forEach(function (n) {
        if (ctTextStore.has(n)) n.nodeValue = ctTextStore.get(n);
      });
      ctTextStore.clear();
    }
    /* <title> 单独处理 */
    if (document.__ctTitleOrig === undefined) document.__ctTitleOrig = document.title;
    if (en) {
      var t = document.__ctTitleOrig.trim();
      var te = window.CT_I18N_EN[t];
      if (te !== undefined) document.title = te;
    } else {
      document.title = document.__ctTitleOrig;
    }
    updateLangButtons();

  };

  function updateLangButtons() {
    document.querySelectorAll("[data-ct-lang-btn]").forEach(function (b) {
      b.dataset.active = b.dataset.ctLangBtn === window.CT_LANG ? "true" : "false";
    });
  }

  function injectToggle() {
    var seg = document.createElement("span");
    seg.className = "ct-theme-seg";
    seg.style.marginLeft = "8px";
    seg.innerHTML = '<button data-ct-lang-btn="en">EN</button><button data-ct-lang-btn="zh">中文</button>';
    var chrome = document.querySelector(".ct-chrome");
    if (chrome) {
      var themeSeg = chrome.querySelector(".ct-theme-seg");
      themeSeg ? chrome.insertBefore(seg, themeSeg) : chrome.appendChild(seg);
    } else {
      seg.style.position = "fixed";
      seg.style.top = "14px";
      seg.style.right = "16px";
      seg.style.zIndex = "999";
      document.body.appendChild(seg);
    }
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-ct-lang-btn]");
    if (!btn) return;
    window.CT_LANG = btn.dataset.ctLangBtn;
    try { localStorage.setItem("ct-lang", window.CT_LANG); } catch (err) {}
    window.ctApplyLang();
  });

  injectToggle();
  window.ctApplyLang();
})();
