/* Chapter Trail 原型 · 共享脚本（主题切换 / 弹窗 / Toast / 菜单 / 选项组） */
(function () {
  "use strict";

  /* ---------- 主题 ---------- */
  var saved = null;
  try { saved = localStorage.getItem("ct-theme"); } catch (e) {}
  document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";

  window.ctSetTheme = function (t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("ct-theme", t); } catch (e) {}
    document.querySelectorAll("[data-ct-theme-btn]").forEach(function (b) {
      b.dataset.active = b.dataset.ctThemeBtn === t ? "true" : "false";
    });
  };

  /* ---------- Toast ---------- */
  function toastRoot() {
    var root = document.getElementById("ct-toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "ct-toast-root";
      root.className = "ct-toast-root";
      document.body.appendChild(root);
    }
    return root;
  }
  window.ctToast = function (msg, sub, opts) {
    opts = opts || {};
    var el = document.createElement("div");
    el.className = "ct-toast";
    el.innerHTML = "<div>" + msg + (opts.cancel ? '<span class="ct-cancel">Cancel</span>' : "") + "</div>" + (sub ? '<div class="ct-toast-sub">' + sub + "</div>" : "");
    if (opts.html) el.innerHTML = msg + (sub ? '<div class="ct-toast-sub">' + sub + "</div>" : "");
    toastRoot().appendChild(el);
    var life = opts.ms || 4200;
    if (!opts.sticky) setTimeout(function () { dismiss(); }, life);
    function dismiss() {
      el.classList.add("is-leaving");
      setTimeout(function () { el.remove(); }, 260);
    }
    var cancelBtn = el.querySelector(".ct-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", function () { dismiss(); if (opts.onCancel) opts.onCancel(); });
    return { el: el, dismiss: dismiss };
  };

  /* 带进度条的 Toast：chunked(i, total, chunkSize, onDone, ctrl) */
  window.ctProgressToast = function (titleTpl, subTpl, total, chunk, onDone) {
    var el = document.createElement("div");
    el.className = "ct-toast";
    el.innerHTML = "<div>" + titleTpl.replace("{n}", 0).replace("{total}", total) + '<span class="ct-cancel">Cancel</span></div><div class="ct-pbar"><i></i></div><div class="ct-toast-sub"></div>';
    toastRoot().appendChild(el);
    var bar = el.querySelector(".ct-pbar i");
    var sub = el.querySelector(".ct-toast-sub");
    var done = 0, cancelled = false;
    var cancelBtn = el.querySelector(".ct-cancel");
    cancelBtn.addEventListener("click", function () { cancelled = true; });
    function tick() {
      if (cancelled) {
        titleTpl && (el.querySelector("div").innerHTML = "Cancelled at " + done + " / " + total + '<span class="ct-cancel" style="display:none"></span>');
        sub.textContent = "written files keep their new content — nothing is rolled back";
        setTimeout(function () { el.classList.add("is-leaving"); setTimeout(function () { el.remove(); }, 260); }, 2600);
        return;
      }
      done = Math.min(total, done + chunk);
      bar.style.width = (done / total * 100).toFixed(1) + "%";
      el.querySelector("div").innerHTML = titleTpl.replace("{n}", done).replace("{total}", total) + '<span class="ct-cancel">Cancel</span>';
      el.querySelector(".ct-cancel").addEventListener("click", function () { cancelled = true; });
      sub.textContent = subTpl.replace("{n}", done);
      if (done >= total) {
        setTimeout(function () { el.classList.add("is-leaving"); setTimeout(function () { el.remove(); }, 260); if (onDone) onDone(); }, 500);
        return;
      }
      setTimeout(tick, 260);
    }
    setTimeout(tick, 120);
    return { el: el };
  };

  /* ---------- 弹窗 ---------- */
  window.ctOpenModal = function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add("is-open");
  };
  window.ctCloseModal = function (idOrEl) {
    var el = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
    if (el) el.classList.remove("is-open");
  };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var open = document.querySelectorAll(".ct-modal-overlay.is-open");
      if (open.length) open[open.length - 1].classList.remove("is-open");
      closeAllMenus();
    }
  });

  /* ---------- 全局点击委托 ---------- */
  function closeAllMenus() {
    document.querySelectorAll(".ct-menu.is-open").forEach(function (m) { m.classList.remove("is-open"); });
  }
  document.addEventListener("click", function (e) {
    var t = e.target;

    var themeBtn = t.closest("[data-ct-theme-btn]");
    if (themeBtn) { window.ctSetTheme(themeBtn.dataset.ctThemeBtn); return; }

    var opener = t.closest("[data-ct-open]");
    if (opener) { e.preventDefault(); window.ctOpenModal(opener.dataset.ctOpen); return; }

    var closer = t.closest("[data-ct-close]");
    if (closer) { e.preventDefault(); var ov = closer.closest(".ct-modal-overlay"); if (ov) { ov.classList.remove("is-open"); if (ov.dataset.ctOnCancel) window[ov.dataset.ctOnCancel] && window[ov.dataset.ctOnCancel](); } return; }

    /* 菜单触发器：data-ct-menu="#menuId" */
    var menuBtn = t.closest("[data-ct-menu]");
    if (menuBtn) {
      var menu = document.querySelector(menuBtn.dataset.ctMenu);
      var wasOpen = menu.classList.contains("is-open");
      closeAllMenus();
      if (!wasOpen) {
        menu.classList.add("is-open");
        if (menuBtn.dataset.ctMenuPos === "right") {
          menu.style.top = menuBtn.getBoundingClientRect().bottom - window.scrollY + 4 + "px";
          menu.style.left = Math.max(8, menuBtn.getBoundingClientRect().right - menu.offsetWidth) + "px";
        }
      }
      e.stopPropagation();
      return;
    }
    if (!t.closest(".ct-menu")) closeAllMenus();
  });

  /* ---------- 选项组：容器 [data-ct-options]；带 data-ct-toggle 时可反选（复选语义） ---------- */
  document.querySelectorAll("[data-ct-options]").forEach(function (group) {
    group.addEventListener("click", function (e) {
      var opt = e.target.closest(".ct-option");
      if (!opt || opt.classList.contains("is-disabled")) return;
      if (opt.classList.contains("is-selected") && group.hasAttribute("data-ct-toggle")) {
        opt.classList.remove("is-selected");
      } else {
        group.querySelectorAll(".ct-option").forEach(function (o) { o.classList.remove("is-selected"); });
        opt.classList.add("is-selected");
      }
      group.dispatchEvent(new CustomEvent("ct:change", { detail: opt }));
    });
  });
})();
