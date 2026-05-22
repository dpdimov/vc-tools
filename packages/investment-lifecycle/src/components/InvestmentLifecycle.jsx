import React, { useState, useMemo } from "react";

// ────────────────────────────────────────────────────────────────────────
//  Single Investment Lifecycle Model
// ────────────────────────────────────────────────────────────────────────

const fmtMoney = (v, dp = 1) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(2)}B`;
  return `${v.toFixed(dp)}M`;
};
const fmtPct = (v, dp = 1) => (v === null || isNaN(v) ? "—" : `${(v * 100).toFixed(dp)}%`);
const fmtX = (v, dp = 2) => (v === null || isNaN(v) || !isFinite(v) ? "—" : `${v.toFixed(dp)}×`);

// Market-implied P(reach next round) = 1 / step-up, capped at 1. Null for down rounds (<1).
const impliedProb = (stepUp) => {
  if (stepUp === null || isNaN(stepUp) || stepUp <= 0) return null;
  if (stepUp < 1) return null;
  return Math.min(1 / stepUp, 1);
};

function irr(flows) {
  const npv = (r) => flows.reduce((s, f) => s + f.cf / Math.pow(1 + r, f.t), 0);
  let lo = -0.9999, hi = 10, nlo = npv(lo), nhi = npv(hi);
  if (nlo * nhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, nm = npv(mid);
    if (Math.abs(nm) < 1e-7) return mid;
    if (nlo * nm < 0) { hi = mid; nhi = nm; } else { lo = mid; nlo = nm; }
  }
  return (lo + hi) / 2;
}

const STAGE_NAMES = ["Pre-seed", "Seed", "Series A", "Series B", "Series C", "Series D", "Series E", "Series F"];

export default function InvestmentLifecycle() {
  const [entryStageIdx, setEntryStageIdx] = useState(1);
  const [entryInvest, setEntryInvest] = useState(1.0);
  const [entryStake, setEntryStake] = useState(15);

  const [rounds, setRounds] = useState([
    { stepUp: 2.5, raised: 6, followOn: 1.5, prob: 70, yearsToNext: 1.5 },
    { stepUp: 2.0, raised: 15, followOn: 2.0, prob: 65, yearsToNext: 2.0 },
    { stepUp: 1.6, raised: 30, followOn: 0, prob: 60, yearsToNext: 2.0 },
  ]);

  const [exitProb, setExitProb] = useState(55);
  const [exitValue, setExitValue] = useState(300);
  const [yearsToExit, setYearsToExit] = useState(2.0);

  const [probMode, setProbMode] = useState(false);
  const [recovery, setRecovery] = useState(0);
  const [showArb, setShowArb] = useState(true);

  const updateRound = (i, key, val) => setRounds((r) => r.map((rd, idx) => (idx === i ? { ...rd, [key]: val } : rd)));
  const addRound = () => setRounds((r) => [...r, { stepUp: 1.5, raised: 20, followOn: 0, prob: 60, yearsToNext: 2.0 }]);
  const removeRound = (i) => setRounds((r) => r.filter((_, idx) => idx !== i));
  const anchorToMarket = (i) => {
    const imp = impliedProb(rounds[i].stepUp);
    if (imp !== null) updateRound(i, "prob", Math.round(imp * 100));
  };

  const model = useMemo(() => {
    const entryPost = entryStake > 0 ? entryInvest / (entryStake / 100) : 0;
    let ownership = entryStake / 100;
    let postMoney = entryPost, cumTime = 0, cumProb = 1;
    const flows = [{ t: 0, cf: -entryInvest }];
    let totalInvested = entryInvest, expectedInvested = entryInvest;

    const ledger = [{
      label: `${STAGE_NAMES[entryStageIdx]} (entry)`, postMoney: entryPost,
      dilFactor: null, ownBefore: null, followOn: entryInvest, ownAfter: ownership,
      time: 0, cumProb: 1, impliedP: null, edge: null,
    }];

    rounds.forEach((rd, i) => {
      const preMoney = postMoney * rd.stepUp;
      const newPost = preMoney + rd.raised;
      const dilFactor = newPost > 0 ? preMoney / newPost : 0;
      const ownBefore = ownership * dilFactor;
      const followOnOwn = newPost > 0 ? rd.followOn / newPost : 0;
      const ownAfter = ownBefore + followOnOwn;

      cumTime += rd.yearsToNext;
      cumProb *= rd.prob / 100;
      ownership = ownAfter;
      postMoney = newPost;
      totalInvested += rd.followOn;
      expectedInvested += rd.followOn * cumProb;
      if (rd.followOn > 0) flows.push({ t: cumTime, cf: -rd.followOn });

      const impP = impliedProb(rd.stepUp);
      const edge = impP !== null ? (rd.prob / 100) - impP : null;

      ledger.push({
        label: `R${i + 1} · ${STAGE_NAMES[Math.min(entryStageIdx + i + 1, STAGE_NAMES.length - 1)]}`,
        postMoney: newPost, dilFactor, ownBefore, followOn: rd.followOn, ownAfter,
        time: cumTime, cumProb, impliedP: impP, edge,
      });
    });

    const exitTime = cumTime + yearsToExit;
    const reachExitProb = cumProb * (exitProb / 100);
    const exitProceeds = ownership * exitValue;

    const condFlows = [...flows, { t: exitTime, cf: exitProceeds }];
    const condMultiple = totalInvested > 0 ? exitProceeds / totalInvested : 0;
    const condIRR = irr(condFlows);

    let expProceeds = reachExitProb * exitProceeds;
    const reachProbs = [1, ...ledger.slice(1).map((row) => row.cumProb)];
    for (let k = 0; k < reachProbs.length; k++) {
      const reachK = reachProbs[k];
      const reachNext = k + 1 < reachProbs.length ? reachProbs[k + 1] : reachExitProb;
      const failHere = reachK - reachNext;
      let capK = entryInvest;
      for (let j = 1; j <= k; j++) capK += rounds[j - 1].followOn;
      expProceeds += failHere * recovery * capK;
    }
    const expMultiple = expectedInvested > 0 ? expProceeds / expectedInvested : 0;

    const expFlows = [{ t: 0, cf: -entryInvest }];
    rounds.forEach((rd, i) => {
      if (rd.followOn > 0) expFlows.push({ t: ledger[i + 1].time, cf: -rd.followOn * ledger[i + 1].cumProb });
    });
    expFlows.push({ t: exitTime, cf: expProceeds });
    const expIRR = irr(expFlows);

    let foCapital = 0, weightedEdge = 0;
    rounds.forEach((rd, i) => {
      if (rd.followOn > 0 && ledger[i + 1].edge !== null) {
        foCapital += rd.followOn;
        weightedEdge += rd.followOn * ledger[i + 1].edge;
      }
    });
    const followOnEdge = foCapital > 0 ? weightedEdge / foCapital : null;

    return {
      ledger, entryPost, finalOwnership: ownership, exitProceeds, totalInvested,
      condMultiple, condIRR, exitTime, reachExitProb,
      expProceeds, expMultiple, expIRR, expectedInvested, followOnEdge,
    };
  }, [entryStageIdx, entryInvest, entryStake, rounds, exitProb, exitValue, yearsToExit, recovery]);

  const C = {
    ink: "#1a1a18", paper: "#f4f1ea", panel: "#fbfaf6", line: "#d8d2c4",
    accent: "#1f3a5f", accent2: "#2d4a3e", warn: "#9a3b2e", muted: "#7a7468",
    gold: "#b08438", green: "#2d6a4a", red: "#9a3b2e",
  };

  const labelStyle = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, fontWeight: 600, marginBottom: 4, display: "block" };
  const inputStyle = { width: "100%", padding: "7px 9px", border: `1px solid ${C.line}`, borderRadius: 3, background: C.panel, fontSize: 14, color: C.ink, fontFamily: "'Spectral', Georgia, serif", boxSizing: "border-box" };

  const NumInput = ({ value, onChange, step = 0.1, min, max, suffix }) => (
    <div style={{ position: "relative" }}>
      <input type="number" value={value} step={step} min={min} max={max}
        onChange={(e) => onChange(e.target.value === "" ? "" : parseFloat(e.target.value))} style={inputStyle} />
      {suffix && <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.muted, pointerEvents: "none" }}>{suffix}</span>}
    </div>
  );

  const edgeColor = (e) => (e === null ? C.muted : e > 0.001 ? C.green : e < -0.001 ? C.red : C.muted);
  const edgeLabel = (e) => (e === null ? "—" : `${e >= 0 ? "+" : ""}${(e * 100).toFixed(0)}pp`);

  return (
    <div className="lif-page" style={{ fontFamily: "'Spectral', Georgia, serif", background: C.paper, color: C.ink, minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Spectral:wght@300;400;500;600;700&family=Spectral+SC:wght@500;600&display=swap');
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; } * { box-sizing: border-box; }
        .lif-page { padding: 32px 28px; }
        .lif-title { font-size: 30px; }
        @media (max-width: 900px) {
          .lif-main { grid-template-columns: 1fr !important; gap: 18px !important; }
        }
        @media (max-width: 600px) {
          .lif-page { padding: 18px 12px; }
          .lif-title { font-size: 22px; }
          .lif-entry-grid { grid-template-columns: 1fr 1fr !important; }
          .lif-entry-grid > :first-child { grid-column: 1 / -1; }
          .lif-exit-grid { grid-template-columns: 1fr 1fr !important; }
          .lif-exit-grid > :first-child { grid-column: 1 / -1; }
          .lif-rounds-row, .lif-rounds-header {
            grid-template-columns: 14px 1fr 1fr 1fr 14px !important;
            grid-template-areas: "idx step raised fo rm" "idx prob prob years rm" !important;
            row-gap: 4px !important;
          }
          .lif-rounds-row > :nth-child(1), .lif-rounds-header > :nth-child(1) { grid-area: idx; }
          .lif-rounds-row > :nth-child(2), .lif-rounds-header > :nth-child(2) { grid-area: step; }
          .lif-rounds-row > :nth-child(3), .lif-rounds-header > :nth-child(3) { grid-area: raised; }
          .lif-rounds-row > :nth-child(4), .lif-rounds-header > :nth-child(4) { grid-area: fo; }
          .lif-rounds-row > :nth-child(5), .lif-rounds-header > :nth-child(5) { grid-area: prob; }
          .lif-rounds-row > :nth-child(6), .lif-rounds-header > :nth-child(6) { grid-area: years; }
          .lif-rounds-row > :nth-child(7), .lif-rounds-header > :nth-child(7) { grid-area: rm; }
          .lif-metric-big { font-size: 26px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 4 }}>
          <h1 className="lif-title" style={{ margin: "4px 0 2px", fontWeight: 700, letterSpacing: "-0.01em" }}>Single Investment Lifecycle</h1>
          <div style={{ fontSize: 14, color: C.muted, fontStyle: "italic" }}>One company, entry to exit — dilution, follow-on, and the gap between the price the market sets and the odds you actually believe.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "18px 0 22px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: `1px solid ${C.line}` }}>
            <button onClick={() => setProbMode(false)} style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: !probMode ? C.accent : C.panel, color: !probMode ? "#fff" : C.muted }}>Conditional path</button>
            <button onClick={() => setProbMode(true)} style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: probMode ? C.accent : C.panel, color: probMode ? "#fff" : C.muted }}>Probability-weighted</button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.ink, cursor: "pointer" }}>
            <input type="checkbox" checked={showArb} onChange={(e) => setShowArb(e.target.checked)} /> Show pricing edge
          </label>
          <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic", flex: 1, minWidth: 200 }}>
            {probMode ? "Folding in the chance of failing at each round — the power-law view." : "Assuming survival to exit — isolates dilution and step-up mechanics."}
          </div>
          {probMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={labelStyle}>Recovery</span>
              <div style={{ width: 86 }}><NumInput value={recovery} onChange={setRecovery} step={0.05} min={0} max={1} suffix="×cap" /></div>
            </div>
          )}
        </div>

        <div className="lif-main" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
          <div>
            <Section title="1 · Entry" C={C}>
              <div className="lif-entry-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 10 }}>
                <div><span style={labelStyle}>Stage</span>
                  <select value={entryStageIdx} onChange={(e) => setEntryStageIdx(parseInt(e.target.value))} style={inputStyle}>
                    {STAGE_NAMES.slice(0, 5).map((s, i) => <option key={i} value={i}>{s}</option>)}
                  </select></div>
                <div><span style={labelStyle}>Investment</span><NumInput value={entryInvest} onChange={setEntryInvest} suffix="€M" /></div>
                <div><span style={labelStyle}>Stake</span><NumInput value={entryStake} onChange={setEntryStake} suffix="%" /></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: C.muted, fontStyle: "italic" }}>Implied entry post-money: <strong style={{ color: C.accent }}>€{fmtMoney(model.entryPost)}</strong></div>
            </Section>

            <Section title="2 · Future rounds" C={C}>
              <div className="lif-rounds-header" style={{ display: "grid", gridTemplateColumns: "16px 1fr 1fr 1fr 1.35fr 0.8fr 16px", gap: 6, alignItems: "end", fontSize: 9.5, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                <span></span><span>Step-up</span><span>Raised</span><span>Our F/O</span><span>P(reach)</span><span>Yrs</span><span></span>
              </div>
              {rounds.map((rd, i) => {
                const led = model.ledger[i + 1];
                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div className="lif-rounds-row" style={{ display: "grid", gridTemplateColumns: "16px 1fr 1fr 1fr 1.35fr 0.8fr 16px", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{i + 1}</span>
                      <CompactInput value={rd.stepUp} onChange={(v) => updateRound(i, "stepUp", v)} step={0.1} suffix="×" C={C} />
                      <CompactInput value={rd.raised} onChange={(v) => updateRound(i, "raised", v)} step={1} C={C} />
                      <CompactInput value={rd.followOn} onChange={(v) => updateRound(i, "followOn", v)} step={0.5} C={C} />
                      <CompactInput value={rd.prob} onChange={(v) => updateRound(i, "prob", v)} step={5} suffix="%" C={C} />
                      <CompactInput value={rd.yearsToNext} onChange={(v) => updateRound(i, "yearsToNext", v)} step={0.5} C={C} />
                      <button onClick={() => removeRound(i)} style={{ border: "none", background: "none", cursor: "pointer", color: C.warn, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                    {showArb && (
                      <div style={{ display: "grid", gridTemplateColumns: "16px 1fr auto", gap: 6, alignItems: "center", marginTop: 3, fontSize: 11 }}>
                        <span></span>
                        <span style={{ color: C.muted, fontStyle: "italic" }}>
                          {led.impliedP === null
                            ? "down/flat round — no risk-elimination signal"
                            : <>market implies <strong style={{ color: C.ink }}>{fmtPct(led.impliedP, 0)}</strong> · your edge <strong style={{ color: edgeColor(led.edge) }}>{edgeLabel(led.edge)}</strong> {led.edge > 0.001 ? "(cheap)" : led.edge < -0.001 ? "(dear)" : "(fair)"}</>}
                        </span>
                        <button onClick={() => anchorToMarket(i)} disabled={led.impliedP === null}
                          style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 3, cursor: led.impliedP === null ? "default" : "pointer", fontSize: 10, color: led.impliedP === null ? C.line : C.accent, fontFamily: "inherit", fontWeight: 600, padding: "2px 7px", whiteSpace: "nowrap" }}>
                          → market
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={addRound} style={{ marginTop: 4, padding: "6px 12px", border: `1px dashed ${C.line}`, borderRadius: 3, background: "none", cursor: "pointer", fontSize: 12, color: C.accent, fontFamily: "inherit", fontWeight: 600 }}>+ Add round</button>
            </Section>

            <Section title="3 · Exit" C={C}>
              <div className="lif-exit-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><span style={labelStyle}>P(exit)</span><NumInput value={exitProb} onChange={setExitProb} step={5} suffix="%" /></div>
                <div><span style={labelStyle}>Exit value</span><NumInput value={exitValue} onChange={setExitValue} step={10} suffix="€M" /></div>
                <div><span style={labelStyle}>Yrs to exit</span><NumInput value={yearsToExit} onChange={setYearsToExit} step={0.5} /></div>
              </div>
            </Section>

            {showArb && (
              <div style={{ background: "#f0ece1", border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 3, padding: "12px 15px", fontSize: 12.5, lineHeight: 1.55, color: C.ink }}>
                <div style={{ fontFamily: "'Spectral SC', serif", fontSize: 12, letterSpacing: "0.08em", color: C.gold, fontWeight: 600, marginBottom: 6 }}>THE PRICING EDGE</div>
                A valuation step-up is the market pricing the elimination of risk. A <strong>2.5×</strong> step-up implies the next round was only <strong>40%</strong> likely (1 ÷ 2.5) — the market priced a 60% chance of failure. That implied probability is the market's view. <strong>P(reach)</strong> is <em>your</em> view. The gap is your edge: when you believe the company is more likely to advance than the step-up implies, the round is cheap and you should follow on harder; when you believe less, it is dear and you should hold back. This is the disciplined version of "double down on winners" — double down where your edge is positive, not merely where you have capital.
              </div>
            )}
          </div>

          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Metric label={probMode ? "Expected multiple" : "Gross multiple"} value={fmtX(probMode ? model.expMultiple : model.condMultiple)} accent={C.accent} C={C} big />
              <Metric label={probMode ? "Expected IRR" : "Gross IRR"} value={fmtPct(probMode ? model.expIRR : model.condIRR)} accent={C.accent2} C={C} big />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Metric label="Final ownership" value={fmtPct(model.finalOwnership)} C={C} />
              <Metric label={probMode ? "Capital at risk (exp.)" : "Total invested"} value={`€${fmtMoney(probMode ? model.expectedInvested : model.totalInvested)}`} C={C} />
              <Metric label={probMode ? "Expected proceeds" : "Exit proceeds"} value={`€${fmtMoney(probMode ? model.expProceeds : model.exitProceeds)}`} C={C} />
              <Metric label="P(reach exit)" value={fmtPct(model.reachExitProb)} C={C} />
            </div>

            {showArb && model.followOnEdge !== null && (
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `3px solid ${edgeColor(model.followOnEdge)}`, borderRadius: 3, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                Follow-on capital is being deployed at a capital-weighted edge of <strong style={{ color: edgeColor(model.followOnEdge) }}>{edgeLabel(model.followOnEdge)}</strong>.
                {model.followOnEdge > 0.001 ? " You are buying survival more cheaply than the market prices it." : model.followOnEdge < -0.001 ? " You are paying more for survival than your own odds justify — reconsider these follow-ons." : " Your follow-ons are priced in line with your own view."}
              </div>
            )}

            <div style={{ background: probMode ? "#f0ece1" : C.panel, border: `1px solid ${C.line}`, borderLeft: `3px solid ${probMode ? C.warn : C.accent}`, borderRadius: 3, padding: "12px 14px", marginBottom: 18, fontSize: 13, lineHeight: 1.5 }}>
              {probMode
                ? <>The same company that returns <strong>{fmtX(model.condMultiple)}</strong> if it works is worth <strong style={{ color: C.warn }}>{fmtX(model.expMultiple)}</strong> probability-weighted. The failure branches do most of the damage — this is why a fund needs the survivors to carry everything.</>
                : <>This is the return <em>if the company survives every round to exit</em>. It says nothing about how likely that is. Switch to probability-weighted to price failure in.</>}
            </div>

            <div style={{ fontFamily: "'Spectral SC', serif", fontSize: 12, letterSpacing: "0.1em", color: C.accent, fontWeight: 600, marginBottom: 6 }}>OWNERSHIP THROUGH ROUNDS</div>
            <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 3 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.ink, color: C.paper }}>
                    {["Round", "Post €M", "Dilution", "Before", "F/O", "After"].map((h, i) => (
                      <th key={i} style={{ padding: "7px 8px", textAlign: i === 0 ? "left" : "right", fontWeight: 600, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.ledger.map((row, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.line}`, background: i === 0 ? C.panel : "transparent" }}>
                      <td style={{ padding: "7px 8px", fontWeight: 600 }}>{row.label}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>{fmtMoney(row.postMoney)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: row.dilFactor ? C.warn : C.muted }}>{row.dilFactor ? `−${((1 - row.dilFactor) * 100).toFixed(0)}%` : "—"}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: C.muted }}>{row.ownBefore !== null ? fmtPct(row.ownBefore) : "—"}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: row.followOn > 0 ? C.accent2 : C.muted }}>{row.followOn > 0 ? `€${fmtMoney(row.followOn)}` : "—"}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: C.accent }}>{fmtPct(row.ownAfter)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.ink}`, background: C.panel }}>
                    <td style={{ padding: "8px", fontWeight: 700 }}>Exit · yr {model.exitTime.toFixed(1)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>{fmtMoney(exitValue)}</td>
                    <td colSpan={2} style={{ padding: "8px", textAlign: "right", color: C.muted, fontStyle: "italic" }}>proceeds →</td>
                    <td colSpan={2} style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: C.accent2 }}>€{fmtMoney(model.exitProceeds)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
              Dilution = the share of pre-existing ownership lost to new money each round. Following on buys it back; declining lets it erode. The Onset lesson, made mechanical.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, C }) {
  return (
    <div style={{ marginBottom: 18, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: "14px 16px" }}>
      <div style={{ fontFamily: "'Spectral SC', serif", fontSize: 13, letterSpacing: "0.08em", color: C.ink, fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>{title}</div>
      {children}
    </div>
  );
}
function Metric({ label, value, accent, C, big }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: big ? "14px 16px" : "10px 14px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div className={big ? "lif-metric-big" : undefined} style={{ fontSize: big ? 32 : 20, fontWeight: 700, color: accent || C.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
function CompactInput({ value, onChange, step, suffix, C }) {
  return (
    <div style={{ position: "relative" }}>
      <input type="number" value={value} step={step}
        onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
        style={{ width: "100%", padding: "5px 6px", border: `1px solid ${C.line}`, borderRadius: 3, background: "#fff", fontSize: 13, color: C.ink, fontFamily: "'Spectral', serif", textAlign: "center" }} />
      {suffix && <span style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: C.muted, pointerEvents: "none" }}>{suffix}</span>}
    </div>
  );
}
