"""TrayTrack API: thin FastAPI wrapper around prediction.py for the React dashboard.

Run with:  uvicorn app:app --reload
Then open http://127.0.0.1:8000/docs for interactive testing.
"""
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from prediction import (load_data, plan_day, plan_month, summarize_history, mae_report,
                         compute_data_driven_buffers, validate_history, evaluate_methods,
                         SHORTAGE_PENALTY_MULTIPLIER)

app = FastAPI(title="TrayTrack API")

# Dev-friendly default: allow the React dev server to call this without extra config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

df = load_data()
# Computed once at startup (each is a walk-forward backtest over the whole history):
# BUFFERS feeds /plan and /plan/month; ACCURACY and DATA_QUALITY are their own endpoints.
BUFFERS = compute_data_driven_buffers(df)
ACCURACY = mae_report(df)
DATA_QUALITY_ISSUES = validate_history(df)


class MenuItem(BaseModel):
    food_item: str
    food_category: Optional[str] = None
    unit_cost: Optional[float] = None


class PlanRequest(BaseModel):
    expected_attendance: Optional[int] = None
    target_date: Optional[str] = None  # "YYYY-MM-DD"; used to estimate attendance if expected_attendance is omitted
    menu: Optional[List[MenuItem]] = None
    shortage_penalty_multiplier: float = SHORTAGE_PENALTY_MULTIPLIER


class MonthPlanRequest(BaseModel):
    year: int
    month: int  # 1-12
    menu: Optional[List[MenuItem]] = None
    shortage_penalty_multiplier: float = SHORTAGE_PENALTY_MULTIPLIER


@app.get("/health")
def health():
    return {"status": "ok", "history_rows": len(df)}


@app.get("/summary")
def summary():
    return {"days_in_history": int(df["date"].nunique()), "per_food": summarize_history(df)}


@app.get("/accuracy")
def accuracy():
    return ACCURACY


@app.get("/buffers")
def buffers():
    return BUFFERS


@app.get("/data-quality")
def data_quality():
    return {"issues": DATA_QUALITY_ISSUES, "clean": len(DATA_QUALITY_ISSUES) == 0}


@app.get("/", response_class=HTMLResponse)
def dashboard():
    return DASHBOARD_HTML


@app.post("/plan")
def plan(request: PlanRequest):
    if request.expected_attendance is None and request.target_date is None:
        raise HTTPException(status_code=400,
                             detail="Provide expected_attendance or target_date (or both).")
    menu = [item.model_dump() for item in request.menu] if request.menu else None
    return plan_day(df, expected_attendance=request.expected_attendance,
                     target_date=request.target_date, menu=menu, buffers_table=BUFFERS,
                     shortage_penalty_multiplier=request.shortage_penalty_multiplier)


@app.post("/plan/month")
def plan_month_endpoint(request: MonthPlanRequest):
    if not 1 <= request.month <= 12:
        raise HTTPException(status_code=400, detail="month must be 1-12.")
    menu = [item.model_dump() for item in request.menu] if request.menu else None
    return plan_month(df, request.year, request.month, menu=menu, buffers_table=BUFFERS,
                       shortage_penalty_multiplier=request.shortage_penalty_multiplier)


@app.get("/plan/sensitivity")
def plan_sensitivity(expected_attendance: int):
    """How sensitive the sample-day savings comparison is to the shortage penalty assumption
    (see calculate_costs() in prediction.py). Not a measured result -- shows the same day
    re-planned under several different, clearly-labeled assumptions side by side."""
    multipliers = [0.5, 1.0, 1.5, 2.0, 3.0]
    results = []
    for m in multipliers:
        plan_result = plan_day(df, expected_attendance=expected_attendance, buffers_table=BUFFERS,
                                shortage_penalty_multiplier=m)
        results.append({"shortage_penalty_multiplier": m, "totals": plan_result["totals"]})
    return {"expected_attendance": expected_attendance, "results": results,
            "note": "shortage_penalty_multiplier is a configurable ASSUMPTION (see /plan), not a "
                    "measured cost -- this shows how much the savings conclusion depends on it."}


@app.get("/evaluate")
def evaluate(shortage_penalty_multiplier: float = SHORTAGE_PENALTY_MULTIPLIER):
    """Leak-free walk-forward evaluation of baseline vs. LunchLoop, on the same held-out
    school days (see evaluate_methods() in prediction.py for the full methodology)."""
    return evaluate_methods(df, shortage_penalty_multiplier=shortage_penalty_multiplier)


DASHBOARD_HTML = """
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TrayTrack dashboard</title>
<style>
  :root {
    color-scheme: light;
    --surface-1: #fcfcfb; --page: #f9f9f7; --border: rgba(11,11,11,0.10);
    --text-primary: #0b0b0b; --text-secondary: #52514e; --text-muted: #898781;
    --grid: #e1e0d9; --axis: #c3c2b7;
    --series-1: #2a78d6; /* blue   - Cheese Pizza   */
    --series-2: #eb6834; /* orange - Chicken Nuggets*/
    --series-3: #1baf7a; /* aqua   - Popcorn Chicken*/
    --series-4: #eda100; /* yellow - Steamed Carrots*/
    --series-5: #e87ba4; /* magenta- Fruit Cup      */
    --series-6: #008300; /* green  - Chocolate Milk */
    --good: #006300; --warn-bg: #eda100;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-1: #1a1a19; --page: #0d0d0d; --border: rgba(255,255,255,0.10);
      --text-primary: #f0efec; --text-secondary: #c3c2b7; --text-muted: #898781;
      --grid: #2c2c2a; --axis: #383835;
      --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70;
      --series-4: #c98500; --series-5: #d55181; --series-6: #008300;
      --good: #0ca30c;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--text-primary);
         font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 32px 24px 64px; }
  .wrap { max-width: 920px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 0 0 2px; color: var(--text-primary); }
  .sub { color: var(--text-secondary); margin: 0 0 20px; font-size: 13px; }
  section { margin-top: 36px; }
  .card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px;
          padding: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 9px 10px; text-align: right; border-bottom: 1px solid var(--grid);
           font-variant-numeric: tabular-nums; }
  th:first-child, td:first-child { text-align: left; font-variant-numeric: normal; }
  th { color: var(--text-muted); font-weight: 500; font-size: 11px; text-transform: uppercase;
       letter-spacing: .03em; }
  tr:last-child td { border-bottom: none; }
  .bar-cell { position: relative; min-width: 120px; }
  .bar-track { position: relative; height: 16px; background: var(--grid); border-radius: 4px;
               overflow: hidden; }
  .bar-fill { position: absolute; inset: 0 auto 0 0; background: var(--series-1); border-radius: 4px; }
  .bar-fill.warn { background: var(--warn-bg); }
  .bar-label { position: absolute; inset: 0; display: flex; align-items: center;
               justify-content: center; font-size: 11px; color: var(--text-primary); }
  .note { color: var(--text-muted); font-size: 12.5px; margin-top: 14px; }
  .err { color: #d03b3b; }
  svg { display: block; }
  .axis-label, .tick-label { fill: var(--text-muted); font-size: 11px; }
  .gridline { stroke: var(--grid); stroke-width: 1; }
  .baseline { stroke: var(--axis); stroke-width: 1; }
  .tooltip { position: absolute; pointer-events: none; background: var(--surface-1);
             border: 1px solid var(--border); border-radius: 6px; padding: 6px 9px;
             font-size: 12px; color: var(--text-primary); box-shadow: 0 2px 10px rgba(0,0,0,.15);
             opacity: 0; transition: opacity .08s; white-space: nowrap; z-index: 5; }
  .chart-holder { position: relative; }
  .totals-line { display: flex; gap: 28px; margin-top: 10px; flex-wrap: wrap; }
  .totals-line div { font-size: 13px; color: var(--text-secondary); }
  .totals-line b { color: var(--text-primary); font-size: 15px; display: block; }
</style>
</head>
<body>
<div class="wrap">
  <h1>TrayTrack dashboard</h1>
  <p class="sub">Live from the (synthetic) CSV history &mdash; no static numbers below.</p>

  <section class="card">
    <h2>History at a glance</h2>
    <p class="sub" id="subtitle" style="margin-bottom:14px">Loading averages from the CSV&hellip;</p>
    <table id="table" style="display:none">
      <thead>
        <tr>
          <th>Food</th><th>Category</th><th>Days recorded</th>
          <th>Avg attendance</th><th>Avg prepared</th><th>Avg served</th>
          <th>Avg leftover</th><th>Leftover rate</th>
          <th>Safety buffer</th><th>Est. shortfall rate</th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
    <p class="note" id="buffer-note"></p>
  </section>

  <section class="card">
    <h2>Model accuracy (backtested)</h2>
    <p class="sub" id="accuracy-sub" style="margin-bottom:14px">Loading&hellip;</p>
    <div class="totals-line" id="accuracy-totals"></div>
    <p class="note" id="accuracy-note"></p>
  </section>

  <section class="card">
    <h2 id="month-title">Next month&rsquo;s prediction</h2>
    <p class="sub" id="month-sub" style="margin-bottom:14px">Loading&hellip;</p>
    <p class="note" id="month-range" style="margin-top:0"></p>

    <div class="chart-holder">
      <div id="attendance-chart"></div>
      <div class="tooltip" id="tt-attendance"></div>
    </div>

    <div class="totals-line" id="month-totals"></div>

    <div class="chart-holder" style="margin-top:28px">
      <div id="cost-chart"></div>
      <div class="tooltip" id="tt-cost"></div>
    </div>

    <table id="month-table" style="margin-top:20px; display:none">
      <thead>
        <tr>
          <th>Food</th><th>Predicted servings</th><th>Recommended prep</th>
          <th>Est. surplus (servings)</th><th>Est. shortage (servings)</th>
          <th>Est. plate waste (servings)</th>
          <th>LunchLoop total $</th><th>Baseline total $</th><th>Savings</th>
        </tr>
      </thead>
      <tbody id="month-rows"></tbody>
    </table>
    <p class="note" id="month-note"></p>
    <p class="note" id="month-assumptions"></p>
  </section>

  <p class="note">Visit <code>/docs</code> to call <code>/plan</code>, <code>/plan/month</code>,
  <code>/evaluate</code>, or <code>/plan/sensitivity</code> directly.</p>
</div>

<script>
const SERIES = ["--series-1","--series-2","--series-3","--series-4","--series-5","--series-6"];
function seriesColor(i) {
  return getComputedStyle(document.documentElement).getPropertyValue(SERIES[i % SERIES.length]).trim();
}
function fmtMoney(v) { return '$' + v.toFixed(2); }

async function loadHistory() {
  try {
    const [summaryRes, buffersRes] = await Promise.all([fetch('/summary'), fetch('/buffers')]);
    if (!summaryRes.ok) throw new Error('HTTP ' + summaryRes.status);
    const data = await summaryRes.json();
    const buffers = buffersRes.ok ? await buffersRes.json() : {};
    document.getElementById('subtitle').textContent =
      `Averages computed live from ${data.days_in_history} school days of history.`;

    const rows = data.per_food.slice().sort((a, b) => b.leftover_rate - a.leftover_rate);
    const tbody = document.getElementById('rows');
    for (const r of rows) {
      const pct = Math.round(r.leftover_rate * 100);
      const warn = pct >= 20 ? ' warn' : '';
      const buf = buffers[r.food_item];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.food_item}</td>
        <td>${r.food_category}</td>
        <td>${r.days_recorded}</td>
        <td>${r.avg_attendance}</td>
        <td>${r.avg_prepared}</td>
        <td>${r.avg_served}</td>
        <td>${r.avg_leftover}</td>
        <td class="bar-cell">
          <div class="bar-track">
            <div class="bar-fill${warn}" style="width:${Math.min(pct, 100)}%"></div>
            <div class="bar-label">${pct}%</div>
          </div>
        </td>
        <td>${buf ? Math.round(buf.buffer * 100) + '%' : '&mdash;'}</td>
        <td>${buf ? Math.round(buf.shortfall_rate_estimate * 100) + '%' : '&mdash;'}</td>`;
      tbody.appendChild(tr);
    }
    document.getElementById('table').style.display = '';
    document.getElementById('buffer-note').textContent =
      'Safety buffer and shortfall rate are backtested per food (walk-forward: each past day ' +
      'predicted using only earlier days), replacing a fixed 10%/15% guess -- "prepare for the ' +
      '90th percentile day" rather than a flat percentage. The shortfall rate is how often, in ' +
      'that backtest, even the buffered amount would still have run short.';
  } catch (e) {
    document.getElementById('subtitle').innerHTML =
      '<span class="err">Could not load /summary or /buffers: ' + e.message + '</span>';
  }
}

async function loadAccuracy() {
  try {
    const res = await fetch('/accuracy');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const a = await res.json();
    if (!a.old_method) {
      document.getElementById('accuracy-sub').textContent = 'Not enough history yet to backtest.';
      return;
    }
    const oldMae = a.old_method.overall_mae_servings_per_day;
    const newMae = a.new_method.overall_mae_servings_per_day;
    const change = Math.round((1 - newMae / oldMae) * 100);
    const changeLabel = change >= 0 ? 'error reduction' : 'error INCREASE';
    document.getElementById('accuracy-sub').textContent =
      `Walk-forward backtest over ${a.n_predictions} (day, food) predictions -- each one made ` +
      `using only data from before that day.`;
    document.getElementById('accuracy-totals').innerHTML = `
      <div><b>${oldMae.toFixed(1)}</b>old method: MAE (servings/day)</div>
      <div><b>${newMae.toFixed(1)}</b>current method: MAE (servings/day)</div>
      <div><b style="color:${change >= 0 ? 'var(--good)' : '#d03b3b'}">${Math.abs(change)}%</b>${changeLabel}</div>
      <div><b>${a.new_method.overall_mape_pct}%</b>current method: mean % error</div>`;
    document.getElementById('accuracy-note').innerHTML =
      '"old" = the original all-time-average method. "current" = same-weekday recent history ' +
      'when there is enough of it, falling back to a recent window then the all-time average, ' +
      'with sold-out days excluded from the rate estimate. See /accuracy for the per-food breakdown.' +
      (change < 0 ? ' <b>With only ~34 days of real history, "current" does not yet beat "old" '
        + '-- not enough data for the extra structure to pay off; that\\'s expected, not a bug.</b>' : '') +
      '<br><br><b style="color:#d03b3b">Caveat:</b> ' + a.circularity_caveat;
  } catch (e) {
    document.getElementById('accuracy-sub').innerHTML =
      '<span class="err">Could not load /accuracy: ' + e.message + '</span>';
  }
}

function lineChart(el, points, { width = 860, height = 220, pad = { t: 16, r: 16, b: 28, l: 40 } }) {
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const ys = points.map(p => p.y);
  const yMax = Math.ceil(Math.max(...ys) / 20) * 20 + 20;
  const yMin = Math.max(0, Math.floor(Math.min(...ys) / 20) * 20 - 20);
  const x = i => pad.l + (i / (points.length - 1)) * w;
  const y = v => pad.t + h - ((v - yMin) / (yMax - yMin)) * h;

  const gridTicks = 4;
  let gridSvg = '';
  for (let i = 0; i <= gridTicks; i++) {
    const v = yMin + (i / gridTicks) * (yMax - yMin);
    const gy = y(v);
    gridSvg += `<line class="gridline" x1="${pad.l}" x2="${width - pad.r}" y1="${gy}" y2="${gy}"/>`;
    gridSvg += `<text class="tick-label" x="${pad.l - 8}" y="${gy + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.y)}`).join(' ');
  const last = points[points.length - 1];
  const color = seriesColor(0);

  const dots = points.map((p, i) =>
    `<circle data-i="${i}" cx="${x(i)}" cy="${y(p.y)}" r="9" fill="transparent" class="hit"/>`
  ).join('');

  el.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
      ${gridSvg}
      <line class="baseline" x1="${pad.l}" x2="${width - pad.r}" y1="${pad.t + h}" y2="${pad.t + h}"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(points.length - 1)}" cy="${y(last.y)}" r="4" fill="${color}" stroke="var(--surface-1)" stroke-width="2"/>
      <text x="${x(points.length - 1) - 6}" y="${y(last.y) - 10}" text-anchor="end" fill="var(--text-primary)" font-size="12">${last.y}</text>
      ${dots}
    </svg>`;

  const tooltip = document.getElementById('tt-attendance');
  el.querySelectorAll('.hit').forEach(dot => {
    dot.addEventListener('mouseenter', () => {
      const p = points[+dot.dataset.i];
      tooltip.innerHTML = `<b>${p.label}</b><br>${p.y} expected attendance`;
      tooltip.style.opacity = 1;
      const r = el.getBoundingClientRect();
      tooltip.style.left = (dot.cx.baseVal.value / width * r.width) + 'px';
      tooltip.style.top = (dot.cy.baseVal.value / height * r.height - 44) + 'px';
    });
    dot.addEventListener('mouseleave', () => tooltip.style.opacity = 0);
  });
}

function barChart(el, bars, { width = 860, height = 240, pad = { t: 16, r: 16, b: 50, l: 48 } }) {
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const maxV = Math.max(...bars.map(b => b.value)) * 1.15;
  const slot = w / bars.length;
  const barW = Math.min(44, slot - 10);
  const y = v => pad.t + h - (v / maxV) * h;

  const gridTicks = 4;
  let gridSvg = '';
  for (let i = 0; i <= gridTicks; i++) {
    const v = (i / gridTicks) * maxV;
    const gy = y(v);
    gridSvg += `<line class="gridline" x1="${pad.l}" x2="${width - pad.r}" y1="${gy}" y2="${gy}"/>`;
    gridSvg += `<text class="tick-label" x="${pad.l - 8}" y="${gy + 4}" text-anchor="end">$${Math.round(v)}</text>`;
  }

  let barsSvg = '';
  bars.forEach((b, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const bx = cx - barW / 2;
    const by = y(b.value);
    const bh = pad.t + h - by;
    const color = seriesColor(i);
    barsSvg += `
      <rect data-i="${i}" x="${bx}" y="${by}" width="${barW}" height="${Math.max(bh, 1)}"
            rx="4" ry="4" fill="${color}" class="hit-bar"/>
      <text x="${cx}" y="${by - 8}" text-anchor="middle" font-size="11" fill="var(--text-primary)">${fmtMoney(b.value)}</text>
      <text x="${cx}" y="${pad.t + h + 18}" text-anchor="middle" class="tick-label">${b.label}</text>`;
  });

  el.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
      ${gridSvg}
      <line class="baseline" x1="${pad.l}" x2="${width - pad.r}" y1="${pad.t + h}" y2="${pad.t + h}"/>
      ${barsSvg}
    </svg>`;

  const tooltip = document.getElementById('tt-cost');
  el.querySelectorAll('.hit-bar').forEach(rect => {
    rect.addEventListener('mouseenter', () => {
      const b = bars[+rect.dataset.i];
      tooltip.innerHTML = `<b>${b.label}</b><br>${fmtMoney(b.value)} estimated surplus cost`;
      tooltip.style.opacity = 1;
      const r = el.getBoundingClientRect();
      tooltip.style.left = (rect.x.baseVal.value / width * r.width) + 'px';
      tooltip.style.top = (rect.y.baseVal.value / height * r.height - 36) + 'px';
    });
    rect.addEventListener('mouseleave', () => tooltip.style.opacity = 0);
  });
}

async function loadMonthPlan() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = next.getFullYear(), month = next.getMonth() + 1;
  const monthName = next.toLocaleString('en-US', { month: 'long' });
  document.getElementById('month-title').textContent = `${monthName} ${year} prediction`;

  try {
    const res = await fetch('/plan/month', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const plan = await res.json();

    if (plan.school_days === 0) {
      document.getElementById('month-sub').textContent = `No school days found in ${monthName} ${year}.`;
      return;
    }
    document.getElementById('month-sub').textContent =
      `${plan.school_days} predicted school days, each its own weekday-based attendance estimate (one /plan call per day, summed).`;
    document.getElementById('month-range').innerHTML =
      `<b>SYNTHETIC data.</b> Evaluation/forecast range: ${plan.daily_plans[0].date} to ` +
      `${plan.daily_plans[plan.daily_plans.length - 1].date}. shortage_penalty_multiplier = ` +
      `${plan.totals.shortage_penalty_multiplier} (an assumption -- see /plan/sensitivity).`;

    lineChart(document.getElementById('attendance-chart'),
      plan.daily_plans.map(d => ({ y: d.expected_attendance, label: d.date })), {});

    const prepCost = plan.totals.estimated_preparation_cost_all_items;
    const lunchloopTotal = plan.totals.estimated_total_cost_compared_items;
    const baselineTotal = plan.totals.baseline_total_cost;
    const savings = plan.totals.estimated_savings_vs_baseline;
    const savingsPct = plan.totals.estimated_savings_pct_vs_baseline;
    const savingsPctTxt = savingsPct === null ? 'n/a' : savingsPct + '%';
    document.getElementById('month-totals').innerHTML = `
      <div><b>${fmtMoney(prepCost)}</b>est. preparation cost, whole month, all items</div>
      <div><b>${fmtMoney(lunchloopTotal)}</b>LunchLoop total cost (items with a baseline)</div>
      <div><b>${fmtMoney(baselineTotal)}</b>baseline total cost (same items)</div>
      <div><b style="color:${savings >= 0 ? 'var(--good)' : '#d03b3b'}">${fmtMoney(savings)}</b>` +
        `estimated savings vs. baseline (${savingsPctTxt})</div>`;

    barChart(document.getElementById('cost-chart'),
      plan.per_food_totals.map(f => ({ label: f.food_item, value: f.total_estimated_total_cost })), {});

    const tbody = document.getElementById('month-rows');
    for (const f of plan.per_food_totals) {
      const tr = document.createElement('tr');
      const savingsTxt = f.total_estimated_savings_vs_baseline === null ? '&mdash;'
        : fmtMoney(f.total_estimated_savings_vs_baseline) +
          (f.total_estimated_savings_pct_vs_baseline === null ? ''
            : ` (${f.total_estimated_savings_pct_vs_baseline}%)`);
      const baselineTxt = f.total_baseline_total_cost === null ? '&mdash;' : fmtMoney(f.total_baseline_total_cost);
      tr.innerHTML = `
        <td>${f.food_item}</td>
        <td>${f.total_predicted_demand}</td>
        <td>${f.total_recommended_prep}</td>
        <td>${f.total_estimated_surplus}</td>
        <td>${f.total_estimated_shortage}</td>
        <td>${f.total_estimated_plate_waste_servings}</td>
        <td>${fmtMoney(f.total_estimated_total_cost)}</td>
        <td>${baselineTxt}</td>
        <td>${savingsTxt}</td>`;
      tbody.appendChild(tr);
    }
    document.getElementById('month-table').style.display = '';
    document.getElementById('month-note').textContent =
      'Each day in this month gets its own weekday-based attendance estimate; further-out days ' +
      'in a school year carry the same confidence as nearer ones, since the model only looks at ' +
      'day-of-week history, not day-to-day momentum. Surplus, shortage, and plate waste are ' +
      'different quantities, shown separately -- plate waste uses an external USDA benchmark ' +
      'rate, not a local measurement, and is never summed into the cost totals above it.';
    document.getElementById('month-assumptions').innerHTML =
      '<b>Assumptions:</b> unit costs are mostly estimates (see /plan response for sourcing on ' +
      'popcorn chicken); "baseline" is this food\\'s own historical prepared/attendance ratio, not ' +
      'a separately measured real-world baseline; shortage cost values a missing serving at ' +
      `${plan.totals.shortage_penalty_multiplier}x its own unit_cost, a configurable choice, not a measured stockout cost.`;
  } catch (e) {
    document.getElementById('month-sub').innerHTML =
      '<span class="err">Could not load /plan/month: ' + e.message + '</span>';
  }
}

loadHistory();
loadAccuracy();
loadMonthPlan();
</script>
</body>
</html>
"""
