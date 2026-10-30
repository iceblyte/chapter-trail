/**
 * Chinese dictionary — canonical key list (English UI copy from the
 * confirmed prototype). Every key must render in both languages.
 */
import type { Dict } from "./index";

export const zh: Dict = {
  /* ---------- plugin settings page ---------- */
  "Folder ordering, index pages and series navigation · v1.0.0 · MIT · no telemetry":
    "文件夹排序、索引页与系列导航 · v1.0.0 · MIT · 无遥测",
  "Index file name": "索引文件名",
  "Used when creating new index pages. Recognition is by the <code>is-index</code> marker, not the file name — existing pages are never renamed. Preset suggestion: <code>index</code>. Changing this marks affected domains “Index outdated”.":
    "创建新索引页时使用。识别依据是 <code>is-index</code> 标记而非文件名 — 已有索引页永不被重命名。预设建议：<code>index</code>。修改后相关域将标黄“索引过期”。",
  "Show created date on index pages": "索引页显示创建时间",
  "Default on. Index entries show each note’s created property (name configurable below). Tip: the community plugin <b>Update modified date</b> can keep these properties current automatically — no manual maintenance needed.":
    "默认开启。索引条目显示笔记的 created 属性（属性名在下方配置）。建议：社区插件 <b>Update modified date</b> 可自动维护这些属性，无需手动维护。",
  "Show updated date on index pages": "索引页显示更新时间",
  "Default off. Turn on to also show the updated property; with both on, entries render as “created → updated”.":
    "默认关闭。开启后同时显示 updated 属性；两者都开启时显示为“创建 → 更新”。",
  "Modified date property": "更新时间属性名",
  "The name of the YAML/frontmatter property to read as the updated date — same default as the “Update modified date” plugin.":
    "读取为更新时间（updated）的 frontmatter 属性名 — 与“Update modified date”插件的默认值一致。",
  "Created date property (optional)": "创建时间属性名（可选）",
  "Optional. The property read as the created date; leave empty to hide created dates everywhere.":
    "可选。读取为创建时间（created）的属性名；留空则所有位置不显示创建时间。",
  "Date format": "日期格式",
  "Momentjs-style tokens: <code>YYYY</code> <code>YY</code> <code>MM</code> <code>DD</code> <code>HH</code> <code>mm</code> <code>ss</code>. Values without a time part never show one. Blank = <code>YYYY-MM-DD HH:mm</code>.":
    "momentjs 风格令牌：<code>YYYY</code> <code>YY</code> <code>MM</code> <code>DD</code> <code>HH</code> <code>mm</code> <code>ss</code>。没有时间部分的值不会补出时间。留空 = <code>YYYY-MM-DD HH:mm</code>。",
  "Delete the index page when a domain dissolves": "域解散时删除索引页",
  "Default on: dissolving a domain moves {indexFile}.md to the system trash. Turn off to keep the page as a normal note — the plugin markers and the is-index/mode keys are removed and the rendered list stays as static text.":
    "默认开启：解散域时将 {indexFile}.md 移入系统回收站。关闭后保留该页并转为普通笔记 — 移除插件标记与 is-index/mode 键，已生成的索引列表作为静态文本保留。",
  "Support the author": "支持作者",
  "If Chapter Trail is useful to you, a sponsorship on 爱发电 (afdian) keeps development going. Thank you!":
    "如果 Chapter Trail 对你有帮助，欢迎在爱发电（afdian）上支持开发，谢谢！",
  "❤ Sponsor on afdian": "❤ 爱发电",
  "Write prev / next navigation": "写入上下篇导航",
  "<b>Off: nothing is ever written into your notes</b> — the jump commands (previous / next / open index) still work. Turning on asks for confirmation, then writes collapsible callouts wrapped in removable markers.":
    "<b>关闭：绝不向笔记写入任何内容</b> — 跳转命令（上一篇 / 下一篇 / 打开索引）仍然可用。开启时会先请求确认，再写入由可移除标记包裹的可折叠 callout。",
  Language: "语言",
  "UI language for the panel, commands and dialogs. Defaults to <b>English</b>; switching re-labels the panel, commands and dialogs immediately. All plugin copy goes through an i18n dictionary.":
    "面板、命令与弹窗的界面语言。默认<b>英文</b>；切换后面板、命令与弹窗文案即时更换。全部插件文案均通过 i18n 词典管理。",
  "Remove all Chapter Trail data": "清除全部 Chapter Trail 数据",
  "Full exit path: strip injected navigation → delete index pages (per-domain confirm) → clear order fields (per-domain confirm). Everything outside the confirmed scope is untouched.":
    "完整退出路径：剥离注入导航 → 删除索引页（逐域确认）→ 清除 order 字段（逐域确认）。确认范围之外的任何内容都不受影响。",
  "Open wizard…": "打开向导…",
  English: "English",
  中文: "中文",

  /* settings behaviors */
  "Index file name updated": "索引文件名已更新",
  "New pages will use “{indexFile}” · affected domains marked “Index outdated” · nothing renamed":
    "新索引页将使用“{indexFile}” · 相关域已标黄“索引过期” · 不重命名任何文件",
  "{n} domains marked “Index outdated” — rebuild their index pages to apply":
    "{n} 个域已标黄“索引过期” — 重建索引页后生效",
  "Remove all injected markers from {n} notes?": "从 {n} 篇笔记中移除全部已注入标记？",
  "Clear markers": "清除标记",
  "Keep them": "保留",
  "Kept existing markers": "已保留现有标记",
  "They remain removable later via the Remove-all wizard": "之后仍可通过“全部清除”向导移除",
  "All injected markers removed": "全部已注入标记已移除",
  "Zero residue in notes · user-written callouts preserved": "笔记零残留 · 用户手写 callout 保留",
  "Stripping markers — {n}/{total}": "正在剥离标记 — {n}/{total}",
  "nav-begin / nav-end blocks only · your own callouts untouched":
    "仅 nav-begin / nav-end 区块 · 你自己写的 callout 不受影响",

  /* ---------- commands ---------- */
  "Start managing current folder": "开始管理当前文件夹",
  "Stop managing current folder": "停止管理当前文件夹",
  "Rebuild index for current domain": "重建当前域索引",
  "Rebuild all indexes": "重建全部索引",
  "Reindex order in current domain": "重排当前域 order",
  "Rebuild injection in current domain": "重建当前域注入",
  "Remove all Chapter Trail data…": "清除全部 Chapter Trail 数据…",
  "Go to previous note": "跳转到上一篇",
  "上一篇：": "上一篇：",
  "File name": "文件名",
  Created: "创建时间",
  Updated: "更新时间",
  Order: "排序",
  Collapse: "折叠",
  "Expand all": "全部展开",
  "Collapse all": "全部折叠",
  Expand: "展开",
  "Nothing to move — the drop position is unchanged": "没有需要移动的内容 — 放置位置未发生变化",
  "Folder moved — {n} notes reordered as one block": "文件夹已移动 — {n} 篇笔记作为一个整体重排",
  "Click to start managing this folder": "点击开始管理该文件夹",
  "下一篇：": "下一篇：",
  "总览：": "总览：",
  "Go to next note": "跳转到下一篇",
  "Open the index page of the current domain": "打开当前域索引页",

  /* ---------- panel ---------- */
  "Chapter Trail": "Chapter Trail",
  "Re-scan vault": "重扫 vault",
  Settings: "设置",
  "{n} domain": "{n} 个域",
  "{n} domains": "{n} 个域",
  "{m} needs attention": "{m} 个需关注",
  "{m} need attention": "{m} 个需关注",
  red: "红",
  yellow: "黄",
  blue: "蓝",
  "Show only domains needing attention": "只显示需关注的域",
  "Show only independent domains": "只显示独立的域",
  "Show only series domains": "只显示系列的域",
  "No domains match the current filters": "没有符合当前筛选条件的域",
  "Red: broken links or structural conflicts": "红：断链或结构冲突",
  "Yellow: index outdated, gaps too tight, tied orders or first-run review":
    "黄：索引过期、间隙过密、order 平手或首次声明待检查",
  "Blue: entries waiting for ordering": "蓝：有待排序的条目",
  "{n} legacy <code>order</code> fields — “{domain}” was dissolved":
    "{n} 个遗留 <code>order</code> 字段 — “{domain}”已解散",
  Review: "去处理",
  Series: "系列",
  Independent: "独立",
  "Rebuild index": "重建索引",
  "Reindex order": "重排 order",
  "Rebuild injection": "重建注入",
  "Open index page": "打开索引页",
  "Copy domain path": "复制域路径",
  "Stop managing…": "停止管理…",
  "＋ Start managing a folder": "＋ 开始管理文件夹",
  "{n} entries": "{n} 条",
  "virtualized list (32px rows)": "虚拟化列表（32px 行）",
  "Move up": "上移",
  "Move down": "下移",
  "Domain path copied": "域路径已复制",

  /* panel notices */
  "Vault rescanned": "vault 已重扫",
  "{n} managed domains · {n2} orphan index pages · {n3} markdown files · {s}s":
    "{n} 个受管域 · {n2} 个孤儿索引页 · {n3} 个 markdown 文件 · {s}s",
  "Legacy orders — {domain} (dissolved)": "遗留 order — {domain}（已解散）",
  "{n} files still carry order fields · <b>Clear all</b> after confirmation":
    "{n} 个文件仍带有 order 字段 · 确认后<b>全部清除</b>",
  "Entry moved": "条目已移动",
  "order = {order} · 1 file written (midpoint insert, Git diff minimal)":
    "order = {order} · 已写入 1 个文件（中点插入，Git diff 最小）",
  "Gap too tight — reordered the whole domain, then placed the entry":
    "间隙过密 — 已整域重排，再落位该条目",
  "orders normalized to 10000-step · chain sequence unchanged · order = {order}":
    "已规范化为 10000 步长 · 链条次序不变 · order = {order}",
  "Order normalized — {n} notes": "order 已规范化 — {n} 篇笔记",
  "10000-step integers · chain sequence unchanged · Git diff limited to changed values":
    "10000 步长整数 · 链条次序不变 · Git diff 仅限实际变化的值",

  /* status chips / rows */
  "{n} broken links": "{n} 处断链",
  "Nested index conflict": "嵌套索引冲突",
  "{n} need ordering": "{n} 篇待排序",
  "Index outdated": "索引过期",
  "Gaps too tight": "间隙过密",
  "{n} tied orders": "{n} 个平手 order",
  "First run: review suggested order": "首次声明：请检查建议顺序",
  "file not found — deleted or moved out of the vault": "找不到文件 — 已删除或已移出 vault",
  "…{n} more · git sync batch — no auto-write, drag or use first-run assignment":
    "…还有 {n} 篇 · git 同步批量 — 不自动写入，请拖拽排序或使用首次声明赋值",
  "{n} changes since last rebuild — entries or prev/next links may be stale":
    "上次重建后有 {n} 处变更 — 条目或前后篇链接可能已过期",
  "<code>{path}</code> has <code>is-index: true</code> inside a series domain":
    "<code>{path}</code> 含有 <code>is-index: true</code>，位于 series 域内",
  "resolve: demote to note / delete / exclude folder": "处置：降级为笔记 / 删除 / 排除文件夹",

  /* ---------- start-managing flow (04) ---------- */
  "Start managing a folder": "开始管理文件夹",
  "· Step 1 of 2": "· 第 1 步 / 共 2 步",
  "· Step 2 of 2": "· 第 2 步 / 共 2 步",
  "Filter folders…": "筛选文件夹…",
  "{n} notes · {n2} subfolder · no index page yet": "{n} 篇笔记 · {n2} 个子文件夹 · 尚无索引页",
  "{n} notes this month": "本月 {n} 篇",
  "{n} notes · carries legacy order fields": "{n} 篇笔记 · 含遗留 order 字段",
  "already managed": "已受管",
  Cancel: "取消",
  Next: "下一步",
  Back: "上一步",
  "Choose a mode": "选择模式",
  "· Step 2 of 3": "· 第 2 步 / 共 3 步",
  "Mode for <b>{folder}</b> — one managed domain, one chain style:":
    "为 <b>{folder}</b> 创建一个受管域，链条风格二选一：",
  "Independent · default": "独立 · 默认",
  "Direct notes and managed subfolders mix in one ordering. Each managed subfolder keeps its own chain. Best for loosely related notes.":
    "直系文件与受管子文件夹在同一顺序空间混排；每个受管子文件夹自成链条。适合松散关联的笔记。",
  "Series · one chain": "系列 · 一条链",
  "One chain across the whole subtree; subfolders become path labels only. Best for tutorials and serials.":
    "整棵子树一条链；子文件夹仅作为路径前缀。适合教程与连载。",
  "Creates <b>{indexFile}.md</b> with <code>is-index: true</code> and a plugin-owned marked block. Recognition is by the marker, not the file name — you can rename the file later. Mode is stored in the index page’s frontmatter and can be switched any time.":
    "将创建 <b>{indexFile}.md</b>，附带 <code>is-index: true</code> 与插件专属的标记区块。识别只看标记、不看文件名 — 之后可随时改名。模式存于索引页 frontmatter，可随时切换。",
  "Start managing": "开始管理",
  "Creating domain — {n}/{total}": "正在创建域 — {n}/{total}",
  "writing {path} · is-index: true · marked block": "正在写入 {path} · is-index: true · 标记区块",
  "✓ Domain created — {domain}": "✓ 域已创建 — {domain}",
  "{indexFile}.md written (1 file) · existing notes got 10000-step order by filename order · review the suggested order in the panel":
    "{indexFile}.md 已写入（1 个文件）· 现有笔记已按文件名自然序获得 10000 步长 order · 请在面板中检查建议顺序",

  /* ---------- dialogs M1–M6 (05) ---------- */
  "Rebuild the index page for <b>{domain}</b>?": "重建以下域的索引页：<b>{domain}</b>？",
  "Rewrites the marked block in <code>{indexFile}.md</code>. Content outside the block — including your own preamble — is untouched.":
    "仅重写 <code>{indexFile}.md</code> 中标记区块内的内容。区块外内容（包括你手写的序言）不会改动。",
  "{n} file will be written": "{n} 个文件将被写入",
  "{n} files will be written": "{n} 个文件将被写入",
  Rebuild: "重建",
  "Rebuild all indexes — {n} domains": "重建全部索引 — {n} 个域",
  "Turn on navigation injection": "开启导航注入",
  "Chapter Trail will write a collapsible prev / next / index callout into <b>{n} notes</b> across {n2} domains. Each block is wrapped in <code>&lt;!-- chapter-trail:nav-* --&gt;</code> markers and can be removed anytime.":
    "Chapter Trail 将向 <b>{n} 篇笔记</b>（共 {n2} 个域）写入可折叠的上下篇/总览 callout。每段内容都包裹在 <code>&lt;!-- chapter-trail:nav-* --&gt;</code> 标记中，可随时移除。",
  "Batch writes run in chunks of 25 with a progress bar — you can cancel mid-run. Written files keep their content on cancel.":
    "批量写入按每块 25 篇分块执行并显示进度条 — 可中途取消；取消时已写入的文件保留内容。",
  "Not now": "暂不",
  "Enable · write {n} notes": "开启 · 写入 {n} 篇笔记",
  "{indexFile}.md already exists": "{indexFile}.md 已存在",
  "The target folder already has a file named <b>{indexFile}.md</b> without a chapter-trail marker. What should happen?":
    "目标文件夹已存在名为 <b>{indexFile}.md</b> 的无标记同名文件。如何处理？",
  "Adopt it": "采纳",
  "Keep all existing frontmatter keys; the existing list and body stay <b>outside</b> the plugin’s marked block, byte-identical. The plugin only appends its keys and the marked block.":
    "保留全部已有 frontmatter 键；已有列表与正文位于插件标记区块<b>之外</b>，逐字节不变。插件只追加自己的键与标记区块。",
  "Rename and keep": "重命名保留",
  "Keep the existing file under a new name, create a fresh index page.":
    "原文件重命名保留，另建全新索引页。",
  "Do nothing.": "不做任何操作。",
  Confirm: "确认",
  "✓ Existing {indexFile}.md adopted": "✓ 已采纳原 {indexFile}.md",
  "✓ Renamed to {indexFile}, fresh index created": "✓ 已重命名为 {indexFile}，并创建新索引页",
  "frontmatter keys & body byte-identical · plugin keys + marked block added":
    "frontmatter 键与正文逐字节不变 · 追加插件键与标记区块",
  "Nested index page detected": "检测到嵌套索引页",
  "<b>{path}</b> has <code>is-index: true</code>, but its folder is inside the series domain <b>{domain}</b>. Choose how to resolve:":
    "<b>{path}</b> 含有 <code>is-index: true</code>，但其所在文件夹位于 series 域 <b>{domain}</b> 内。请选择处置方式：",
  "Demote to a normal note": "降级为普通笔记",
  "Remove <code>is-index</code> and the marked block; the file itself is kept.":
    "移除 <code>is-index</code> 与标记区块；文件本身保留。",
  "Delete the file": "删除文件",
  "Move to system trash.": "移入系统回收站。",
  "Exclude the folder": "排除该文件夹",
  "Add <code>{folder}</code> to excluded-folders; the domain ignores it.":
    "将 <code>{folder}</code> 加入 excluded-folders；该域将忽略它。",
  Apply: "应用",
  "✓ Conflict resolved": "✓ 冲突已解决",
  "{path} moved to system trash": "{path} 已移入系统回收站",
  "{folder} added to excluded-folders · domain ignores it":
    "{folder} 已加入 excluded-folders · 该域忽略它",
  "is-index and marked block removed · file kept as a normal note":
    "is-index 与标记区块已移除 · 文件保留为普通笔记",
  "Stop managing this folder?": "停止管理该文件夹？",
  "Deleting <b>{indexFile}.md</b> dissolves the domain <b>{domain}</b>. The ordering data lives in each note’s frontmatter and will remain unless you clear it below.":
    "删除 <b>{indexFile}.md</b> 将解散域 <b>{domain}</b>。排序数据保存在每篇笔记的 frontmatter 中，除非在下方勾选清除，否则将保留。",
  "Also clear <code>order</code> fields": "同时清除 <code>order</code> 字段",
  "removes the field from all notes in the domain": "从该域全部笔记中移除该字段",
  "Also remove injected navigation": "同时移除已注入的导航",
  "strips chapter-trail markers only — your own callouts are kept":
    "仅剥离 chapter-trail 标记 — 你自己写的 callout 不受影响",
  "Delete index & stop": "删除索引页并停止",
  "Keep index & stop": "保留索引页并停止",
  "The domain <b>{domain}</b> dissolves; <b>{indexFile}.md</b> stays as a normal note (plugin markers removed). The ordering data lives in each note’s frontmatter and will remain unless you clear it below.":
    "解散域 <b>{domain}</b>；<b>{indexFile}.md</b> 保留为普通笔记（移除插件标记）。排序数据保存在每篇笔记的 frontmatter 中，除非在下方勾选清除，否则将保留。",
  "✓ Domain dissolved": "✓ 域已解散",
  "{indexFile}.md deleted": "{indexFile}.md 已删除",
  "{indexFile}.md kept as a normal note": "{indexFile}.md 已保留为普通笔记",
  "order fields kept — clean up via the panel banner or the Remove-all wizard":
    "order 字段已保留 — 可通过面板黄条或“全部清除”向导清理",
  "order cleared ({n})": "order 已清除（{n}）",
  "nav markers stripped ({n})": "导航标记已剥离（{n}）",
  " · order & injections kept": " · order 与注入已保留",
  "Remove all Chapter Trail data — step {n} of 3":
    "清除全部 Chapter Trail 数据 — 第 {n} 步 / 共 3 步",
  "① Strip injected navigation — removes everything inside <code>chapter-trail:nav-begin/end</code> markers across {n} domains. Your own callouts are never touched.":
    "① 剥离注入导航 — 移除 <code>chapter-trail:nav-begin/end</code> 标记内的全部内容（{n} 个域）。你自己写的 callout 永不触碰。",
  "{n} notes · wrapped markers only": "{n} 篇笔记 · 仅包裹标记内内容",
  "② Delete index pages — confirm per domain. Dissolved domains lose their auto-maintained index; the pages are plain Markdown and stay readable otherwise.":
    "② 删除索引页 — 逐域确认。域解散后失去自动维护的索引；索引页本身是普通 Markdown，仍可阅读。",
  "③ Clear <code>order</code> fields — confirm per domain.":
    "③ 清除 <code>order</code> 字段 — 逐域确认。",
  "This removes <b>all</b> <code>order</code> fields in each confirmed domain — including any not created by Chapter Trail. This cannot be undone except by reordering.":
    "此步骤将移除每个确认域内<b>全部</b> <code>order</code> 字段 — 包括非 Chapter Trail 创建的同名字段。除重新排序外无法撤销。",
  "({n} notes)": "（{n} 篇笔记）",
  Finish: "完成",
  "✓ All steps completed. Files outside the confirmed scope are byte-identical to before.":
    "✓ 全部步骤完成。确认范围之外的文件与之前逐字节一致。",
  "✓ Chapter Trail data removed": "✓ Chapter Trail 数据已清除",
  "stripped injections · deleted confirmed index pages · cleared confirmed order fields · everything else untouched":
    "已剥离注入 · 已删除确认的索引页 · 已清除确认的 order 字段 · 其余内容分毫未动",

  /* ---------- progress / chunked writer (07) ---------- */
  "Rebuilding index — {n}/{total}": "正在重建索引 — {n}/{total}",
  "Rebuilding all indexes": "正在重建全部索引",
  "Rebuilding injection — {n}/{total}": "正在重建注入 — {n}/{total}",
  "Rebuilding all injections": "正在重建全部注入",
  "Writing navigation — {n}/{total} notes": "正在写入导航 — {n}/{total} 篇笔记",
  "Assigning first-run orders": "正在执行首次声明 order 赋值",
  "Assigning first-run orders — {n}/{total}": "正在执行首次声明 order 赋值 — {n}/{total}",
  "chunk {n}/{total}": "块 {n}/{total}",
  "Cancelled at {n} / {total}": "已取消，进度 {n} / {total}",
  "written files keep their content · nothing is rolled back": "已写入的文件保留内容 · 不做回滚",
  "✓ Index rebuilt": "✓ 索引已重建",
  "{n} file written · entries sorted by order · dead links removed":
    "已写入 {n} 个文件 · 条目按 order 排序 · 死链已移除",
  "✓ Injection rebuilt": "✓ 注入已重建",
  "{n} notes · top + bottom callouts · prev/next links follow the current chain":
    "{n} 篇笔记 · 顶部+底部 callout · 上下篇链接跟随当前链条",
  "✓ Injection enabled": "✓ 注入已开启",
  "{n} notes written · wrapped in nav-begin/nav-end markers · removable anytime":
    "已写入 {n} 篇笔记 · 包裹于 nav-begin/nav-end 标记 · 可随时移除",
  "✓ done in {s}s · {n} written": "✓ 完成，用时 {s}s · {n} 个已写入",
  "{n} skipped (locked)": "{n} 个跳过（被锁定）",

  /* ---------- jump commands ---------- */
  "No managed domain contains this note": "该笔记不属于任何受管域",
  "This is the first note in the chain": "已是链条第一篇",
  "This is the last note in the chain": "已是链条最后一篇",
  "The index page no longer exists": "索引页已不存在",

  /* ---------- misc ---------- */
  "Not available yet": "暂不可用",
  "Clear legacy orders?": "清除遗留 order？",
  "This removes the <code>order</code> field from <b>{n} files</b> outside any managed domain. This cannot be undone except by reordering.":
    "将从 <b>{n} 个不属于任何受管域的文件</b>中移除 <code>order</code> 字段。除重新排序外无法撤销。",
  "Clear order in {n} files": "清除 {n} 个文件的 order",
  "· Step 1 of 3": "· 第 1 步 / 共 3 步",
  "1 file will be written": "将写入 1 个文件",
  "Auto-rebuild index after order changes": "order 变更后自动重建当前域索引",
  "When on, an order write in a domain (drag landing, reindex, first-run assignment, tight-gap auto normalize) automatically rebuilds that domain’s index — only the affected domain, never the whole vault. When off, the domain is flagged “Index outdated” for a manual rebuild.":
    "开启时，域内 order 写入（拖拽落位、重排、首次声明赋值、过密间隙自动重排）完成后自动重建该域索引 — 只重建受影响域，不级联全库。关闭时该域标黄“索引过期”等待手动重建。",
  "{n} orderless notes will get 10000-step orders by filename order":
    "将按文件名自然序为 {n} 篇无 order 笔记赋 10000 步长 order",
  "Resolve…": "解决…",
  "“{folder}” is inside the series domain “{domain}” — its whole subtree is already managed; only independent domains allow managing subfolders":
    "“{folder}”位于 series 域“{domain}”内 — 整个子树已被统一管理；只有 Independent 域才允许对子文件夹单独管理",
  "inside a series domain": "位于 series 域内",
  "No managed folders yet — use the button below to start managing one":
    "还没有受管文件夹 — 点击下方按钮开始管理一个",
};
