/**
 * Browser verification for the drag pipelines (run: pnpm verify:drag).
 * Drives the real harness (real PanelRoot + PluginServices over
 * FakeVault) in headless Edge via puppeteer-core with synthetic HTML5
 * drag events through the REAL pdnd handlers.
 *
 * Scenarios:
 *  1. folder drag  → block move, panel tree reorders, notice fires
 *  2. file drag    → single midpoint write (regression)
 *  3. card drag    → domain cards swap
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = dirname(fileURLToPath(import.meta.url));
const harnessDir = join(here, "..", "test", "harness");

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
await new Promise((resolve) => server.listen(4199, resolve));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.text().includes("[probe]")) {
    console.log("  BROWSER:", message.text());
    return;
  }
  if (message.type() === "error" && !message.text().includes("404")) {
    pageErrors.push(`console: ${message.text()}`);
  }
});
await page.goto("http://127.0.0.1:4199/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.__ctReady === true);

const results = [];

/* ---------- scenario 1: folder block move ---------- */
{
  const outcome = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ct = window.__ct;
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    // expand 进阶篇
    card.querySelector(".ct-row.is-folder-row").click();
    await sleep(150);
    const rowsBefore = [...card.querySelectorAll(".ct-rows-scroll .ct-row")].map(
      (row) => row.querySelector(".ct-row-title")?.textContent?.trim() ?? "",
    );
    const noticesBefore = ct.notices.length;

    const folderRow = card.querySelector(".ct-row.is-folder-row");
    const targetRow = [...card.querySelectorAll(".ct-rows-scroll .ct-row")].find((row) =>
      row.querySelector(".ct-row-title")?.textContent?.includes("01 为什么选择 Quartz"),
    );
    const grip = folderRow.querySelector(".ct-grip");
    grip.style.visibility = "visible";
    const gs = grip.getBoundingClientRect();
    const ts = targetRow.getBoundingClientRect();
    const dt = new DataTransfer();
    const fire = (el, type, x, y) =>
      el.dispatchEvent(
        new DragEvent(type, {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        }),
      );
    fire(folderRow, "dragstart", gs.x + 6, gs.y + 6);
    const started = dt.types.length > 0;
    fire(targetRow, "dragover", ts.x + 100, ts.y + 3);
    fire(targetRow, "drop", ts.x + 100, ts.y + 3);
    window.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }));
    grip.style.visibility = "";
    await sleep(700);
    const rowsAfter = [
      ...document.querySelectorAll(".ct-card")[0].querySelectorAll(".ct-rows-scroll .ct-row"),
    ].map((row) => row.querySelector(".ct-row-title")?.textContent?.trim() ?? "");
    return {
      started,
      rowsBefore,
      rowsAfter,
      notice: ct.notices.slice(noticesBefore).at(-1) ?? null,
      order01: ct.vault.getFrontmatter("Blogs/01 为什么选择 Quartz.md")?.order,
      order04: ct.vault.getFrontmatter("Blogs/进阶篇/04 插件机制.md")?.order,
    };
  });
  results.push({
    name: "folder drag = block move",
    ...outcome,
    pass:
      outcome.started === true &&
      outcome.notice !== null &&
      outcome.rowsBefore.join("|") !== outcome.rowsAfter.join("|"),
  });
}

/* ---------- scenario 1b: folder drop onto ITS OWN row (no-op) ---------- */
{
  const outcome = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ct = window.__ct;
    const noticesBefore = ct.notices.length;
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    const folderRow = card.querySelector(".ct-row.is-folder-row");
    const grip = folderRow.querySelector(".ct-grip");
    grip.style.visibility = "visible";
    const gs = grip.getBoundingClientRect();
    const dt = new DataTransfer();
    const fire = (el, type, x, y) =>
      el.dispatchEvent(
        new DragEvent(type, {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        }),
      );
    fire(folderRow, "dragstart", gs.x + 6, gs.y + 6);
    fire(folderRow, "dragover", gs.x + 60, gs.y + 16);
    fire(folderRow, "drop", gs.x + 60, gs.y + 16);
    window.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }));
    grip.style.visibility = "";
    await sleep(500);
    return { notice: ct.notices.slice(noticesBefore).at(-1) ?? null };
  });
  results.push({
    name: "folder self-drop is a safe no-op",
    ...outcome,
    pass: outcome.notice !== null && outcome.notice.includes("unchanged"),
  });
}

/* ---------- scenario 2: file drag (regression) ---------- */
{
  const outcome = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ct = window.__ct;
    // restore canonical chain first
    await ct.services.moveEntry("Blogs", "Blogs/01 为什么选择 Quartz.md", 0);
    await ct.services.moveEntry("Blogs", "Blogs/02 环境搭建与部署.md", 1);
    await ct.services.moveEntry("Blogs", "Blogs/进阶篇/04 插件机制.md", 2);
    await ct.services.moveEntry("Blogs", "Blogs/进阶篇/05 主题定制.md", 3);
    await ct.services.moveEntry("Blogs", "Blogs/03 配置详解.md", 4);
    await sleep(300);
    const noticesBefore = ct.notices.length;
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    const sourceRow = [...card.querySelectorAll(".ct-rows-scroll .ct-row")].find((row) =>
      row.querySelector(".ct-row-title")?.textContent?.includes("01 为什么选择 Quartz"),
    );
    const targetRow = [...card.querySelectorAll(".ct-rows-scroll .ct-row")].find((row) =>
      row.querySelector(".ct-row-title")?.textContent?.includes("02 环境搭建与部署"),
    );
    const grip = sourceRow.querySelector(".ct-grip");
    grip.style.visibility = "visible";
    const gs = grip.getBoundingClientRect();
    const ts = targetRow.getBoundingClientRect();
    const dt = new DataTransfer();
    const fire = (el, type, x, y) =>
      el.dispatchEvent(
        new DragEvent(type, {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        }),
      );
    fire(sourceRow, "dragstart", gs.x + 6, gs.y + 6);
    const started = dt.types.length > 0;
    fire(targetRow, "dragover", ts.x + 100, ts.y + ts.height - 3);
    fire(targetRow, "drop", ts.x + 100, ts.y + ts.height - 3);
    window.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }));
    grip.style.visibility = "";
    await sleep(700);
    return {
      started,
      notice: ct.notices.slice(noticesBefore).at(-1) ?? null,
      order01: ct.vault.getFrontmatter("Blogs/01 为什么选择 Quartz.md")?.order,
    };
  });
  results.push({
    name: "file drag (regression)",
    ...outcome,
    pass: outcome.started === true && outcome.notice !== null,
  });
}

/* ---------- scenario 3: card drag ---------- */
{
  const outcome = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ct = window.__ct;
    if (!ct.store.getSnapshot().domains.has("随笔")) {
      await ct.services.startManaging("随笔", "independent");
    }
    await sleep(400);
    const readCards = () =>
      [...document.querySelectorAll(".ct-card")].map(
        (card) => card.querySelector(".ct-card-path")?.textContent,
      );
    const before = readCards();
    const wraps = [...document.querySelectorAll(".ct-card-wrap")];
    const source = wraps[0];
    const target = wraps[1];
    const grip = source.querySelector(".ct-card-grip");
    const ss = grip.getBoundingClientRect();
    const ts = target.getBoundingClientRect();
    const dt = new DataTransfer();
    const fire = (el, type, x, y) =>
      el.dispatchEvent(
        new DragEvent(type, {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        }),
      );
    // dragstart coordinates must be on the SOURCE grip (handle check);
    // the browser resolves dragstart.target to the draggable ancestor
    fire(source, "dragstart", ss.x + 4, ss.y + 10);
    fire(target, "dragover", ts.x + 100, ts.y + ts.height - 5);
    fire(target, "drop", ts.x + 100, ts.y + ts.height - 5);
    window.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }));
    await sleep(400);
    return { started: true, before, after: readCards() };
  });
  results.push({
    name: "card drag reorder",
    ...outcome,
    pass: outcome.before.join("|") !== outcome.after.join("|"),
  });
}

console.log("\n=== verify:drag results ===");
let allPass = true;
for (const result of results) {
  console.log(
    `${result.pass ? "PASS" : "FAIL"}  ${result.name}` +
      (result.notice ? `  notice="${result.notice}"` : ""),
  );
  if (!result.pass) {
    allPass = false;
    console.log("   detail:", JSON.stringify(result, null, 2).slice(0, 900));
  }
}
if (pageErrors.length > 0) {
  allPass = false;
  console.log("PAGE ERRORS:", pageErrors.slice(0, 5));
}
console.log(allPass ? "ALL DRAG SCENARIOS PASS" : "SOME SCENARIOS FAILED");

await browser.close();
server.close();
process.exit(allPass ? 0 : 1);
