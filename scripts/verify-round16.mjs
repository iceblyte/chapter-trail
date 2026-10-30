/**
 * Browser verification for the round-16 UI fixes (run: pnpm verify:round16).
 * Drives the real harness (real PanelRoot + PluginServices over
 * FakeVault) in headless Edge via puppeteer-core.
 *
 * Scenarios:
 *  1. header row above the index row; icon buttons replace the kebab menu
 *  2. date cells render datetime values ("2026-09-04 23:40")
 *  3. the "…n more · git sync batch" row wraps to two full lines
 *  4. folded cards show an attention dot; the filter shows only those
 *  5. copy-domain-path button fires its action
 */

import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = dirname(fileURLToPath(import.meta.url));
const harnessDir = join(here, "..", "test", "harness");
const evidenceDir = join(here, "..", "docs", "bugfix-evidence");
mkdirSync(evidenceDir, { recursive: true });

const server = createServer((req, res) => {
  const file = join(harnessDir, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  try {
    const data = readFileSync(file);
    res.writeHead(200, {
      "content-type": file.endsWith(".html")
        ? "text/html"
        : file.endsWith(".css")
          ? "text/css"
          : "text/javascript",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(9600, resolve));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 460, height: 940 });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("404")) {
    pageErrors.push(`console: ${message.text()}`);
  }
});
await page.goto("http://127.0.0.1:9600/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.__ctReady === true);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const panelShot = async (name) => {
  const panel = await page.$(".ct-panel");
  await panel.screenshot({ path: join(evidenceDir, name) });
};

/* ---------- scenario 1: header order + card header buttons ---------- */
{
  const outcome = await page.evaluate(() => {
    const card = document.querySelector(".ct-card");
    const first = card.querySelector(".ct-rows > *");
    const headRow = card.querySelector(".ct-head-row");
    const indexRow = card.querySelector(".ct-index-row");
    const headButtons = [...card.querySelectorAll(".ct-card-head .ct-icon-btn")];
    // the harness's obsidian-mock setIcon writes the icon NAME as text —
    // real Obsidian injects the lucide svg through the same call
    const iconSlots = headButtons.map((b) => b.querySelector(".ct-ob-icon")?.textContent ?? "none");
    return {
      firstIsHeadRow: first === headRow,
      headRowBeforeIndex: !!(headRow && indexRow && headRow.compareDocumentPosition(indexRow) & 4),
      noMenu: !card.querySelector(".ct-card-head .ct-menu"),
      noKebab: ![...card.querySelectorAll(".ct-card-head button")].some(
        (b) => b.textContent === "⋮",
      ),
      buttonCount: headButtons.length,
      iconSlots,
      headerCells: [
        ...card.querySelectorAll(
          ".ct-head-row .ct-row-title, .ct-head-row .ct-row-date, .ct-head-row .ct-row-order",
        ),
      ].map((el) => el.textContent.trim()),
    };
  });
  check(
    "bug 1: column header row is the first row, above the index row",
    outcome.firstIsHeadRow && outcome.headRowBeforeIndex,
  );
  check(
    "bug 2/3: kebab menu gone, no menu popup, two icon buttons wired to copy/folder-x",
    outcome.noMenu &&
      outcome.noKebab &&
      outcome.buttonCount === 2 &&
      outcome.iconSlots.join(",") === "copy,folder-x",
    `buttons=${outcome.buttonCount} icons=${outcome.iconSlots.join(",")}`,
  );
  check("bug 1: header cells are 文件名/创建/更新/排序 order", outcome.headerCells.length === 4);
  await panelShot("round16-01-header-and-buttons.png");
}

/* ---------- scenario 2: start managing 随笔 (second, clean card) ---------- */
{
  await page.evaluate(async () => {
    await window.__ct.services.startManaging("随笔", "independent");
  });
  await sleep(100);
  const cards = await page.evaluate(() => document.querySelectorAll(".ct-card").length);
  check("setup: 随笔 managed → two domain cards", cards === 2, `cards=${cards}`);
}

/* ---------- scenario 3: datetime in the updated column ---------- */
{
  await page.evaluate(async () => {
    const ct = window.__ct;
    await ct.vault.write(
      "Blogs/02 环境搭建与部署.md",
      "---\ncreated: 2025-11-09\nupdated: 2026-09-04 23:40\norder: 20000\n---\n正文\n",
    );
    ct.services;
    await ct.services.scan();
  });
  await sleep(100);
  const updatedShown = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    const row = [...card.querySelectorAll(".ct-rows-scroll .ct-row")].find((el) =>
      el.querySelector(".ct-row-title")?.textContent?.includes("02 环境搭建与部署"),
    );
    return [...(row?.querySelectorAll(".ct-row-date") ?? [])].map((el) => el.textContent.trim());
  });
  check(
    "bug 5/6: updated column shows the space-separated datetime",
    updatedShown.includes("2026-09-04 23:40"),
    updatedShown.join(" | "),
  );
  await panelShot("round16-02-datetime.png");
}

/* ---------- scenario 4: the two-line "…n more" row ---------- */
{
  await page.evaluate(async () => {
    const ct = window.__ct;
    for (let i = 1; i <= 5; i++) {
      ct.vault.write(`Blogs/新篇 ${i}.md`, "---\n---\n正文\n");
    }
    await ct.services.scan();
  });
  await sleep(100);
  const moreRow = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    const row = card.querySelector(".ct-rows-scroll .ct-more-row");
    if (!row) return null;
    const title = row.querySelector(".ct-row-title");
    const style = getComputedStyle(title);
    return {
      text: title.textContent.trim(),
      rowHeight: row.offsetHeight,
      titleHeight: title.offsetHeight,
      wraps: style.whiteSpace === "normal",
      notClipping: style.overflowY === "visible",
    };
  });
  check(
    "bug 11: '…n more' row wraps to its natural height (auto-height + no overflow clip)",
    !!moreRow &&
      moreRow.wraps &&
      moreRow.notClipping &&
      moreRow.rowHeight > 40 &&
      moreRow.rowHeight >= moreRow.titleHeight,
    moreRow ? `row=${moreRow.rowHeight}px title=${moreRow.titleHeight}px` : "row missing",
  );
  await panelShot("round16-03-more-row.png");
}

/* ---------- scenario 5: folded attention dot + attention filter ---------- */
{
  // fold the Blogs card (click its head)
  await page.evaluate(async () => {
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    card.querySelector(".ct-card-head").click();
  });
  await sleep(100);
  const dot = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    return card.querySelector(".ct-attention-dot")?.getAttribute("class") ?? null;
  });
  check("bug 13: folded card shows an attention dot", !!dot, dot ?? "none");

  // attention filter: only cards with chips stay visible
  await page.evaluate(() => {
    document
      .querySelector('.ct-panel-head .ct-icon-btn[title="Show only domains needing attention"]')
      .click();
  });
  await sleep(100);
  const filterState = await page.evaluate(() => {
    const paths = [...document.querySelectorAll(".ct-card .ct-card-path")].map(
      (el) => el.textContent,
    );
    const active = document
      .querySelector('.ct-panel-head .ct-icon-btn[title="Show only domains needing attention"]')
      ?.getAttribute("class")
      .includes("is-active");
    return { paths, active };
  });
  check(
    "bug 13: attention filter shows only Blogs (随笔 clean card hidden)",
    filterState.active && filterState.paths.length === 1 && filterState.paths[0] === "Blogs",
    filterState.paths.join(","),
  );
  await panelShot("round16-04-attention-filter.png");

  // reset: filter off, Blogs expanded again
  await page.evaluate(() => {
    document
      .querySelector('.ct-panel-head .ct-icon-btn[title="Show only domains needing attention"]')
      .click();
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    card.querySelector(".ct-card-head").click();
  });
  await sleep(100);
}

/* ---------- scenario 6: copy button ---------- */
{
  await page.evaluate(() => {
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    const copyBtn = card.querySelector(".ct-card-head .ct-icon-btn");
    copyBtn.click();
  });
  await sleep(50);
  const copied = await page.evaluate(() =>
    window.__ct.notices.some((n) => String(n).startsWith("[copy] Blogs")),
  );
  check("bug 3: copy-domain-path button triggers the action", copied);
}

/* ---------- scenario 7: mode filter buttons (round 17) ---------- */
{
  const visible = () =>
    page.evaluate(() => [...document.querySelectorAll(".ct-card .ct-card-path")].map((el) => el.textContent));
  const clickFilter = (title) =>
    page.evaluate((t) => {
      document.querySelector(`.ct-panel-head .ct-icon-btn[title="${t}"]`).click();
    }, title);

  await clickFilter("Show only independent domains");
  await sleep(100);
  const independent = { paths: await visible() };
  await clickFilter("Show only series domains");
  await sleep(100);
  const series = { paths: await visible() };
  await panelShot("round17-05-series-filter.png");
  await clickFilter("Show only series domains"); // back to "all"
  await sleep(100);
  const all = await visible();

  check(
    "round 17: independent filter shows only 随笔",
    independent.paths.length === 1 && independent.paths[0] === "随笔",
    independent.paths.join(","),
  );
  check(
    "round 17: series filter shows only Blogs",
    series.paths.length === 1 && series.paths[0] === "Blogs",
    series.paths.join(","),
  );
  check("round 17: resetting shows every domain again", all.length === 2, all.join(","));
}

console.log(pageErrors.length ? `PAGE ERRORS: ${pageErrors.join(" || ")}` : "no page errors");
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} CHECKS PASS`);
await browser.close();
server.close();
if (failed.length > 0 || pageErrors.length > 0) process.exit(1);
