/**
 * Synthetic vault generator (DESIGN.md §6.3, A9).
 *
 *   node scripts/gen-synthetic-vault.mjs --out ./tmp-vault --notes 10000 --domains 40 --seed 42
 *
 * Produces a seeded, reproducible vault with series/independent
 * domains, nested folders, Chinese/spacey filenames, ties, tight gaps,
 * excluded notes/folders and orderless entries.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at !== -1 ? args[at + 1] : fallback;
};

const out = flag("out", "./tmp-synthetic-vault");
const totalNotes = Number(flag("notes", 10000));
const domainCount = Number(flag("domains", 40));
const seed = Number(flag("seed", 42));

rmSync(out, { recursive: true, force: true });
const random = mulberry32(seed);
const pick = (list) => list[Math.floor(random() * list.length)];
const topics = [
  "Quartz 教程",
  "卡片盒笔记法",
  "数字花园周记",
  "Zettelkasten 实践",
  " Obsidian 指南",
  "写作方法论",
];

let written = 0;
mkdirSync(out, { recursive: true });

const perDomain = Math.max(10, Math.floor(totalNotes / domainCount));
for (let d = 0; d < domainCount && written < totalNotes; d++) {
  const topic = `${String(d + 1).padStart(2, "0")} ${pick(topics)}`;
  const root = join(out, topic);
  const mode = random() < 0.5 ? "series" : "independent";
  mkdirSync(root, { recursive: true });
  const size = Math.min(perDomain, totalNotes - written);

  const lines = [];
  for (let i = 0; i < size; i++) {
    const deep = mode === "series" && random() < 0.3 ? "进阶篇" : "";
    const folder = deep ? join(root, deep) : root;
    if (deep) mkdirSync(folder, { recursive: true });
    const name = `${String(i + 1).padStart(3, "0")} ${pick(["为什么", "怎么做", "踩坑记", "总结", "实践"])} ${i}.md`;
    const path = join(folder, name);

    let order;
    const dice = random();
    if (dice < 0.05)
      order = undefined; // pending
    else if (dice < 0.1)
      order = (i + 1) * 10000; // occasional tie
    else if (dice < 0.15)
      order = (i + 1) * 10000 + Math.floor(random() * 8); // tight gaps
    else order = (i + 1) * 10000;

    const fm = [
      "---",
      `created: 2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
    ];
    if (dice > 0.97) fm.push("excluded: true");
    if (order !== undefined) fm.push(`order: ${order}`);
    fm.push("---", "", `# ${name.replace(/\.md$/, "")}`, "", "正文内容。", "");
    writeFileSync(path, fm.join("\n"), "utf8");
    if (!fm.includes("excluded: true"))
      lines.push(`- [${name.replace(/\.md$/, "")}](./${deep ? `${deep}/` : ""}${name})`);
    written++;
  }
  writeFileSync(
    join(root, "目录.md"),
    [
      "---",
      "is-index: true",
      `mode: ${mode}`,
      "---",
      "",
      "<!-- chapter-trail:begin -->",
      ...lines,
      "<!-- chapter-trail:end -->",
      "",
    ].join("\n"),
    "utf8",
  );
}

console.log(
  `synthetic vault written: ${written} notes across ${domainCount} domains → ${out} (seed ${seed})`,
);
