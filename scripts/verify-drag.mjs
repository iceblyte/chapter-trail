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
await new Promise((resolve) => server.listen(9601, resolve));

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
await page.goto("http://127.0.0.1:9601/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.__ctReady === true);
await page.evaluate(() => {
  window.__ctDebug = true;
});

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
  const alive = await page.evaluate(() => ({
    panelAlive: !!document.querySelector(".ct-panel"),
    panelCount: document.querySelectorAll(".ct-panel").length,
    cards: [...document.querySelectorAll(".ct-card")].map(
      (card) => card.querySelector(".ct-card-path")?.textContent,
    ),
  }));
  results.push({
    name: "post-card-drag panel alive",
    ...alive,
    pass: alive.panelAlive === true && alive.panelCount === 1,
  });
}

/* ---------- scenario 4: folder onto FILE bottom edge (fresh page) ---------- */
{
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => window.__ctReady === true);
  const outcome = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(300);
    const ct = window.__ct;
    const noticesBefore = ct.notices.length;
    const cards = [...document.querySelectorAll(".ct-card")];
    const card = cards.find((el) => el.querySelector(".ct-card-path")?.textContent === "Blogs");
    if (!card) {
      return {
        notice: null,
        titles: [
          "card lookup failed: " +
            cards.map((c) => c.querySelector(".ct-card-path")?.textContent).join(","),
        ],
      };
    }
    const rows = [...card.querySelectorAll(".ct-rows-scroll .ct-row")];
    const folderRow = rows.find(
      (row) =>
        row.classList.contains("is-folder-row") &&
        row.querySelector(".ct-row-title")?.textContent?.includes("番外"),
    );
    const fileRow = rows.find(
      (row) =>
        !row.classList.contains("is-folder-row") &&
        row.querySelector(".ct-row-title")?.textContent?.includes("02 环境搭建"),
    );
    const grip = folderRow.querySelector(".ct-grip");
    grip.style.visibility = "visible";
    const gs = grip.getBoundingClientRect();
    const ts = fileRow.getBoundingClientRect();
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
    fire(fileRow, "dragover", ts.x + 100, ts.y + ts.height - 3);
    fire(fileRow, "drop", ts.x + 100, ts.y + ts.height - 3);
    window.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }));
    grip.style.visibility = "";
    await sleep(700);
    const blogsCard = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    const titles = [...blogsCard.querySelectorAll(".ct-rows-scroll .ct-row")].map(
      (row) => row.querySelector(".ct-row-title")?.textContent?.trim() ?? "",
    );
    const samples = [];
    for (const delay of [0, 300, 700, 1200]) {
      if (delay === 700) {
        // force an extra version bump: does the panel follow?
        await ct.services.scan();
      }
      if (delay > 0) await sleep(300);
      const liveCard = [...document.querySelectorAll(".ct-card")].find(
        (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
      );
      samples.push({
        at: delay,
        titles: [
          ...(liveCard ?? card).querySelectorAll(".ct-rows-scroll .ct-row"),
        ].map((row) => row.querySelector(".ct-row-title")?.textContent?.trim() ?? ""),
        store: ct.store
          .getSnapshot()
          .domains.get("Blogs")
          ?.entries.map((entry) => entry.title),
      });
    }
    return {
      notice: ct.notices.slice(noticesBefore).at(-1) ?? null,
      samples,
    };
  });
  const finalSample = outcome.samples.at(-1);
  const domTitles = finalSample ? finalSample.titles : [];
  const storeTitles = finalSample ? finalSample.store : [];
  // the tree view and the store chain must agree (panel ≠ store = the bug)
  const domAfter02 = domTitles.findIndex((t) => t.includes("02 环境搭建"));
  const domFolder = domTitles.findIndex((t) => t.includes("番外"));
  // the invariant: the panel tree (DOM order AND visual order) matches
  // the store chain — the folder lands after the drop-target file
  const storeAfter02 = storeTitles.findIndex((t) => t.includes("02 环境搭建"));
  const storeFolder = storeTitles.findIndex((t) => t.includes("番外"));
  results.push({
    name: "folder onto FILE bottom edge",
    notice: outcome.notice,
    samples: outcome.samples,
    domTitles,
    storeTitles: storeTitles,
    pass:
      outcome.notice !== null &&
      outcome.notice.includes("Folder moved") &&
      domAfter02 !== -1 &&
      domFolder !== -1 &&
      domFolder > domAfter02 &&
      storeFolder > storeAfter02,
  });
}

/* ---------- scenario 4b: nested file dragged onto a root file row ---------- */
{
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => window.__ctReady === true);
  const outcome = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(300);
    const ct = window.__ct;
    const noticesBefore = ct.notices.length;
    const filesBefore = ct.vault.listMarkdownFiles().filter((p) => p.includes("03"));
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    const rows = [...card.querySelectorAll(".ct-rows-scroll .ct-row")];
    // 03 配置详解 lives inside 进阶篇; 01 为什么选择 Quartz is a root file
    const nestedRow = rows.find((row) =>
      row.querySelector(".ct-row-title")?.textContent?.includes("03 配置详解"),
    );
    const rootRow = rows.find((row) =>
      row.querySelector(".ct-row-title")?.textContent?.includes("01 为什么选择 Quartz"),
    );
    if (!nestedRow || !rootRow) {
      return { notice: null, movedOut: false, lookup: "rows missing" };
    }
    const grip = nestedRow.querySelector(".ct-grip");
    grip.style.visibility = "visible";
    const gs = grip.getBoundingClientRect();
    const ts = rootRow.getBoundingClientRect();
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
    fire(nestedRow, "dragstart", gs.x + 6, gs.y + 6);
    fire(rootRow, "dragover", ts.x + 100, ts.y + ts.height - 3);
    fire(rootRow, "drop", ts.x + 100, ts.y + ts.height - 3);
    window.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }));
    grip.style.visibility = "";
    await sleep(900);
    return {
      notice: ct.notices.slice(noticesBefore).at(-1) ?? null,
      allNotices: ct.notices.slice(noticesBefore),
      movedOut: ct.vault.exists("Blogs/进阶篇/03 配置详解.md"),
      movedToRoot: ct.vault.exists("Blogs/03 配置详解.md"),
    };
  });
  results.push({
    name: "nested file drag-out to root (scenario 4b)",
    ...outcome,
    pass: outcome.movedOut === false && outcome.movedToRoot === true,
  });
}

/* ---------- scenario 5: file drag-out onto another folder row (fresh page) ---------- */
{
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => window.__ctReady === true);
  const outcome = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(300);
    const ct = window.__ct;
    const noticesBefore = ct.notices.length;
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    const rows = [...card.querySelectorAll(".ct-rows-scroll .ct-row")];
    const fileRow = rows.find((row) =>
      row.querySelector(".ct-row-title")?.textContent?.includes("03 配置详解"),
    );
    // drop onto the 番外 folder row — a DIFFERENT folder than 03's own
    const folderRow = rows.find(
      (row) =>
        row.classList.contains("is-folder-row") &&
        row.querySelector(".ct-row-title")?.textContent?.includes("番外"),
    );
    if (!fileRow || !folderRow) {
      return {
        notice: null,
        movedOut: false,
        movedIn: false,
        lookup: "rows missing",
      };
    }
    const grip = fileRow.querySelector(".ct-grip");
    grip.style.visibility = "visible";
    const gs = grip.getBoundingClientRect();
    const ts = folderRow.getBoundingClientRect();
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
    fire(fileRow, "dragstart", gs.x + 6, gs.y + 6);
    fire(folderRow, "dragover", ts.x + 100, ts.y + 10);
    fire(folderRow, "drop", ts.x + 100, ts.y + 10);
    window.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }));
    grip.style.visibility = "";
    await sleep(700);
    return {
      notice: ct.notices.slice(noticesBefore).at(-1) ?? null,
      movedOut: ct.vault.exists("Blogs/进阶篇/03 配置详解.md"),
      movedIn: ct.vault.exists("Blogs/番外/03 配置详解.md"),
    };
  });
  results.push({
    name: "file drag-out onto folder row",
    ...outcome,
    pass: outcome.movedOut === false && outcome.movedIn === true,
  });
}

/* ---------- scenario 5b: file onto folder TOP edge = insert BEFORE (round 18) ---------- */
{
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => window.__ctReady === true);
  const outcome = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(300);
    const ct = window.__ct;
    const noticesBefore = ct.notices.length;
    const card = [...document.querySelectorAll(".ct-card")].find(
      (el) => el.querySelector(".ct-card-path")?.textContent === "Blogs",
    );
    const rows = [...card.querySelectorAll(".ct-rows-scroll .ct-row")];
    const fileRow = rows.find((row) =>
      row.querySelector(".ct-row-title")?.textContent?.includes("03 配置详解"),
    );
    const folderRow = rows.find(
      (row) =>
        row.classList.contains("is-folder-row") &&
        row.querySelector(".ct-row-title")?.textContent?.includes("番外"),
    );
    if (!fileRow || !folderRow) return { lookup: "rows missing" };
    const grip = fileRow.querySelector(".ct-grip");
    grip.style.visibility = "visible";
    const gs = grip.getBoundingClientRect();
    const ts = folderRow.getBoundingClientRect();
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
    fire(fileRow, "dragstart", gs.x + 6, gs.y + 6);
    // TOP BAND of the folder row: the gap BEFORE the folder — must insert,
    // never swallow the file into the folder (round 18 fix)
    fire(folderRow, "dragover", ts.x + 100, ts.y + 3);
    fire(folderRow, "drop", ts.x + 100, ts.y + 3);
    window.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }));
    grip.style.visibility = "";
    await sleep(700);
    const store = ct.store.getSnapshot();
    const domain = [...store.domains.values()].find((d) => d.root === "Blogs");
    const titles = domain.entries.map((e) => e.title);
    const i03 = titles.indexOf("03 配置详解");
    const i06 = titles.indexOf("06 番外篇");
    return {
      notice: ct.notices.slice(noticesBefore).at(-1) ?? null,
      movedIn: ct.vault.exists("Blogs/番外/03 配置详解.md"),
      stayed: ct.vault.exists("Blogs/03 配置详解.md"),
      before: i03 !== -1 && i06 !== -1 && i03 === i06 - 1,
      titles,
    };
  });
  results.push({
    name: "file onto folder TOP edge inserts before it (no swallow)",
    ...outcome,
    pass:
      outcome.stayed === true &&
      outcome.movedIn === false &&
      outcome.before === true,
  });
}

/* ---------- scenario 6: picker includes folder A (only subfolders) ---------- */
{
  const outcome = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const flow = [...document.querySelectorAll(".ct-panel-foot button")].find((b) =>
      b.textContent.includes("Start managing"),
    );
    flow.click();
    await sleep(200);
    const titles = [...document.querySelectorAll(".ct-option-tt")].map((el) => el.textContent);
    return { titles, hasA: titles.includes("A") };
  });
  results.push({
    name: "picker shows folder A (only subfolders)",
    ...outcome,
    pass: outcome.hasA === true,
  });
  await page.evaluate(() => {
    const cancel = [...document.querySelectorAll(".ct-modal-actions button")].find(
      (b) => b.textContent === "取消" || b.textContent === "Cancel",
    );
    cancel?.click();
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
console.log("RESULTS_JSON:", JSON.stringify(results));
console.log(allPass ? "ALL DRAG SCENARIOS PASS" : "SOME SCENARIOS FAILED");

await browser.close();
server.close();
process.exit(allPass ? 0 : 1);
