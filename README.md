# Chapter Trail

An [Obsidian](https://obsidian.md) plugin that gives folder-organized,
publish-oriented authors three things in one package:

1. **Folder-level custom ordering** — an `order` number in each note's
   frontmatter (10000-step integers, midpoint inserts). The order lives
   in the files themselves, so it survives git sync, vault moves and
   plugin uninstalls.
2. **Auto-maintained index pages (MOC)** — a real-Markdown table of
   contents per managed folder, rebuilt on demand. No dynamic code
   blocks: what you see in Obsidian is what gets published.
3. **Static series navigation** — a collapsible `prev / overview / next`
   callout written into each note (optional, off by default). Publish
   to [Quartz](https://quartz.jzhao.xyz) and the navigation just works.

> State-as-files: ordering, mode and exclusions all live in your notes
> and index pages. The plugin keeps no private database. A full
> **Remove all Chapter Trail data** wizard strips everything it ever
> wrote.

## How it works

- **Managed domain** — a folder is managed when it contains an index
  page: a note with `is-index: true` and the plugin's marker block
  (`<!-- chapter-trail:begin --> … <!-- chapter-trail:end -->`).
  Recognition is by the marker, never by file name.
- **Independent mode** — direct notes and managed subfolders share one
  ordering space; each managed subfolder keeps its own chain.
- **Series mode** — one chain across the whole subtree; subfolders
  become path labels only (rendered as bold non-link nodes so Quartz
  never emits dead links).
- **Ordering** — `order` is a positive integer (10000, 20000, …).
  Dragging writes a single file using the integer midpoint of its new
  neighbors; landing in a too-tight gap (< 10) normalizes the domain
  first. Ties fall back to filename natural order.

## Panel

Open the side panel via the ribbon icon (list-ordered). Every managed
domain gets a card: virtualized entry list with drag-to-reorder (or
right-click → Move up / Move down), status chips
(red = broken link / structural conflict, yellow = rebuild suggested,
blue = pending sort) and the rebuild actions.

## Commands

`Start managing current folder`, `Stop managing current folder`,
`Rebuild index for current domain`, `Rebuild all indexes`,
`Reindex order in current domain`, `Rebuild injection in current domain`,
`Remove all Chapter Trail data…`, `Go to previous note`,
`Go to next note`, `Open the index page of the current domain`.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Index file name | `目录` | used when creating new index pages; preset suggestion `index` |
| Date display on index entries | `created` | `created` / `updated` / `both`, ISO-whitelist parsed |
| Write prev / next navigation | **off** | the single gate of every injection write; off = nothing is ever written into your notes |
| order 变更后自动重建当前域索引 | off | auto-rebuild the affected domain index after order writes |
| Language | English | English / 中文 across panel, commands and dialogs |

## Development

```sh
pnpm install
pnpm gate          # typecheck + biome + vitest + core purity
pnpm test          # unit + integration (A1–A11) + UI
pnpm bench         # A9 performance benchmarks
pnpm build         # tsc --noEmit + esbuild → main.js
pnpm gen-vault     # synthetic 10k-note vault (scripts/gen-synthetic-vault.mjs)
```

Architecture follows the design doc: a pure-TypeScript core
(`src/core`, no Obsidian imports — enforced by
`scripts/check-core-purity.mjs`), a single adapter layer for the
Obsidian API, and a React 19 panel. Batch writes run chunked with echo
suppression so the plugin's own writes never cascade.

## License

MIT
