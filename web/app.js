"use strict";

const params = new URLSearchParams(location.search);
const API = (params.get("api") || window.LUNCHLOOP_API || "http://127.0.0.1:8000").replace(/\/$/, "");
const view = document.getElementById("view");
const $ = (html) => Object.assign(document.createElement("div"), { innerHTML: html.trim() }).firstElementChild;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

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

const fmtDate = (iso, opts) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", opts);
const dayName = (iso) => fmtDate(iso, { weekday: "long" });
const longDate = (iso) => fmtDate(iso, { weekday: "long", month: "long", day: "numeric" });
const nice = (id) => id.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const money = (n) => "$" + Math.round(n).toLocaleString();
const ALLERGEN = (a) => (a.length ? a.join(", ") : "No listed allergens");

function mount(el) { el.classList.add("view"); view.replaceChildren(el); return el; }
function message(text) { mount($(`<div class="msg">${esc(text)}</div>`)); }

/* ---------- student ---------- */

async function student() {
  let me, spin, health;
  try { [health, me, spin] = await Promise.all([api("/health"), api(`/me?device=${device}`), api(`/spin?device=${device}`).catch((e) => (e.status === 404 ? null : Promise.reject(e)))]); }
  catch { return message("Can't reach LunchLoop."); }

  const root = mount($(`<section>
    <div class="eyebrow">${longDate(health.today)}</div>
    <h1>What's for lunch?</h1>
    <div class="stats"></div>
    <div class="slot"></div>
    <div class="guess"></div>
  </section>`));

  const stats = (m) => {
    const box = root.querySelector(".stats");
    box.innerHTML = `<div class="stat"><b>${m.streak}</b><span>day streak</span></div><div class="stat"><b>${m.xp}</b><span>XP</span></div>`;
    if (m.badges.length) box.insertAdjacentHTML("afterend", `<div class="pills">${m.badges.map((b) => `<span class="pill">${esc(nice(b))}</span>`).join("")}</div>`);
  };
  stats(me);

  const slot = root.querySelector(".slot");
  if (!spin) slot.append($(`<div class="msg">No voting today.</div>`));
  else if (spin.already_voted) showResults(slot, spin, null, null);
  else showSpin(slot, spin);

  guessSection(root.querySelector(".guess"), me, health.today);

  function showSpin(slot, spin) {
    slot.replaceChildren($(`<div class="hero"><button class="cta">Spin</button></div>`));
    slot.querySelector(".cta").onclick = () => {
      const stack = $(`<div class="stack"></div>`);
      slot.replaceChildren($(`<div class="eyebrow" style="margin:28px 0 12px">${dayName(spin.target_date)}'s ${esc(spin.target_slot)}</div>`), stack);
      spin.options.forEach((o, i) => {
        const b = $(`<button class="card cascade" style="animation-delay:${i * 140}ms"><div class="name">${esc(o.name)}</div><div class="sub">${esc(ALLERGEN(o.allergens))}</div></button>`);
        b.onclick = async () => {
          stack.querySelectorAll("button").forEach((x) => (x.disabled = true));
          try {
            const r = await api("/vote", { device, item_id: o.item_id });
            showResults(slot, spin, o.item_id, r.tally);
            const m = await api(`/me?device=${device}`); root.querySelector(".pills")?.remove(); stats(m);
          } catch { showResults(slot, spin, null, null); }
        };
        stack.append(b);
      });
    };
  }

  async function showResults(slot, spin, picked, tally) {
    if (!tally) {
      // already voted earlier: tally is only returned by a vote, so show a quiet confirmation
      slot.replaceChildren($(`<div class="hero"><div class="eyebrow">Your vote is in</div><h1>See you tomorrow.</h1></div>`));
      return;
    }
    const total = Object.values(tally).reduce((a, b) => a + b, 0) || 1;
    const stack = $(`<div class="stack"></div>`);
    slot.replaceChildren($(`<div class="eyebrow" style="margin:28px 0 12px">${dayName(spin.target_date)}'s ${esc(spin.target_slot)}</div>`), stack);
    spin.options.forEach((o) => {
      const pct = Math.round(((tally[o.item_id] || 0) / total) * 100);
      const c = $(`<div class="card ${o.item_id === picked ? "picked" : "dim"}"><i class="bar-fill"></i><div class="name">${esc(o.name)}</div><div class="pct">${pct}%</div></div>`);
      stack.append(c);
      requestAnimationFrame(() => requestAnimationFrame(() => (c.querySelector(".bar-fill").style.width = pct + "%")));
    });
  }
}

async function guessSection(box, me, today) {
  const lg = me.last_guess;
  let next = null;
  for (let i = 1; i <= 5 && !next; i++) {
    const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    next = await api(`/prep?date=${iso}`).catch(() => null);
  }
  if (!next) return;
  const options = next.items.filter((i) => i.component === "meat_alternate");
  if (!options.length) return;
  const head = `<h2>Call it · ${dayName(next.date)}</h2>`;
  const done = (id) => box.replaceChildren($(`<div>${head}<div class="card"><div class="name">${esc(options.find((o) => o.item_id === id)?.name || nice(id))}</div><div class="sub">Your pick</div></div></div>`));
  if (lg && lg.target_date === next.date) return done(lg.item_id);
  const wrap = $(`<div>${head}<div class="stack"></div></div>`);
  options.forEach((o) => {
    const b = $(`<button class="card"><div class="name">${esc(o.name)}</div></button>`);
    b.onclick = async () => { try { await api("/guess", { device, item_id: o.item_id }); } catch {} done(o.item_id); };
    wrap.querySelector(".stack").append(b);
  });
  box.replaceChildren(wrap);
}

/* ---------- kitchen ---------- */

const ORDER = ["meat_alternate", "grain", "vegetable", "fruit", "milk"];
const LABEL = { meat_alternate: "Entrees", grain: "Grains", vegetable: "Vegetables", fruit: "Fruit", milk: "Milk" };

async function kitchen() {
  let prep, meter, savings;
  try { [prep, meter, savings] = await Promise.all([api("/prep"), api("/meter"), api("/savings")]); }
  catch { return message("Can't reach LunchLoop."); }

  const root = mount($(`<section>
    <div class="eyebrow">${longDate(prep.date)}</div>
    <h1>Cook this much.</h1>
    <div class="slider"><input type="range" min="80" max="120" value="100" aria-label="Attendance"><output>${prep.attendance.toLocaleString()}</output></div>
    <div class="lists"></div>
    <h2>Last 4 weeks</h2>
    <div class="big">
      <div class="card"><div class="v good">${savings.leftover_cut_pct}%</div><div class="l">fewer leftovers</div></div>
      <div class="card"><div class="v good">${money(savings.usual.dollars_wasted - savings.lunchloop.dollars_wasted)}</div><div class="l">food saved</div></div>
    </div>
  </section>`));

  const slider = root.querySelector("input"), out = root.querySelector("output"), lists = root.querySelector(".lists");
  const draw = (data, animate) => {
    out.textContent = data.attendance.toLocaleString();
    const groups = ORDER.map((c) => [c, data.items.filter((i) => i.component === c)]).filter(([, a]) => a.length);
    lists.innerHTML = groups.map(([c, items]) => `<h2>${LABEL[c]}</h2><div class="group">${items.map((i) => `
      <div class="row"><div><div class="n">${esc(i.name)}</div><div class="why">${esc(i.reason)}</div></div><div class="num" data-prep="${i.prep}">${i.prep}</div></div>`).join("")}</div>`).join("");
  };
  draw(prep);

  let timer, seq = 0;
  slider.oninput = () => {
    const m = slider.value / 100;
    out.textContent = Math.round(prep.attendance * m).toLocaleString();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        const r = await api("/simulate", { date: prep.date, attendance_multiplier: m, price_multiplier: 1.0, ratio: 3.0 });
        if (mine === seq) draw(r);
      } catch {}
    }, 120);
  };
}

/* ---------- router ---------- */

function route() {
  const tab = location.hash.startsWith("#/kitchen") ? "kitchen" : "student";
  const links = document.querySelectorAll(".seg a"), thumb = document.querySelector(".thumb");
  links.forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  const on = document.querySelector(".seg a.on");
  thumb.style.width = on.offsetWidth + "px";
  thumb.style.transform = `translateX(${on.offsetLeft - 2}px)`;
  (tab === "kitchen" ? kitchen : student)();
}
addEventListener("hashchange", route);
addEventListener("resize", () => { const on = document.querySelector(".seg a.on"), t = document.querySelector(".thumb"); t.style.width = on.offsetWidth + "px"; t.style.transform = `translateX(${on.offsetLeft - 2}px)`; });
document.fonts.ready.then(route);
