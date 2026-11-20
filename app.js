"use strict";
const $ = s => document.querySelector(s);
const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const DEFAULTS = [
  { t: "Wikipedia", u: "https://en.wikipedia.org/" },
  { t: "Internet Archive", u: "https://archive.org/" },
  { t: "OpenStreetMap", u: "https://www.openstreetmap.org/" },
  { t: "Project Gutenberg", u: "https://www.gutenberg.org/" },
  { t: "Desmos", u: "https://www.desmos.com/calculator" },
  { t: "MDN Web Docs", u: "https://developer.mozilla.org/" }
];

let bm = ls.get("portal.bm", []);
let hist = ls.get("portal.hist", []);
let stack = [{ home: true }], pos = 0, timer = null, tab = "bm";
const frame = $("#frame"), url = $("#url");
const cur = () => stack[pos];

/* ---------- helpers ---------- */
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }

function resolve(v) {
  v = v.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return { u: v };
  if (/^[^\s/]+\.[a-z]{2,}(?:[/?#]\S*)?$/i.test(v)) return { u: "https://" + v };
  return { u: "https://duckduckgo.com/?q=" + encodeURIComponent(v), search: true, q: v };
}

function show(view) {
  ["home", "frame", "notice"].forEach(id => { $("#" + id).hidden = id !== view; });
}
const setLoading = on => { $("#load").hidden = !on; };

function fail(title, msg) {
  clearTimeout(timer);
  setLoading(false);
  $("#hint").hidden = true;
  $("#nt").textContent = title;
  $("#nm").textContent = msg;
  show("notice");
}

/* ---------- navigation ---------- */
function render() {
  const e = cur();
  clearTimeout(timer);
  $("#hint").hidden = true;
  if (e.home) {
    frame.src = "about:blank";
    setLoading(false);
    url.value = "";
    renderGrid();
    show("home");
  } else if (!navigator.onLine) {
    url.value = e.u;
    fail("You’re offline", "Reconnect to the internet, then reload this page.");
  } else if (e.search) {
    url.value = e.q;
    fail("Search results open in a new tab", "Search engines don’t allow other sites to embed them. Open the results in a new tab.");
  } else {
    url.value = e.u;
    show("frame");
    setLoading(true);
    frame.src = e.u;
    timer = setTimeout(() => { setLoading(false); $("#hint").hidden = false; }, 10000);
  }
  sync();
}

function go(input) {
  const r = resolve(input);
  if (!r) return;
  stack = stack.slice(0, pos + 1);
  stack.push(r);
  pos = stack.length - 1;
  hist = [{ t: r.search ? "Search: " + r.q : host(r.u), u: r.search ? r.q : r.u }, ...hist.filter(h => h.u !== (r.search ? r.q : r.u))].slice(0, 200);
  ls.set("portal.hist", hist);
  render();
}

function goHome() {
  if (cur().home) return;
  stack = stack.slice(0, pos + 1);
  stack.push({ home: true });
  pos = stack.length - 1;
  render();
}

frame.addEventListener("load", () => {
  if (cur().home || cur().search || frame.src === "about:blank") return;
  clearTimeout(timer);
  setLoading(false);
  $("#hint").hidden = false;
});

function sync() {
  $("#back").disabled = pos <= 0;
  $("#fwd").disabled = pos >= stack.length - 1;
  const e = cur(), saved = !e.home && !e.search && bm.some(b => b.u === e.u);
  $("#star").textContent = saved ? "★" : "☆";
  $("#star").classList.toggle("on", saved);
  if ($("#drawer").classList.contains("open")) renderList();
}

/* ---------- bookmarks ---------- */
function toggleBookmark() {
  const e = cur();
  if (e.home || e.search) return;
  bm = bm.some(b => b.u === e.u) ? bm.filter(b => b.u !== e.u) : [{ t: host(e.u), u: e.u }, ...bm];
  ls.set("portal.bm", bm);
  sync();
}

function renderGrid() {
  const g = $("#grid");
  g.replaceChildren();
  (bm.length ? bm : DEFAULTS).slice(0, 12).forEach(s => {
    const b = document.createElement("button");
    b.className = "tile";
    const i = document.createElement("b");
    i.textContent = (s.t[0] || "?").toUpperCase();
    const n = document.createElement("span");
    n.textContent = s.t;
    b.append(i, n);
    b.onclick = () => go(s.u);
    g.append(b);
  });
}

/* ---------- drawer ---------- */
function renderList() {
  const ul = $("#list"), items = tab === "bm" ? bm : hist;
  ul.replaceChildren();
  $("#clear").hidden = tab !== "hist" || !hist.length;
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = tab === "bm" ? "No bookmarks yet. Select the star in the address bar to save a page." : "Pages you open will show up here.";
    ul.append(li);
    return;
  }
  items.forEach(it => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.className = "row";
    const t = document.createElement("b"), s = document.createElement("small");
    t.textContent = it.t; s.textContent = it.u;
    b.append(t, s);
    b.onclick = () => { go(it.u); toggleDrawer(false); };
    const x = document.createElement("button");
    x.className = "ic"; x.textContent = "✕"; x.setAttribute("aria-label", "Remove");
    x.onclick = () => {
      if (tab === "bm") { bm = bm.filter(v => v.u !== it.u); ls.set("portal.bm", bm); }
      else { hist = hist.filter(v => v.u !== it.u); ls.set("portal.hist", hist); }
      sync(); renderList(); if (cur().home) renderGrid();
    };
    li.append(b, x);
    ul.append(li);
  });
}

function toggleDrawer(open) {
  $("#drawer").classList.toggle("open", open);
  $("#drawer").setAttribute("aria-hidden", String(!open));
  $("#scrim").hidden = !open;
  if (open) renderList();
}

function setTab(t) {
  tab = t;
  $("#t-bm").classList.toggle("on", t === "bm");
  $("#t-hist").classList.toggle("on", t === "hist");
  renderList();
}

/* ---------- theme ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  ls.set("portal.theme", t);
}
setTheme(ls.get("portal.theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

/* ---------- wiring ---------- */
$("#form").onsubmit = e => { e.preventDefault(); go(url.value); url.blur(); };
$("#home-form").onsubmit = e => { e.preventDefault(); go($("#home-q").value); $("#home-q").value = ""; };
$("#back").onclick = () => { if (pos > 0) { pos--; render(); } };
$("#fwd").onclick = () => { if (pos < stack.length - 1) { pos++; render(); } };
$("#reload").onclick = render;
$("#home-btn").onclick = goHome;
$("#star").onclick = toggleBookmark;
$("#theme").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
$("#menu").onclick = () => toggleDrawer(true);
$("#d-close").onclick = $("#scrim").onclick = () => toggleDrawer(false);
$("#t-bm").onclick = () => setTab("bm");
$("#t-hist").onclick = () => setTab("hist");
$("#clear").onclick = () => { hist = []; ls.set("portal.hist", hist); renderList(); };
const openNew = () => { const e = cur(); if (!e.home) window.open(e.search ? resolve(e.q).u : e.u, "_blank", "noopener"); };
$("#n-open").onclick = $("#h-open").onclick = openNew;
$("#n-home").onclick = goHome;
$("#h-close").onclick = () => { $("#hint").hidden = true; };
addEventListener("keydown", e => {
  if (e.key === "Escape") toggleDrawer(false);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") { e.preventDefault(); url.focus(); url.select(); }
});
addEventListener("online", () => { if (!cur().home) render(); });

render();
