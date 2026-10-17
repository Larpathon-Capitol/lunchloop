"use strict";

const params = new URLSearchParams(location.search);
const API = (params.get("api") || window.LUNCHLOOP_API || "http://127.0.0.1:8000").replace(/\/$/, "");
const view = document.getElementById("view");
const $ = (html) => Object.assign(document.createElement("div"), { innerHTML: html.trim() }).firstElementChild;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const device = (() => {
  try {
    let id = localStorage.getItem("ll-device");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("ll-device", id); }
    return id;
  } catch { return "anon-" + Math.random().toString(36).slice(2, 12); }
})();

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
const nice = (id) => id.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const money = (n) => "$" + Math.round(n).toLocaleString();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const EMOJI = {
  cheese_pizza: "🍕", beef_nachos: "🌮", chicken_nuggets: "🍗", cheeseburger: "🍔", popcorn_chicken: "🍿",
  spicy_chicken_sandwich: "🥪", dinner_roll: "🥖", brown_rice: "🍚", steamed_carrots: "🥕", broccoli: "🥦",
  fruit_cup: "🍓", mandarin_oranges: "🍊", chocolate_milk: "🍫", milk_1pct: "🥛",
};
const icon = (id) => EMOJI[id] || "🍽️";
const REEL = ["🍕", "🌮", "🍗", "🍔", "🥪", "🍿", "🥗", "🍎", "🥕", "🍓", "🌯", "🍝"];

/* number that eases to its target */
function countTo(el, to, { dur = 900, fmt = (n) => Math.round(n).toLocaleString() } = {}) {
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

function mount(el) { el.classList.add("view"); view.replaceChildren(el); return el; }
function message(text) { mount($(`<div class="msg">${esc(text)}</div>`)); }
function loading() { mount($(`<div><div class="sk" style="height:60px;width:60%"></div><div class="sk"></div><div class="sk"></div></div>`)); }

/* ---------- student ---------- */

async function student() {
  loading();
  let me, spin, health;
  try {
    [health, me, spin] = await Promise.all([
      api("/health"), api(`/me?device=${device}`),
      api(`/spin?device=${device}`).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
    ]);
  } catch { return message("Can't reach LunchLoop."); }

  const root = mount($(`<section>
    <div><div class="eyebrow">${longDate(health.today)}</div><h1>What's for <span class="grad">lunch?</span></h1></div>
    <div class="me glass"></div>
    <div class="spin-zone"></div>
    <div class="guess"></div>
  </section>`));

  const meBox = root.querySelector(".me");
  function drawMe(m) {
    const frac = m.streak ? Math.min(1, (m.streak % 7 || 7) / 7) : 0;
    meBox.innerHTML = `
      <div class="ring"><svg viewBox="0 0 104 104"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="#ff7a59"/></linearGradient></defs>
        <circle class="tr" cx="52" cy="52" r="46"/><circle class="pr" cx="52" cy="52" r="46"/></svg><b>0</b></div>
      <div class="col"><div><div class="xp">0</div><div class="lab">XP</div></div>
      ${m.badges.length ? `<div class="pills">${m.badges.map((b) => `<span class="pill">${esc(nice(b))}</span>`).join("")}</div>` : ""}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      meBox.querySelector(".pr").style.strokeDashoffset = 289 * (1 - frac);
      countTo(meBox.querySelector(".ring b"), m.streak, { dur: 1100 });
      countTo(meBox.querySelector(".xp"), m.xp, { dur: 1100 });
    }));
  }
  drawMe(me);

  const zone = root.querySelector(".spin-zone");
  if (!spin) zone.append($(`<div class="msg">No voting today.</div>`));
  else if (spin.already_voted) done(zone);
  else offer(zone, spin);

  guessSection(root.querySelector(".guess"), me, health.today);

  function done(zone) {
    zone.replaceChildren($(`<div class="done"><div class="eyebrow">Vote in</div><h1>See you <span class="grad">tomorrow.</span></h1></div>`));
  }

  function offer(zone, spin) {
    const cta = $(`<button class="cta" aria-label="Spin">Spin</button>`);
    zone.replaceChildren(cta);
    cta.onclick = () => reveal(zone, spin);
  }

  async function reveal(zone, spin) {
    const label = $(`<div class="eyebrow" style="margin:0 0 12px;text-align:center">${dayName(spin.target_date)}'s ${esc(spin.target_slot)}</div>`);
    const grid = $(`<div class="reels"></div>`);
    zone.replaceChildren(label, grid);
    const H = 84, N = 22;
    const opts = spin.options.map((o, i) => {
      const faces = Array.from({ length: N - 1 }, () => REEL[Math.floor(Math.random() * REEL.length)]).concat(icon(o.item_id));
      const el = $(`<button class="opt glass" disabled><div class="win"><div class="strip">${faces.map((f) => `<span>${f}</span>`).join("")}</div></div>
        <div class="nm">${esc(o.name)}</div><div class="al">${esc(o.allergens.length ? o.allergens.join(" · ") : "")}</div>
        <i class="fill"></i><span class="pc"></span></button>`);
      grid.append(el); el._o = o; return el;
    });
    await wait(30);
    opts.forEach((el, i) => {
      const s = el.querySelector(".strip"), dur = reduced ? 1 : 1900 + i * 520;
      s.style.transition = `transform ${dur}ms cubic-bezier(.1,.75,.15,1), filter ${dur}ms`;
      s.style.transform = `translateY(${-(N - 1) * H}px)`;
      setTimeout(() => { s.classList.add("stop"); el.querySelector(".nm").classList.add("show"); el.disabled = false; }, dur - 250);
    });
    opts.forEach((el) => (el.onclick = async () => {
      opts.forEach((x) => (x.disabled = true));
      try {
        const r = await api("/vote", { device, item_id: el._o.item_id });
        const total = Object.values(r.tally).reduce((a, b) => a + b, 0) || 1;
        opts.forEach((x) => {
          const pct = Math.round(((r.tally[x._o.item_id] || 0) / total) * 100);
          x.classList.add("res", x._o.item_id === el._o.item_id ? "picked" : "dim");
          x.querySelector(".fill").style.height = pct + "%";
          countTo(x.querySelector(".pc"), pct, { fmt: (n) => Math.round(n) + "%" });
        });
        drawMe(await api(`/me?device=${device}`));
      } catch { done(zone); }
    }));
  }
}

async function guessSection(box, me, today) {
  const lg = me.last_guess;
  let next = null;
  for (let i = 1; i <= 5 && !next; i++) {
    const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() + i);
    next = await api(`/prep?date=${d.toISOString().slice(0, 10)}`).catch(() => null);
  }
  if (!next) return;
  const options = next.items.filter((i) => i.component === "meat_alternate");
  if (!options.length) return;
  const wrap = $(`<div><h2>Call it · ${dayName(next.date)}</h2><div class="calls"></div></div>`);
  const list = wrap.querySelector(".calls");
  const mark = (id) => list.querySelectorAll(".call").forEach((b) => { b.disabled = true; b.classList.add(b._id === id ? "picked" : "dim"); });
  options.forEach((o) => {
    const b = $(`<button class="call glass"><span class="tile c-meat_alternate">${icon(o.item_id)}</span>${esc(o.name)}</button>`);
    b._id = o.item_id;
    b.onclick = async () => { mark(o.item_id); try { await api("/guess", { device, item_id: o.item_id }); } catch {} };
    list.append(b);
  });
  box.replaceChildren(wrap);
  if (lg && lg.target_date === next.date) mark(lg.item_id);
}

/* ---------- kitchen ---------- */

const ORDER = ["meat_alternate", "grain", "vegetable", "fruit", "milk"];

function chart(series) {
  const by = {};
  series.forEach((r) => {
    const d = (by[r.date] ||= { a: 0, b: 0 });
    d.a += Math.max(0, r.prep_usual - r.taken); d.b += Math.max(0, r.prep_lunchloop - r.taken);
  });
  const days = Object.keys(by).sort(), W = 600, Hh = 150;
  const max = Math.max(...days.map((d) => Math.max(by[d].a, by[d].b))) || 1;
  const pts = (k) => days.map((d, i) => [(i / Math.max(1, days.length - 1)) * W, Hh - (by[d][k] / max) * (Hh - 12) - 4]);
  const path = (p) => p.map(([x, y], i) => {
    if (!i) return `M${x},${y}`;
    const [px, py] = p[i - 1], cx = (px + x) / 2;
    return `C${cx},${py} ${cx},${y} ${x},${y}`;
  }).join(" ");
  const pb = pts("b"), pa = pts("a");
  return `<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" height="150">
    <defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient>
    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <path class="ar" d="${path(pb)} L${W},${Hh} L0,${Hh} Z"/>
    <path class="ln a" pathLength="1" d="${path(pa)}" vector-effect="non-scaling-stroke"/>
    <path class="ln b" pathLength="1" d="${path(pb)}" vector-effect="non-scaling-stroke"/></svg>`;
}

async function kitchen() {
  loading();
  let prep, savings;
  try { [prep, savings] = await Promise.all([api("/prep"), api("/savings")]); }
  catch { return message("Can't reach LunchLoop."); }

  const saved = savings.usual.dollars_wasted - savings.lunchloop.dollars_wasted;
  const root = mount($(`<section>
    <div><div class="eyebrow">${longDate(prep.date)}</div>
    <div class="total grad" style="margin-top:10px"><span class="tn">0</span><small>servings to cook</small></div></div>
    <div class="dial glass"><input type="range" min="80" max="120" value="100" aria-label="Attendance"><output></output></div>
    <div class="lists"></div>
    <h2>Last 4 weeks</h2>
    <div class="stats">
      <div class="stat glass"><div class="v grad" data-to="${savings.leftover_cut_pct}">0%</div><div class="l">fewer leftovers</div></div>
      <div class="stat glass"><div class="v grad" data-to="${saved}">$0</div><div class="l">food saved</div></div>
    </div>
    <div class="chart glass">${chart(savings.series)}<div class="key"><span><i class="b"></i>LunchLoop</span><span><i></i>Usual</span></div></div>
  </section>`));

  const totalEl = root.querySelector(".total"), out = root.querySelector("output"), slider = root.querySelector("input");
  const tnum = totalEl.querySelector(".tn");

  const lists = root.querySelector(".lists"), rows = {};
  const groups = ORDER.map((c) => prep.items.filter((i) => i.component === c)).filter((a) => a.length);
  groups.forEach((items) => {
    const g = $(`<div class="glass grp" style="margin-top:12px"></div>`);
    items.forEach((i) => {
      const r = $(`<button class="row"><i class="bg"></i><span class="tile c-${i.component}">${icon(i.item_id)}</span>
        <span class="tx"><div class="n">${esc(i.name)}</div><div class="why">${esc(i.reason)}</div></span><span class="num">0</span></button>`);
      r.onclick = () => r.classList.toggle("open");
      g.append(r); rows[i.item_id] = r;
    });
    lists.append(g);
  });

  const fillSlider = () => slider.style.setProperty("--p", ((slider.value - slider.min) / (slider.max - slider.min)) * 100 + "%");
  function update(data, dur = 800) {
    const max = Math.max(...data.items.map((i) => i.prep)) || 1;
    let sum = 0;
    data.items.forEach((i) => {
      sum += i.prep; const r = rows[i.item_id]; if (!r) return;
      countTo(r.querySelector(".num"), i.prep, { dur });
      r.querySelector(".bg").style.transform = `scaleX(${i.prep / max})`;
      r.querySelector(".why").textContent = i.reason;
    });
    countTo(tnum, sum, { dur: dur + 300 });
    countTo(out, data.attendance, { dur });
  }
  fillSlider(); update(prep, 1300);
  root.querySelectorAll(".stat .v").forEach((el) => {
    const to = +el.dataset.to, money_ = el.textContent.startsWith("$");
    countTo(el, to, { dur: 1600, fmt: (n) => (money_ ? money(n) : n.toFixed(1) + "%") });
  });

  let timer, seq = 0;
  slider.oninput = () => {
    fillSlider();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        const r = await api("/simulate", { date: prep.date, attendance_multiplier: slider.value / 100, price_multiplier: 1.0, ratio: 3.0 });
        if (mine === seq) update(r, 450);
      } catch {}
    }, 90);
  };
}

/* ---------- router ---------- */

function place() {
  const on = document.querySelector(".seg a.on"), t = document.querySelector(".thumb");
  t.style.width = on.offsetWidth + "px";
  t.style.transform = `translateX(${on.offsetLeft - 2}px)`;
}
function route() {
  const tab = location.hash.startsWith("#/kitchen") ? "kitchen" : "student";
  document.querySelectorAll(".seg a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  place();
  (tab === "kitchen" ? kitchen : student)();
}
addEventListener("hashchange", route);
addEventListener("resize", place);
document.fonts.ready.then(route);
