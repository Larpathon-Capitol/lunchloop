"use strict";

const params = new URLSearchParams(location.search);
const API = (params.get("api") || window.LUNCHLOOP_API || "http://127.0.0.1:8000").replace(/\/$/, "");
const view = document.getElementById("view");
const $ = (html) => Object.assign(document.createElement("div"), { innerHTML: html.trim() }).firstElementChild;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* storage that never throws */
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* demo students: each has its own device, so each can vote and guess */
const PEOPLE = ["Maya", "Liam", "Zoe", "Ethan"];
const browserId = (() => {
  let id = store.get("ll-browser");
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/[^a-z0-9-]/gi, "").slice(0, 24); store.set("ll-browser", id); }
  return id;
})();
let person = PEOPLE.includes(store.get("ll-person")) ? store.get("ll-person") : PEOPLE[0];
const deviceOf = (name) => `ll-${name.toLowerCase()}-${browserId}`;

async function api(path, body) {
  const res = await fetch(API + "/api" + path, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "error"), { status: res.status });
  return data;
}

const fmtDate = (iso, o) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", o);
const dayName = (iso) => fmtDate(iso, { weekday: "long" });
const longDate = (iso) => fmtDate(iso, { weekday: "long", month: "long", day: "numeric" });
const money = (n) => "$" + Math.round(n).toLocaleString();
const plural = (n, w) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
const CHECK = `<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>`;

function countTo(el, to, { dur = 800, fmt = (n) => Math.round(n).toLocaleString() } = {}) {
  const from = el._v ?? 0; el._v = to;
  if (reduced || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(); cancelAnimationFrame(el._raf);
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}
const nextFrame = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

/* segmented control with a sliding thumb */
function seg(el, items, active, onPick) {
  el.innerHTML = items.map((i) => `<button data-k="${esc(i.k)}" class="${i.k === active ? "on" : ""}">${esc(i.label)}</button>`).join("") + `<i class="thumb"></i>`;
  el.querySelectorAll("button").forEach((b) => (b.onclick = () => { if (b.dataset.k !== active) onPick(b.dataset.k); }));
  placeThumb(el);
}
function placeThumb(el) {
  const on = el.querySelector(".on"), t = el.querySelector(".thumb");
  if (!on || !t || !on.offsetWidth) return;
  t.style.width = on.offsetWidth + "px";
  t.style.transform = `translateX(${on.offsetLeft - 3}px)`;
  requestAnimationFrame(() => el.classList.add("ready"));
}

function mount(el) { view.replaceChildren(el); return el; }
function message(text) { mount($(`<div class="msg">${esc(text)}</div>`)); }
function loading() { mount($(`<div><div class="sk" style="height:56px;width:50%"></div><div class="sk"></div><div class="sk"></div></div>`)); }

/* ---------- vote ---------- */

async function voteView() {
  const mine = person, device = deviceOf(mine);
  loading();
  let health, me, spin;
  try {
    [health, me, spin] = await Promise.all([
      api("/health"), api(`/me?device=${device}`),
      api(`/spin?device=${device}`).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
    ]);
  } catch { return message("Can't reach LunchLoop."); }
  if (mine !== person) return;

  const chip = (m) => (m.xp || m.streak ? `<span class="chip">${plural(m.streak, "day")} streak · ${m.xp} XP</span>` : "");
  const root = mount($(`<section>
    <div class="head"><div><h1></h1><p class="sub"></p></div><span class="chipbox"></span></div>
    <div class="dishes"></div>
    <div class="guess"></div>
  </section>`));
  const setChip = (m) => (root.querySelector(".chipbox").innerHTML = chip(m));
  setChip(me);

  const h1 = root.querySelector("h1"), sub = root.querySelector(".sub"), list = root.querySelector(".dishes");
  if (!spin) {
    h1.textContent = "No voting today"; sub.textContent = longDate(health.today);
  } else {
    h1.textContent = `Pick ${dayName(spin.target_date)}'s ${spin.target_slot}`;
    sub.textContent = `Tap a dish to vote as ${mine}.`;
    const key = `ll-vote-${device}-${health.today}`;
    const cache = store.get(key);
    const dishes = spin.options.map((o) => {
      const el = $(`<button class="dish"><div class="top2"><div><div class="t">${esc(o.name)}</div>
        <div class="d">${o.allergens.length ? "Contains " + esc(o.allergens.join(", ")) : "No listed allergens"}</div></div>
        <span class="radio">${CHECK}</span></div>
        <div class="res"><div><div class="meta"><span class="n">0 votes</span><b class="p">0%</b></div><div class="track"><i></i></div></div></div></button>`);
      el._o = o; list.append(el); return el;
    });
    const show = (pickedId, tally) => {
      const total = Object.values(tally).reduce((a, b) => a + b, 0) || 1;
      dishes.forEach((el) => {
        const n = tally[el._o.item_id] || 0, pct = Math.round((n / total) * 100);
        el.classList.add("shown"); el.classList.toggle("on", el._o.item_id === pickedId);
        el.classList.add("locked"); el.onclick = null;
        nextFrame(() => (el.querySelector(".track i").style.width = pct + "%"));
        countTo(el.querySelector(".n"), n, { fmt: (v) => plural(Math.round(v), "vote") });
        countTo(el.querySelector(".p"), pct, { fmt: (v) => Math.round(v) + "%" });
      });
      sub.textContent = `Your vote is in, ${mine}.`;
    };
    if (spin.already_voted && cache) show(cache.item, cache.tally);
    else if (spin.already_voted) { sub.textContent = `${mine} already voted today.`; dishes.forEach((el) => el.classList.add("locked")); }
    else dishes.forEach((el) => (el.onclick = async () => {
      dishes.forEach((x) => (x.onclick = null));
      try {
        const r = await api("/vote", { device, item_id: el._o.item_id });
        store.set(key, { item: el._o.item_id, tally: r.tally });
        if (mine === person) { show(el._o.item_id, r.tally); setChip(await api(`/me?device=${device}`)); }
      } catch { if (mine === person) sub.textContent = "That didn't go through. Try again."; }
    }));
  }
  guess(root.querySelector(".guess"), me, health.today, device, mine);
}

async function guess(box, me, today, device, mine) {
  let next = null;
  for (let i = 1; i <= 5 && !next; i++) {
    const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() + i);
    next = await api(`/prep?date=${d.toISOString().slice(0, 10)}`).catch(() => null);
  }
  const options = next && next.items.filter((i) => i.component === "meat_alternate");
  if (!options || !options.length || mine !== person) return;
  const wrap = $(`<div><h2>Call it: most popular entree on ${dayName(next.date)}</h2><div class="dishes"></div></div>`);
  const list = wrap.querySelector(".dishes");
  const mark = (id) => list.querySelectorAll(".dish").forEach((b) => { b.classList.toggle("on", b._id === id); b.classList.add("locked"); b.onclick = null; });
  options.forEach((o) => {
    const b = $(`<button class="dish compact"><div class="top2"><div class="t">${esc(o.name)}</div><span class="radio">${CHECK}</span></div></button>`);
    b._id = o.item_id;
    b.onclick = async () => { mark(o.item_id); try { await api("/guess", { device, item_id: o.item_id }); } catch {} };
    list.append(b);
  });
  box.replaceChildren(wrap);
  const lg = me.last_guess;
  if (lg && lg.target_date === next.date) mark(lg.item_id);
}

/* ---------- admin ---------- */

const ORDER = ["meat_alternate", "grain", "vegetable", "fruit", "milk"];
const LABEL = { meat_alternate: "Entrees", grain: "Grains", vegetable: "Vegetables", fruit: "Fruit", milk: "Milk" };
let adminTab = "prep";

async function adminView() {
  loading();
  let prep, savings;
  try { [prep, savings] = await Promise.all([api("/prep"), api("/savings")]); }
  catch { return message("Can't reach LunchLoop."); }

  const root = mount($(`<section>
    <div class="head"><div><h1></h1><p class="sub"></p></div><nav class="seg tabs"></nav></div>
    <div class="body"></div>
  </section>`));
  const body = root.querySelector(".body"), tabs = root.querySelector(".tabs");
  const show = (k) => {
    adminTab = k;
    root.querySelector("h1").textContent = k === "prep" ? "Today's prep" : "Savings";
    root.querySelector(".sub").textContent = k === "prep" ? longDate(prep.date) : `Last ${savings.weeks} weeks`;
    seg(tabs, [{ k: "prep", label: "Prep" }, { k: "savings", label: "Savings" }], k, show);
    body.replaceChildren(k === "prep" ? prepPane(prep) : savingsPane(savings));
  };
  show(adminTab);
}

function prepPane(prep) {
  const el = $(`<div class="stack">
    <div class="card"><div class="hl"><div class="k">Total</div><div class="v"><span class="tot">0</span> servings</div><div class="s"></div></div>
      <div class="dial"><span class="sub" style="margin:0">Attendance</span><input type="range" min="80" max="120" value="100" aria-label="Attendance"><output></output></div>
      <div class="rows" style="margin-top:24px"></div></div>
    <div class="card"><div class="ct">Why these numbers</div><ul class="bul"></ul></div>
  </div>`);
  const rows = el.querySelector(".rows"), why = el.querySelector(".bul"), slider = el.querySelector("input"), out = el.querySelector("output");
  const refs = {};
  ORDER.forEach((c) => {
    const items = prep.items.filter((i) => i.component === c); if (!items.length) return;
    rows.append($(`<div class="grp">${LABEL[c]}</div>`));
    items.forEach((i) => {
      const r = $(`<div class="row"><div class="l"><span>${esc(i.name)}</span><span><span class="num">0</span><small>servings</small></span></div><div class="track"><i></i></div></div>`);
      rows.append(r);
      const li = $(`<li><b>${esc(i.name)}</b> · <span></span></li>`); why.append(li);
      refs[i.item_id] = { r, li };
    });
  });
  const fill = () => slider.style.setProperty("--p", ((slider.value - slider.min) / (slider.max - slider.min)) * 100 + "%");
  const update = (data, dur) => {
    const max = Math.max(...data.items.map((i) => i.prep)) || 1; let sum = 0;
    data.items.forEach((i) => {
      sum += i.prep; const x = refs[i.item_id]; if (!x) return;
      countTo(x.r.querySelector(".num"), i.prep, { dur });
      x.r.querySelector(".track i").style.width = (i.prep / max) * 100 + "%";
      x.li.querySelector("span").textContent = i.reason;
    });
    countTo(el.querySelector(".tot"), sum, { dur: dur + 200 });
    countTo(out, data.attendance, { dur, fmt: (n) => Math.round(n).toLocaleString() });
    el.querySelector(".hl .s").textContent = `for ${data.attendance.toLocaleString()} students`;
  };
  fill(); nextFrame(() => update(prep, 1000));
  let timer, seq = 0;
  slider.oninput = () => {
    fill(); clearTimeout(timer);
    timer = setTimeout(async () => {
      const mine = ++seq;
      try { const r = await api("/simulate", { date: prep.date, attendance_multiplier: slider.value / 100, price_multiplier: 1.0, ratio: 3.0 }); if (mine === seq) update(r, 450); } catch {}
    }, 90);
  };
  return el;
}

function chart(series) {
  const by = {};
  series.forEach((r) => {
    const d = (by[r.date] ||= { a: 0, b: 0 });
    d.a += Math.max(0, r.prep_usual - r.taken); d.b += Math.max(0, r.prep_lunchloop - r.taken);
  });
  const days = Object.keys(by).sort(), W = 600, H = 150;
  const max = Math.max(...days.map((d) => Math.max(by[d].a, by[d].b))) || 1;
  const pts = (k) => days.map((d, i) => [(i / Math.max(1, days.length - 1)) * W, H - (by[d][k] / max) * (H - 12) - 4]);
  const path = (p) => p.map(([x, y], i) => { if (!i) return `M${x},${y}`; const [px, py] = p[i - 1], cx = (px + x) / 2; return `C${cx},${py} ${cx},${y} ${x},${y}`; }).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path class="ln a" pathLength="1" d="${path(pts("a"))}" vector-effect="non-scaling-stroke"/>
    <path class="ln b" pathLength="1" d="${path(pts("b"))}" vector-effect="non-scaling-stroke"/></svg>`;
}

function savingsPane(s) {
  const saved = s.usual.dollars_wasted - s.lunchloop.dollars_wasted, n = (v) => Math.round(v).toLocaleString();
  const el = $(`<div class="stack">
    <div class="card"><div class="hl"><div class="k">Saved</div><div class="v"><span class="amt">$0</span></div><div class="s">${s.leftover_cut_pct}% fewer leftovers</div></div>
      <div class="chart">${chart(s.series)}<div class="key"><span><i class="b"></i>LunchLoop</span><span><i></i>Usual</span></div></div></div>
    <div class="card"><div class="ct">Details</div><ul class="bul">
      <li>Leftovers: <b>${n(s.lunchloop.leftover_servings)}</b> servings, against ${n(s.usual.leftover_servings)} usual.</li>
      <li>Food wasted: <b>${money(s.lunchloop.dollars_wasted)}</b>, against ${money(s.usual.dollars_wasted)} usual.</li>
      <li>Came up short: <b>${n(s.lunchloop.servings_short)}</b> servings. The usual amount never shows as short, because students can't take more than was cooked.</li>
    </ul></div></div>`);
  nextFrame(() => countTo(el.querySelector(".amt"), saved, { dur: 1300, fmt: money }));
  return el;
}

/* ---------- router ---------- */

function route() {
  const tab = location.hash.startsWith("#/admin") ? "admin" : "vote";
  const top = document.querySelector(".top"), modes = document.getElementById("modes"), people = document.getElementById("people");
  top.classList.toggle("admin", tab === "admin");
  people.style.display = tab === "admin" ? "none" : "";
  modes.querySelectorAll("a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  if (!modes.querySelector(".thumb")) modes.insertAdjacentHTML("beforeend", `<i class="thumb"></i>`);
  placeThumb(modes);
  if (tab === "vote") {
    seg(people, PEOPLE.map((p) => ({ k: p, label: p })), person, (k) => { person = k; store.set("ll-person", k); route(); });
    voteView();
  } else adminView();
}
addEventListener("hashchange", route);
addEventListener("resize", () => document.querySelectorAll(".seg").forEach(placeThumb));
document.fonts.ready.then(route);
