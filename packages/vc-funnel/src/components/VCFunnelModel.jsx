import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = ["Seed", "Series A", "Series B", "Series C", "Series D", "Series E+"];
const COHORT = 1000;
const DEFAULT_TRANS   = [48, 63, 55, 62, 58, 0];
const DEFAULT_MA_FRAC = [20, 25, 32, 40, 52, 68];
const DEFAULT_MA_VAL  = [5,  18, 45, 110, 280, 520];
const DILUTION_PER_ROUND = 0.22;
const N_SIMS = 2000;

const C = {
  advance: "#0d9488", ma: "#d97706", dead: "#dc2626",
  unicorn: "#7c3aed", bg: "#f8fafc", panel: "#ffffff",
  border: "#e2e8f0", text: "#1e293b", muted: "#64748b", accent: "#d97706",
  sliderTrack: "#cbd5e1",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n, d = 1) => Number(n).toFixed(d);
const fmtM  = (n) => n >= 1000 ? `$${fmt(n / 1000, 2)}B` : `$${fmt(n, 0)}M`;
const fmtMx = (n) => `${Number(n).toFixed(2)}×`;

function percentile(sorted, p) {
  return sorted[Math.min(Math.floor(sorted.length * p / 100), sorted.length - 1)];
}

// ─── Monte Carlo ──────────────────────────────────────────────────────────────
function simulateCompany(trans, maFrac, maVal, unicornRate, unicornVal, own) {
  if (Math.random() * 100 < unicornRate)
    return unicornVal * own * Math.pow(1 - DILUTION_PER_ROUND, 4);
  for (let i = 0; i < STAGES.length; i++) {
    const advances = (i < STAGES.length - 1) && (Math.random() * 100 < trans[i]);
    if (!advances) {
      if (Math.random() * 100 < maFrac[i]) {
        const noise = Math.exp(0.9 * (Math.random() * 2 - 1));
        return maVal[i] * noise * own * Math.pow(1 - DILUTION_PER_ROUND, i);
      }
      return 0;
    }
  }
  return 0;
}

function runMC({ trans, maFrac, maVal, unicornRate, unicornVal, numSeed, seedCheck, initOwn, followOnRate }) {
  const own = initOwn / 100;
  const fo  = followOnRate / 100;
  const foMult = [2, 3, 4.5, 6, 8];
  const seedCap = numSeed * seedCheck;
  let foCap = 0;
  for (let i = 0; i < STAGES.length - 1; i++) {
    foCap += numSeed * (trans[i] / 100) * fo * seedCheck * foMult[Math.min(i, foMult.length - 1)];
  }
  const totalCap = seedCap + foCap;
  const multiples = [];
  for (let s = 0; s < N_SIMS; s++) {
    let proceeds = 0;
    for (let c = 0; c < numSeed; c++)
      proceeds += simulateCompany(trans, maFrac, maVal, unicornRate, unicornVal, own);
    multiples.push(totalCap > 0 ? proceeds / totalCap : 0);
  }
  multiples.sort((a, b) => a - b);
  return { multiples, totalCap };
}

// ─── UI components ────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, onChange, format, color }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.muted, letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ fontSize: 12, color: color || C.accent, fontFamily: "monospace", fontWeight: 700 }}>
          {format ? format(value) : `${value}%`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%", height: 3, appearance: "none",
          background: `linear-gradient(to right,${color||C.accent} ${pct}%,${C.sliderTrack} ${pct}%)`,
          outline: "none", cursor: "pointer", borderRadius: 2
        }} />
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: C.muted,
      textTransform: "uppercase", borderBottom: `1px solid ${C.border}`,
      paddingBottom: 6, marginBottom: 12, marginTop: 18
    }}>{children}</div>
  );
}

function KPICard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontFamily: "monospace", fontWeight: 800, color: color || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function FunnelTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <div style={{ color: C.text, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => <div key={p.name} style={{ color: p.fill, marginBottom: 2 }}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  );
}

function SourceBox() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ margin: "20px 28px 0", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", background: C.panel, border: "none", cursor: "pointer",
        padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
        color: C.muted, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase"
      }}>
        <span>Sources &amp; Methodology</span>
        <span style={{ fontSize: 14, display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>&#x25BE;</span>
      </button>
      {open && (
        <div style={{ background: C.bg, padding: "14px 20px", fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
          <p style={{ margin: "0 0 8px" }}>
            <strong style={{ color: C.text }}>Primary source:</strong> CB Insights, "Venture Capital Funnel Shows Odds Of Becoming A Unicorn Are About 1%," September 2018.
            Original cohort: 1,119 US tech companies that raised a first seed round in 2008–2010, tracked through August 31, 2018.{" "}
            <a href="https://www.cbinsights.com/research/venture-capital-funnel-2/" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
              cbinsights.com/research/venture-capital-funnel-2/
            </a>
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong style={{ color: C.text }}>Default transition probabilities</strong> come directly from the CB Insights cohort table:
            Seed→A 48%, A→B 63%, B→C 55%, C→D 62%, D→E 58%.
            M&A exit rates and stage-level acquisition values are estimated from the article's aggregate outcomes (30% eventual M&A rate; 12 unicorns; 13 exits above $500M) cross-referenced with industry benchmarks.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong style={{ color: C.text }}>Monte Carlo</strong> runs {N_SIMS.toLocaleString()} independent fund simulations.
            Each company draws a random Bernoulli path through the funnel. Acquisition values are log-normally distributed around the median (σ = 0.9).
            Dilution is modelled at 22% per round. Follow-on capital is approximated deterministically.
          </p>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            This tool is for educational use. Parameters reflect a specific historical cohort and should not be taken as predictive of current fund performance.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function VCFunnelModel() {
  const [trans,        setTrans]        = useState(DEFAULT_TRANS);
  const [maFrac,       setMaFrac]       = useState(DEFAULT_MA_FRAC);
  const [maVal,        setMaVal]        = useState(DEFAULT_MA_VAL);
  const [unicornRate,  setUnicornRate]  = useState(1.07);
  const [unicornVal,   setUnicornVal]   = useState(3000);
  const [numSeed,      setNumSeed]      = useState(20);
  const [seedCheck,    setSeedCheck]    = useState(0.5);
  const [initOwn,      setInitOwn]      = useState(10);
  const [followOnRate, setFollowOnRate] = useState(60);
  const [mcSeed,       setMcSeed]       = useState(0);

  const setAt = (setter) => (i, v) => setter((a) => a.map((x, j) => j === i ? v : x));

  // ── Deterministic funnel ──────────────────────────────────────────────────
  const { stages, totals } = useMemo(() => {
    let rem = COHORT;
    const stages = [];
    for (let i = 0; i < STAGES.length; i++) {
      const at  = rem;
      const adv = i < STAGES.length - 1 ? Math.round(at * trans[i] / 100) : 0;
      const lv  = at - adv;
      const ma  = Math.round(lv * maFrac[i] / 100);
      stages.push({ stage:STAGES[i], atStage:at, advancing:adv, maExits:ma, deaths:lv-ma, stageProceeds:ma*maVal[i] });
      rem = adv;
    }
    const uni    = Math.round(COHORT * unicornRate / 100);
    const totalMA   = stages.reduce((s,r) => s+r.maExits, 0);
    const totalDead = stages.reduce((s,r) => s+r.deaths, 0);
    return { stages, totals:{ totalMA, totalDead, unicorns:uni } };
  }, [trans, maFrac, maVal, unicornRate]);

  // ── Deterministic fund return ─────────────────────────────────────────────
  const det = useMemo(() => {
    const own = initOwn / 100;
    const fo  = followOnRate / 100;
    const foM = [2,3,4.5,6,8];
    const sc  = numSeed * seedCheck;
    let foCap = 0;
    stages.forEach((s, i) => {
      if (i < STAGES.length-1)
        foCap += s.advancing * (numSeed/COHORT) * fo * seedCheck * foM[Math.min(i,4)];
    });
    const cap = sc + foCap;
    let proc = 0;
    stages.forEach((s, i) => {
      proc += s.stageProceeds * (numSeed/COHORT) * own * Math.pow(1-DILUTION_PER_ROUND, i);
    });
    const uniProc = totals.unicorns * unicornVal * (numSeed/COHORT) * own * Math.pow(1-DILUTION_PER_ROUND, 4);
    proc += uniProc;
    const mult = cap > 0 ? proc / cap : 0;
    return { cap, proc, mult, concentrationPct: proc > 0 ? (uniProc/proc)*100 : 0 };
  }, [stages, totals, numSeed, seedCheck, initOwn, followOnRate, unicornVal]);

  // ── Monte Carlo ───────────────────────────────────────────────────────────
  const mc = useMemo(() => {
    const { multiples } = runMC({
      trans, maFrac, maVal, unicornRate, unicornVal,
      numSeed, seedCheck, initOwn, followOnRate
    });
    const p = (pct) => percentile(multiples, pct);
    const mean = multiples.reduce((a,b)=>a+b,0) / multiples.length;
    const lossPct = multiples.filter(m=>m<1).length / multiples.length * 100;
    const maxB = Math.min(percentile(multiples, 99), 20);
    const B = 40, w = maxB / B;
    const hist = Array.from({length:B}, (_, i) => ({ x:i*w, label:`${(i*w).toFixed(1)}×`, count:0 }));
    multiples.forEach((m) => { const b=Math.min(Math.floor(m/w),B-1); if(b>=0) hist[b].count++; });
    return { p10:p(10), p25:p(25), p50:p(50), p75:p(75), p90:p(90), mean, lossPct, hist };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcSeed, trans, maFrac, maVal, unicornRate, unicornVal, numSeed, seedCheck, initOwn, followOnRate]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const funnelData = stages.map((s) => ({
    name:s.stage, Advancing:s.advancing, "M&A Exit":s.maExits, "Dead/Zombie":s.deaths
  }));
  const proceedsData = stages.map((s) => ({ name:s.stage, proceeds:s.stageProceeds }))
    .concat([{ name:"Unicorns", proceeds:totals.unicorns*unicornVal }]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'Source Sans 3','Helvetica Neue',Arial,sans-serif", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "20px 32px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "'Crimson Pro', serif" }}>VC Portfolio Return Modeller</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            Scenario explorer for a cohort of 1,000 seed-stage companies
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, background: C.panel,
          border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px" }}>
          N = {COHORT} · {N_SIMS.toLocaleString()} simulations
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr" }}>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div style={{ borderRight: `1px solid ${C.border}`, padding: "20px",
          overflowY: "auto", maxHeight: "calc(100vh - 70px)", scrollbarWidth: "thin" }}>

          <Label>Transition Probabilities</Label>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>% that advance to the next round</div>
          {STAGES.slice(0,5).map((_,i) => (
            <Slider key={i} label={`${STAGES[i]} → ${STAGES[i+1]}`}
              value={trans[i]} min={5} max={90}
              onChange={(v) => setAt(setTrans)(i,v)} color={C.advance} />
          ))}

          <Label>M&A Exit Rate (of Dropouts)</Label>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>% acquired vs. dead/zombie per stage</div>
          {STAGES.map((_,i) => (
            <Slider key={i} label={STAGES[i]} value={maFrac[i]} min={0} max={100}
              onChange={(v) => setAt(setMaFrac)(i,v)} color={C.ma} />
          ))}

          <Label>M&A Exit Values (median $M)</Label>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Median acquisition value per company</div>
          {STAGES.map((_,i) => (
            <Slider key={i} label={STAGES[i]} value={maVal[i]}
              min={1} max={i<3?200:1000} step={i<2?1:5}
              onChange={(v) => setAt(setMaVal)(i,v)} format={fmtM} color={C.ma} />
          ))}

          <Label>Unicorn Parameters</Label>
          <Slider label="Unicorn rate (% of cohort)" value={unicornRate}
            min={0} max={5} step={0.1} onChange={setUnicornRate}
            format={(v) => `${Number(v).toFixed(2)}%`} color={C.unicorn} />
          <Slider label="Unicorn exit value" value={unicornVal}
            min={1000} max={20000} step={100} onChange={setUnicornVal}
            format={fmtM} color={C.unicorn} />

          <Label>Fund Parameters</Label>
          <Slider label="Seed investments" value={numSeed} min={5} max={100}
            onChange={setNumSeed} format={(v) => `${v} companies`} />
          <Slider label="Seed check size" value={seedCheck} min={0.1} max={5} step={0.1}
            onChange={setSeedCheck} format={(v) => `$${Number(v).toFixed(1)}M`} />
          <Slider label="Initial ownership" value={initOwn} min={1} max={30} onChange={setInitOwn} />
          <Slider label="Follow-on participation" value={followOnRate} min={0} max={100} onChange={setFollowOnRate} />
        </div>

        {/* ── Main canvas ──────────────────────────────────────────────────── */}
        <div style={{ padding: "20px 28px" }}>

          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 18 }}>
            <KPICard label="M&A Exits" value={totals.totalMA}
              sub={`${fmt(totals.totalMA/10,1)}% of cohort`} color={C.ma} />
            <KPICard label="Unicorns" value={totals.unicorns}
              sub={`${fmt(totals.unicorns/10,2)}% of cohort`} color={C.unicorn} />
            <KPICard label="Dead / Zombie" value={totals.totalDead}
              sub={`${fmt(totals.totalDead/10,1)}% of cohort`} color={C.dead} />
            <KPICard label="Expected Multiple" value={fmtMx(det.mult)}
              sub={`$${fmt(det.cap,1)}M → $${fmt(det.proc,1)}M`}
              color={det.mult>=3?C.advance:det.mult>=1?C.ma:C.dead} />
            <KPICard label="Return Concentration" value={`${fmt(det.concentrationPct,0)}%`}
              sub="from unicorns" color={C.unicorn} />
          </div>

          {/* Funnel + proceeds charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 16px 10px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Startup Survival Funnel</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Company outcomes per 1,000 at each stage</div>
              <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                {[["Advancing",C.advance],["M&A Exit",C.ma],["Dead/Zombie",C.dead]].map(([l,c])=>(
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                    <span style={{ fontSize: 10, color: C.muted }}>{l}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart layout="vertical" data={funnelData} margin={{ top:0,right:20,left:0,bottom:0 }}>
                  <XAxis type="number" domain={[0,COHORT]} tick={{ fill:C.muted,fontSize:10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill:C.text,fontSize:11 }} width={68} />
                  <Tooltip content={<FunnelTip />} />
                  <Bar dataKey="Advancing" stackId="a" fill={C.advance} />
                  <Bar dataKey="M&A Exit"  stackId="a" fill={C.ma} />
                  <Bar dataKey="Dead/Zombie" stackId="a" fill={C.dead} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 16px 10px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Aggregate Proceeds by Stage</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Gross $M across 1,000 companies</div>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={proceedsData} margin={{ top:4,right:10,left:0,bottom:0 }}>
                  <XAxis dataKey="name" tick={{ fill:C.muted,fontSize:10 }} />
                  <YAxis tick={{ fill:C.muted,fontSize:10 }}
                    tickFormatter={(v) => v>=1000?`$${(v/1000).toFixed(0)}B`:`$${v}M`} />
                  <Tooltip formatter={(v)=>[fmtM(v),"Proceeds"]}
                    contentStyle={{ background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:12 }}
                    labelStyle={{ color:C.text }} />
                  <Bar dataKey="proceeds" radius={[4,4,0,0]}>
                    {proceedsData.map((_,i) => (
                      <Cell key={i} fill={i===proceedsData.length-1?C.unicorn:C.ma} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Monte Carlo panel ─────────────────────────────────────────── */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "18px 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Monte Carlo — Fund Return Distribution</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {N_SIMS.toLocaleString()} simulated funds · each company draws a random path through the funnel
                </div>
              </div>
              <button onClick={() => setMcSeed(s=>s+1)} style={{
                background: "transparent", border: `1px solid ${C.border}`,
                borderRadius: 6, padding: "5px 12px", color: C.muted,
                fontSize: 11, cursor: "pointer", letterSpacing: "0.04em"
              }}>&#x21BA; Re-run</button>
            </div>

            {/* Percentile cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, marginBottom: 14 }}>
              {[
                ["P10",  mc.p10,  C.dead],
                ["P25",  mc.p25,  C.ma],
                ["Median",mc.p50, C.text],
                ["Mean", mc.mean, C.accent],
                ["P75",  mc.p75,  C.advance],
                ["P90",  mc.p90,  C.advance],
              ].map(([label,val,color]) => (
                <div key={label} style={{
                  background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: "8px 10px", textAlign: "center"
                }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                  <div style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 700, color, marginTop: 2 }}>
                    {fmtMx(val)}
                  </div>
                </div>
              ))}
            </div>

            {/* Histogram */}
            <ResponsiveContainer width="100%" height={155}>
              <BarChart data={mc.hist} margin={{ top:4,right:10,left:-10,bottom:0 }} barCategoryGap={1}>
                <XAxis dataKey="label" tick={{ fill:C.muted,fontSize:9 }}
                  interval={Math.floor(mc.hist.length/8)} />
                <YAxis tick={{ fill:C.muted,fontSize:9 }} />
                <Tooltip
                  formatter={(v) => [`${v} funds`,"Count"]}
                  labelFormatter={(l) => `Multiple ≈ ${l}`}
                  contentStyle={{ background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11 }}
                  labelStyle={{ color:C.text }} />
                <Bar dataKey="count" radius={[2,2,0,0]}>
                  {mc.hist.map((d,i) => (
                    <Cell key={i}
                      fill={d.x < 1 ? C.dead : d.x < mc.mean ? C.ma : C.advance}
                      opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Loss rate line */}
            <div style={{ display: "flex", gap: 24, marginTop: 10 }}>
              <div style={{ fontSize: 11, color: C.muted }}>
                <span style={{ color: C.dead, fontFamily: "monospace", fontWeight: 700 }}>
                  {fmt(mc.lossPct,1)}%
                </span>{" "}of funds return less than invested (DPI &lt; 1×)
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                <span style={{ color: C.advance, fontFamily: "monospace", fontWeight: 700 }}>
                  {fmt(100-mc.lossPct,1)}%
                </span>{" "}return capital with positive DPI
              </div>
            </div>
          </div>

          {/* Ergodicity callout */}
          <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff",
            borderRadius: 10, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ fontSize: 20, marginTop: 1 }}>&#x2297;</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 4 }}>Ergodicity Gap</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
                The expected multiple of{" "}
                <span style={{ color: C.text, fontFamily: "monospace" }}>{fmtMx(det.mult)}</span>{" "}
                is an <em>ensemble average</em> across simultaneous portfolio bets.
                The Monte Carlo median of{" "}
                <span style={{ color: C.text, fontFamily: "monospace" }}>{fmtMx(mc.p50)}</span>{" "}
                is what the <em>typical</em> fund actually experiences.
                The gap between mean and median is driven by the fat tail — rare unicorn events that inflate the ensemble
                but are absent from most individual fund paths.
                With {fmt(totals.totalDead/10,0)}% dead/zombie outcomes per company, the non-ergodicity is structural:
                no individual founder can average across the full distribution. Only the portfolio can.
              </div>
            </div>
          </div>

        </div>
      </div>

      <SourceBox />
    </div>
  );
}
