import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fmtM = (v) => `$${(v / 1000000).toFixed(2)}m`;
const fmtK = (v) => v >= 1000000 ? `${(v / 1000000).toFixed(2)}m` : `${(v / 1000).toFixed(0)}k`;
const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;
const fmtDollar = (v) => `$${v.toFixed(2)}`;
const fmtShares = (v) => v.toLocaleString();

const TermSheetAnalyzer = () => {
  const [activeSection, setActiveSection] = useState('deal-structure');

  // --- Section A: Deal Structure inputs ---
  const [ts1SharePrice, setTs1SharePrice] = useState(1.00);
  const [ts1PreMoney, setTs1PreMoney] = useState(5000000);
  const [ts1Investment, setTs1Investment] = useState(2000000);
  const [ts1OptionPool, setTs1OptionPool] = useState(1000000);
  const [ts1FounderShares, setTs1FounderShares] = useState(4000000);

  const [ts2SharePrice, setTs2SharePrice] = useState(0.90);
  const [ts2PreMoney, setTs2PreMoney] = useState(4500000);
  const [ts2Investment, setTs2Investment] = useState(2000000);
  const [ts2OptionPool, setTs2OptionPool] = useState(500000);
  const [ts2FounderShares, setTs2FounderShares] = useState(4500000);

  // --- Section B: Liquidation Preferences inputs ---
  const [yearsToExit, setYearsToExit] = useState(5);

  // TS1: non-cumulative dividend, non-participating
  const [ts1DivPerShare, setTs1DivPerShare] = useState(0.10);
  // TS2: cumulative dividend capped at 30% of issue price, participating, 10% guaranteed return
  const [ts2DivPerShare, setTs2DivPerShare] = useState(0.09);
  const [ts2GuaranteedReturn, setTs2GuaranteedReturn] = useState(10);
  const [ts2DivCap, setTs2DivCap] = useState(30);

  // --- Section C: Anti-Dilution inputs ---
  const [ts1AntiDilution, setTs1AntiDilution] = useState('weighted-average');
  const [ts2AntiDilution, setTs2AntiDilution] = useState('hybrid');
  const [downRoundInvestment, setDownRoundInvestment] = useState(1500000);
  const [downRoundPrice, setDownRoundPrice] = useState(0.50);

  // --- Section A Calculations ---
  const dealStructure = useMemo(() => {
    const calc = (sharePrice, preMoney, investment, optionPool, founderShares) => {
      const sharesIssued = Math.round(investment / sharePrice);
      const postMoney = preMoney + investment;
      const totalShares = founderShares + optionPool + sharesIssued;
      const seriesAPct = sharesIssued / totalShares;
      const founderPct = founderShares / totalShares;
      const optionPct = optionPool / totalShares;
      const founderValue = founderShares * sharePrice;
      return { sharePrice, preMoney, investment, optionPool, founderShares, sharesIssued, postMoney, totalShares, seriesAPct, founderPct, optionPct, founderValue };
    };
    return {
      ts1: calc(ts1SharePrice, ts1PreMoney, ts1Investment, ts1OptionPool, ts1FounderShares),
      ts2: calc(ts2SharePrice, ts2PreMoney, ts2Investment, ts2OptionPool, ts2FounderShares),
    };
  }, [ts1SharePrice, ts1PreMoney, ts1Investment, ts1OptionPool, ts1FounderShares, ts2SharePrice, ts2PreMoney, ts2Investment, ts2OptionPool, ts2FounderShares]);

  // --- Section B Calculations ---
  const liquidationData = useMemo(() => {
    const exitValues = [5000000, 10000000, 20000000, 50000000, 100000000];
    const ts1 = dealStructure.ts1;
    const ts2 = dealStructure.ts2;

    const calcTs1 = (exitVal) => {
      // TS1: Non-participating preferred, non-cumulative dividend (assume not declared)
      const preference = ts1.investment; // no declared dividends
      const asConverted = ts1.seriesAPct * exitVal;
      const vcPayout = Math.max(preference, asConverted);
      const commonPayout = exitVal - vcPayout;
      const effectiveVcPct = exitVal > 0 ? vcPayout / exitVal : 0;
      return { exitVal, vcPayout, commonPayout, effectiveVcPct };
    };

    const calcTs2 = (exitVal) => {
      // TS2: Participating preferred with guaranteed return + cumulative dividends
      const guaranteedReturn = ts2.investment * (Math.pow(1 + ts2GuaranteedReturn / 100, yearsToExit) - 1);
      const capPerShare = (ts2DivCap / 100) * ts2SharePrice;
      const yearsToCap = capPerShare / ts2DivPerShare;
      const effectiveDivYears = Math.min(yearsToExit, yearsToCap);
      const cumulativeDividends = ts2.sharesIssued * ts2DivPerShare * effectiveDivYears;
      const preference = ts2.investment + guaranteedReturn + cumulativeDividends;

      // Participating: preference first, then pro-rata on remainder
      let vcPayoutParticipating;
      if (exitVal <= preference) {
        vcPayoutParticipating = exitVal; // VC takes everything up to preference
      } else {
        vcPayoutParticipating = preference + (exitVal - preference) * ts2.seriesAPct;
      }

      // Conversion option: as-converted
      const asConverted = ts2.seriesAPct * exitVal;

      // VC takes the better of participating or as-converted
      const vcPayout = Math.max(vcPayoutParticipating, asConverted);
      const commonPayout = exitVal - vcPayout;
      const effectiveVcPct = exitVal > 0 ? vcPayout / exitVal : 0;
      return { exitVal, vcPayout, commonPayout, effectiveVcPct, preference };
    };

    const tableData = exitValues.map(ev => ({
      exitVal: ev,
      ts1: calcTs1(ev),
      ts2: calcTs2(ev),
    }));

    // Conversion threshold for TS1
    const ts1ConversionThreshold = ts1.investment / ts1.seriesAPct;

    // Chart data: granular from $1M to $150M
    const chartData = [];
    for (let v = 1000000; v <= 150000000; v += (v < 10000000 ? 500000 : v < 50000000 ? 1000000 : 5000000)) {
      const r1 = calcTs1(v);
      const r2 = calcTs2(v);
      const proRata = ts1.seriesAPct * v; // reference: TS1 pro-rata line
      chartData.push({
        exitVal: v / 1000000,
        ts1Payout: r1.vcPayout / 1000000,
        ts2Payout: r2.vcPayout / 1000000,
        proRata: proRata / 1000000,
      });
    }

    return { tableData, chartData, ts1ConversionThreshold };
  }, [dealStructure, yearsToExit, ts1DivPerShare, ts2DivPerShare, ts2GuaranteedReturn, ts2DivCap, ts2SharePrice]);

  // --- Section C Calculations ---
  const antiDilutionData = useMemo(() => {
    const calcForTS = (ts, antiDilType, tsLabel) => {
      const { founderShares, optionPool, sharesIssued, sharePrice, investment, totalShares } = ts;

      // Before down round
      const before = {
        founders: founderShares,
        options: optionPool,
        seriesA: sharesIssued,
        total: totalShares,
        founderPct: founderShares / totalShares,
        optionPct: optionPool / totalShares,
        seriesAPct: sharesIssued / totalShares,
      };

      // After down round WITHOUT anti-dilution
      const newShares = Math.round(downRoundInvestment / downRoundPrice);
      const totalAfter = totalShares + newShares;
      const withoutAD = {
        founders: founderShares,
        options: optionPool,
        seriesA: sharesIssued,
        seriesB: newShares,
        total: totalAfter,
        founderPct: founderShares / totalAfter,
        optionPct: optionPool / totalAfter,
        seriesAPct: sharesIssued / totalAfter,
        seriesBPct: newShares / totalAfter,
      };

      // After down round WITH anti-dilution
      let adjustedSeriesA;
      let adMethod = antiDilType;

      if (antiDilType === 'hybrid') {
        // Hybrid: WA above 50% of price, full ratchet at or below 50%
        const threshold = sharePrice * 0.5;
        if (downRoundPrice > threshold) {
          adMethod = 'weighted-average';
        } else {
          adMethod = 'full-ratchet';
        }
      }

      if (adMethod === 'weighted-average') {
        const oldShares = totalShares;
        const newPrice = sharePrice * (oldShares + downRoundInvestment / sharePrice) / (oldShares + newShares);
        adjustedSeriesA = Math.round(investment / newPrice);
      } else if (adMethod === 'full-ratchet') {
        adjustedSeriesA = Math.round(investment / downRoundPrice);
      } else {
        // none
        adjustedSeriesA = sharesIssued;
      }

      const additionalShares = adjustedSeriesA - sharesIssued;
      const totalWithAD = totalShares + newShares + additionalShares;

      const withAD = {
        founders: founderShares,
        options: optionPool,
        seriesA: adjustedSeriesA,
        seriesB: newShares,
        additionalShares,
        total: totalWithAD,
        founderPct: founderShares / totalWithAD,
        optionPct: optionPool / totalWithAD,
        seriesAPct: adjustedSeriesA / totalWithAD,
        seriesBPct: newShares / totalWithAD,
        method: adMethod === 'weighted-average' ? 'Weighted Average' : adMethod === 'full-ratchet' ? 'Full Ratchet' : 'None',
      };

      return { before, withoutAD, withAD, tsLabel };
    };

    return {
      ts1: calcForTS(dealStructure.ts1, ts1AntiDilution, 'TS1 — GVP'),
      ts2: calcForTS(dealStructure.ts2, ts2AntiDilution, 'TS2 — GCP'),
    };
  }, [dealStructure, ts1AntiDilution, ts2AntiDilution, downRoundInvestment, downRoundPrice]);

  // --- Render Helpers ---
  const renderComparisonRow = (label, val1, val2, format, higherIsBetter = true) => {
    const v1 = typeof val1 === 'number' ? val1 : 0;
    const v2 = typeof val2 === 'number' ? val2 : 0;
    const diff = Math.abs(v1 - v2) / Math.max(Math.abs(v1), Math.abs(v2), 1);
    const hasDiff = diff > 0.001;
    let ts1Better = higherIsBetter ? v1 > v2 : v1 < v2;
    let ts2Better = higherIsBetter ? v2 > v1 : v2 < v1;
    if (!hasDiff) { ts1Better = false; ts2Better = false; }

    return (
      <tr key={label} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <td style={{ padding: '10px 14px', fontSize: 13, color: '#64748b', fontWeight: 500 }}>{label}</td>
        <td style={{
          padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13,
          background: ts1Better ? 'rgba(13, 148, 136, 0.06)' : ts2Better ? 'rgba(220, 38, 38, 0.04)' : 'transparent',
          color: ts1Better ? '#0d9488' : '#1e293b',
        }}>{format(val1)}</td>
        <td style={{
          padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13,
          background: ts2Better ? 'rgba(13, 148, 136, 0.06)' : ts1Better ? 'rgba(220, 38, 38, 0.04)' : 'transparent',
          color: ts2Better ? '#0d9488' : '#1e293b',
        }}>{format(val2)}</td>
      </tr>
    );
  };

  const renderCapTable = (data, title, color, showSeriesB = false) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 10 }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>Holder</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>Shares</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>Ownership</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={{ padding: '8px 10px', color: '#64748b' }}>Founders</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtShares(data.founders)}</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtPct(data.founderPct)}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={{ padding: '8px 10px', color: '#64748b' }}>Options</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtShares(data.options)}</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtPct(data.optionPct)}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={{ padding: '8px 10px', color: '#64748b' }}>Series A</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtShares(data.seriesA)}</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtPct(data.seriesAPct)}</td>
          </tr>
          {showSeriesB && data.seriesB != null && (
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 10px', color: '#64748b' }}>Series B (Down Round)</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtShares(data.seriesB)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtPct(data.seriesBPct)}</td>
            </tr>
          )}
          <tr style={{ borderTop: '2px solid #e2e8f0', fontWeight: 600 }}>
            <td style={{ padding: '8px 10px', color: '#1e293b' }}>Total</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtShares(data.total)}</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>100.0%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // --- Main Render ---
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .ts-wrapper { padding: 40px; max-width: 1400px; margin: 0 auto; font-family: 'Source Sans 3', sans-serif; color: #1e293b; background: linear-gradient(145deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%); min-height: 100vh; }
        .ts-title { font-size: 38px; font-family: 'Crimson Pro', serif; font-weight: 700; color: #1e293b; margin-bottom: 8px; margin-top: 0; }
        .ts-section-tabs { display: flex; gap: 0; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 32px; }
        .ts-section-tab { padding: 12px 24px; border: none; background: #ffffff; color: #64748b; font-size: 14px; cursor: pointer; transition: all 0.2s; font-family: 'Source Sans 3', sans-serif; font-weight: 500; }
        .ts-section-tab:not(:last-child) { border-right: 1px solid #e2e8f0; }
        .ts-section-tab.active { background: linear-gradient(135deg, rgba(13,148,136,0.1), rgba(22,163,74,0.1)); color: #0d9488; font-weight: 600; }
        .ts-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px; margin-bottom: 28px; }
        .ts-card-title { font-family: 'Crimson Pro', serif; font-size: 20px; font-weight: 600; margin: 0 0 20px 0; color: #1e293b; }
        .ts-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .ts-slider-container { margin-bottom: 20px; }
        .ts-slider-label { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b; }
        .ts-slider-value { font-family: monospace; color: #0d9488; font-weight: 500; }
        input[type="range"] { width: 100%; height: 5px; -webkit-appearance: none; background: #e2e8f0; border-radius: 3px; outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; background: linear-gradient(135deg, #0d9488, #16a34a); border-radius: 50%; cursor: pointer; box-shadow: 0 2px 8px rgba(13,148,136,0.4); }
        .ts-metric-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; text-align: center; }
        .ts-metric-value { font-family: monospace; font-size: 22px; font-weight: 500; color: #0d9488; margin-bottom: 4px; }
        .ts-metric-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px; }
        .ts-toggle-group { display: flex; gap: 0; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 16px; }
        .ts-toggle-btn { flex: 1; padding: 8px 12px; border: none; background: #ffffff; color: #64748b; font-size: 11px; cursor: pointer; transition: all 0.2s; font-family: 'Source Sans 3', sans-serif; }
        .ts-toggle-btn:not(:last-child) { border-right: 1px solid #e2e8f0; }
        .ts-toggle-btn.active { background: linear-gradient(135deg, rgba(13,148,136,0.1), rgba(22,163,74,0.1)); color: #0d9488; font-weight: 600; }
        .ts-section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #94a3b8; margin-bottom: 12px; font-weight: 500; }
        .ts-highlight-better { background: rgba(13, 148, 136, 0.06); }
        .ts-highlight-worse { background: rgba(220, 38, 38, 0.04); }
        .ts-metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
        @media (max-width: 1100px) { .ts-two-col { grid-template-columns: 1fr; } .ts-wrapper { padding: 20px; } .ts-title { font-size: 28px; } .ts-metrics-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .ts-metrics-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="ts-wrapper">
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 className="ts-title">Term Sheet Analyzer</h1>
          <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
            Compare competing VC term sheets — deal structure, liquidation preferences, and anti-dilution protection.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="ts-section-tabs">
          <button
            className={`ts-section-tab${activeSection === 'deal-structure' ? ' active' : ''}`}
            onClick={() => setActiveSection('deal-structure')}
          >Deal Structure</button>
          <button
            className={`ts-section-tab${activeSection === 'liquidation' ? ' active' : ''}`}
            onClick={() => setActiveSection('liquidation')}
          >Liquidation Preferences</button>
          <button
            className={`ts-section-tab${activeSection === 'anti-dilution' ? ' active' : ''}`}
            onClick={() => setActiveSection('anti-dilution')}
          >Anti-Dilution</button>
        </div>

        {/* ============================================ */}
        {/* SECTION A: DEAL STRUCTURE                    */}
        {/* ============================================ */}
        {activeSection === 'deal-structure' && (
          <>
            {/* Input Panels */}
            <div className="ts-two-col" style={{ marginBottom: 28 }}>
              {/* TS1 Inputs */}
              <div className="ts-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }} />
                  <h3 className="ts-card-title" style={{ margin: 0, color: '#2563eb' }}>TS1 — Graedy Venture Partners</h3>
                </div>
                <Slider label="Share Price" value={ts1SharePrice} min={0.10} max={3.00} step={0.01}
                  format={v => fmtDollar(v)} onChange={setTs1SharePrice} />
                <Slider label="Pre-Money Valuation" value={ts1PreMoney} min={1000000} max={20000000} step={100000}
                  format={v => fmtM(v)} onChange={setTs1PreMoney} />
                <Slider label="Investment Amount" value={ts1Investment} min={500000} max={10000000} step={100000}
                  format={v => fmtM(v)} onChange={setTs1Investment} />
                <Slider label="Option Pool Shares" value={ts1OptionPool} min={0} max={3000000} step={50000}
                  format={v => fmtShares(v)} onChange={setTs1OptionPool} />
                <Slider label="Founder Shares" value={ts1FounderShares} min={1000000} max={10000000} step={100000}
                  format={v => fmtShares(v)} onChange={setTs1FounderShares} />
              </div>

              {/* TS2 Inputs */}
              <div className="ts-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c3aed' }} />
                  <h3 className="ts-card-title" style={{ margin: 0, color: '#7c3aed' }}>TS2 — Gready Capital Partners</h3>
                </div>
                <Slider label="Share Price" value={ts2SharePrice} min={0.10} max={3.00} step={0.01}
                  format={v => fmtDollar(v)} onChange={setTs2SharePrice} />
                <Slider label="Pre-Money Valuation" value={ts2PreMoney} min={1000000} max={20000000} step={100000}
                  format={v => fmtM(v)} onChange={setTs2PreMoney} />
                <Slider label="Investment Amount" value={ts2Investment} min={500000} max={10000000} step={100000}
                  format={v => fmtM(v)} onChange={setTs2Investment} />
                <Slider label="Option Pool Shares" value={ts2OptionPool} min={0} max={3000000} step={50000}
                  format={v => fmtShares(v)} onChange={setTs2OptionPool} />
                <Slider label="Founder Shares" value={ts2FounderShares} min={1000000} max={10000000} step={100000}
                  format={v => fmtShares(v)} onChange={setTs2FounderShares} />
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="ts-metrics-grid">
              <MetricCard label="TS1 Post-Money" value={fmtM(dealStructure.ts1.postMoney)} color="#2563eb" />
              <MetricCard label="TS2 Post-Money" value={fmtM(dealStructure.ts2.postMoney)} color="#7c3aed" />
              <MetricCard label="TS1 Founder Ownership" value={fmtPct(dealStructure.ts1.founderPct)} color="#2563eb" />
              <MetricCard label="TS2 Founder Ownership" value={fmtPct(dealStructure.ts2.founderPct)} color="#7c3aed" />
            </div>

            {/* Comparison Table */}
            <div className="ts-card">
              <h3 className="ts-card-title">Side-by-Side Comparison</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500, width: '40%' }}>Metric</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>TS1 — GVP</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>TS2 — GCP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderComparisonRow('Share Price', dealStructure.ts1.sharePrice, dealStructure.ts2.sharePrice, fmtDollar, true)}
                    {renderComparisonRow('Pre-Money Valuation', dealStructure.ts1.preMoney, dealStructure.ts2.preMoney, fmtM, true)}
                    {renderComparisonRow('Investment Amount', dealStructure.ts1.investment, dealStructure.ts2.investment, fmtM, false)}
                    {renderComparisonRow('Post-Money Valuation', dealStructure.ts1.postMoney, dealStructure.ts2.postMoney, fmtM, true)}
                    {renderComparisonRow('Series A Shares Issued', dealStructure.ts1.sharesIssued, dealStructure.ts2.sharesIssued, fmtShares, false)}
                    {renderComparisonRow('Founder Shares', dealStructure.ts1.founderShares, dealStructure.ts2.founderShares, fmtShares, true)}
                    {renderComparisonRow('Option Pool Shares', dealStructure.ts1.optionPool, dealStructure.ts2.optionPool, fmtShares, false)}
                    {renderComparisonRow('Total Shares', dealStructure.ts1.totalShares, dealStructure.ts2.totalShares, fmtShares, false)}
                    {renderComparisonRow('Series A Ownership', dealStructure.ts1.seriesAPct, dealStructure.ts2.seriesAPct, fmtPct, false)}
                    {renderComparisonRow('Founder Ownership', dealStructure.ts1.founderPct, dealStructure.ts2.founderPct, fmtPct, true)}
                    {renderComparisonRow('Option Pool %', dealStructure.ts1.optionPct, dealStructure.ts2.optionPct, fmtPct, false)}
                    {renderComparisonRow('Founder Value', dealStructure.ts1.founderValue, dealStructure.ts2.founderValue, fmtM, true)}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
                Green highlight = better for founders. Red highlight = worse for founders.
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* SECTION B: LIQUIDATION PREFERENCES           */}
        {/* ============================================ */}
        {activeSection === 'liquidation' && (
          <>
            {/* Inputs Panel */}
            <div className="ts-two-col" style={{ marginBottom: 28 }}>
              <div className="ts-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }} />
                  <h3 className="ts-card-title" style={{ margin: 0, color: '#2563eb' }}>TS1 — GVP Terms</h3>
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>Dividend:</span> Non-cumulative
                </div>
                <Slider label="Dividend per Share (annual)" value={ts1DivPerShare} min={0} max={0.50} step={0.01}
                  format={v => fmtDollar(v)} onChange={setTs1DivPerShare} />
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>Participation:</span> Non-participating
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12, lineHeight: 1.6 }}>
                  Preference = Investment + declared dividends. Since non-cumulative, dividends assumed not declared. VC takes MAX(preference, as-converted value).
                </div>
              </div>

              <div className="ts-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c3aed' }} />
                  <h3 className="ts-card-title" style={{ margin: 0, color: '#7c3aed' }}>TS2 — GCP Terms</h3>
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>Dividend:</span> Cumulative (capped)
                </div>
                <Slider label="Dividend per Share (annual)" value={ts2DivPerShare} min={0} max={0.50} step={0.01}
                  format={v => fmtDollar(v)} onChange={setTs2DivPerShare} />
                <Slider label="Dividend Cap (% of issue price)" value={ts2DivCap} min={0} max={100} step={5}
                  format={v => `${v}%`} onChange={setTs2DivCap} />
                <Slider label="Guaranteed Return (% pa)" value={ts2GuaranteedReturn} min={0} max={25} step={0.5}
                  format={v => `${v.toFixed(1)}%`} onChange={setTs2GuaranteedReturn} />
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>Participation:</span> Fully participating
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12, lineHeight: 1.6 }}>
                  Preference = Investment + guaranteed return + cumulative dividends. Then participates pro-rata in remaining proceeds on as-converted basis.
                </div>
              </div>
            </div>

            {/* Common input: years to exit */}
            <div className="ts-card" style={{ maxWidth: 400 }}>
              <Slider label="Years to Exit" value={yearsToExit} min={1} max={10} step={1}
                format={v => `${v} years`} onChange={setYearsToExit} />
            </div>

            {/* Key Metrics */}
            <div className="ts-metrics-grid" style={{ marginTop: 28 }}>
              <MetricCard label="TS1 Preference" value={fmtM(dealStructure.ts1.investment)} color="#2563eb" />
              <MetricCard label="TS2 Preference" value={(() => {
                const ts2 = dealStructure.ts2;
                const guaranteedReturn = ts2.investment * (Math.pow(1 + ts2GuaranteedReturn / 100, yearsToExit) - 1);
                const capPerShare = (ts2DivCap / 100) * ts2SharePrice;
                const yearsToCap = ts2DivPerShare > 0 ? capPerShare / ts2DivPerShare : yearsToExit;
                const effectiveDivYears = Math.min(yearsToExit, yearsToCap);
                const cumulDivs = ts2.sharesIssued * ts2DivPerShare * effectiveDivYears;
                return fmtM(ts2.investment + guaranteedReturn + cumulDivs);
              })()} color="#7c3aed" />
              <MetricCard label="TS1 Conversion Threshold" value={fmtM(liquidationData.ts1ConversionThreshold)} color="#2563eb" />
              <MetricCard label="TS1 Series A %" value={fmtPct(dealStructure.ts1.seriesAPct)} color="#0d9488" />
            </div>

            {/* Waterfall Table */}
            <div className="ts-card" style={{ marginTop: 28 }}>
              <h3 className="ts-card-title">Liquidation Waterfall Comparison</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th rowSpan={2} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500, verticalAlign: 'bottom' }}>Exit Value</th>
                      <th colSpan={3} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>TS1 — GVP (Non-Participating)</th>
                      <th colSpan={3} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>TS2 — GCP (Participating)</th>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 500 }}>VC Payout</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 500 }}>Common</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 500 }}>Eff. VC %</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 500 }}>VC Payout</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 500 }}>Common</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 500 }}>Eff. VC %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidationData.tableData.map(row => {
                      const ts1Worse = row.ts1.vcPayout > row.ts2.vcPayout;
                      const ts2Worse = row.ts2.vcPayout > row.ts1.vcPayout;
                      return (
                        <tr key={row.exitVal} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1e293b', fontFamily: 'monospace' }}>{fmtM(row.exitVal)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#2563eb' }}>{fmtM(row.ts1.vcPayout)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: row.ts1.commonPayout >= 0 ? '#16a34a' : '#dc2626' }}>{fmtM(row.ts1.commonPayout)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{fmtPct(row.ts1.effectiveVcPct)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#7c3aed' }}>{fmtM(row.ts2.vcPayout)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: row.ts2.commonPayout >= 0 ? '#16a34a' : '#dc2626' }}>{fmtM(row.ts2.commonPayout)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{fmtPct(row.ts2.effectiveVcPct)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart */}
            <div className="ts-card" style={{ marginTop: 28 }}>
              <h3 className="ts-card-title">VC Payout by Exit Value</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={liquidationData.chartData} margin={{ top: 10, right: 30, left: 20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="exitVal"
                    type="number"
                    domain={[0, 150]}
                    tickFormatter={v => `$${v}m`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    label={{ value: 'Exit Value ($m)', position: 'bottom', offset: 10, style: { fontSize: 11, fill: '#94a3b8' } }}
                  />
                  <YAxis
                    tickFormatter={v => `$${v}m`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    label={{ value: 'VC Payout ($m)', angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: 11, fill: '#94a3b8' } }}
                  />
                  <Tooltip
                    formatter={(val, name) => [`$${val.toFixed(2)}m`, name]}
                    labelFormatter={v => `Exit: $${v.toFixed(1)}m`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="proRata" stroke="#e2e8f0" strokeWidth={1.5}
                    strokeDasharray="6 4" dot={false} name="TS1 Pro-Rata (as-converted)" />
                  <Line type="monotone" dataKey="ts1Payout" stroke="#2563eb" strokeWidth={2.5}
                    dot={false} name="TS1 — GVP" />
                  <Line type="monotone" dataKey="ts2Payout" stroke="#7c3aed" strokeWidth={2.5}
                    dot={false} name="TS2 — GCP" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                TS2 participating preferred results in higher VC payouts across most exit scenarios due to the combination of guaranteed return, cumulative dividends, and pro-rata participation.
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* SECTION C: ANTI-DILUTION PROTECTION          */}
        {/* ============================================ */}
        {activeSection === 'anti-dilution' && (
          <>
            {/* Inputs Panel */}
            <div className="ts-card" style={{ marginBottom: 28 }}>
              <h3 className="ts-card-title">Down-Round Scenario</h3>
              <div className="ts-two-col">
                <div>
                  <Slider label="Down-Round Investment" value={downRoundInvestment} min={500000} max={5000000} step={100000}
                    format={v => fmtM(v)} onChange={setDownRoundInvestment} />
                  <Slider label="Down-Round Share Price" value={downRoundPrice} min={0.10} max={1.00} step={0.01}
                    format={v => fmtDollar(v)} onChange={setDownRoundPrice} />
                </div>
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <div className="ts-section-label">TS1 Anti-Dilution Type</div>
                    <div className="ts-toggle-group">
                      <button className={`ts-toggle-btn${ts1AntiDilution === 'none' ? ' active' : ''}`}
                        onClick={() => setTs1AntiDilution('none')}>None</button>
                      <button className={`ts-toggle-btn${ts1AntiDilution === 'weighted-average' ? ' active' : ''}`}
                        onClick={() => setTs1AntiDilution('weighted-average')}>Weighted Avg</button>
                      <button className={`ts-toggle-btn${ts1AntiDilution === 'full-ratchet' ? ' active' : ''}`}
                        onClick={() => setTs1AntiDilution('full-ratchet')}>Full Ratchet</button>
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div className="ts-section-label">TS2 Anti-Dilution Type</div>
                    <div className="ts-toggle-group">
                      <button className={`ts-toggle-btn${ts2AntiDilution === 'none' ? ' active' : ''}`}
                        onClick={() => setTs2AntiDilution('none')}>None</button>
                      <button className={`ts-toggle-btn${ts2AntiDilution === 'weighted-average' ? ' active' : ''}`}
                        onClick={() => setTs2AntiDilution('weighted-average')}>Weighted Avg</button>
                      <button className={`ts-toggle-btn${ts2AntiDilution === 'full-ratchet' ? ' active' : ''}`}
                        onClick={() => setTs2AntiDilution('full-ratchet')}>Full Ratchet</button>
                      <button className={`ts-toggle-btn${ts2AntiDilution === 'hybrid' ? ' active' : ''}`}
                        onClick={() => setTs2AntiDilution('hybrid')}>Hybrid</button>
                    </div>
                    {ts2AntiDilution === 'hybrid' && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                        Weighted average above 50% of share price ({fmtDollar(dealStructure.ts2.sharePrice * 0.5)}), full ratchet at or below.
                        Current down-round price ({fmtDollar(downRoundPrice)}) triggers: <span style={{ fontWeight: 600, color: '#7c3aed' }}>
                          {downRoundPrice > dealStructure.ts2.sharePrice * 0.5 ? 'Weighted Average' : 'Full Ratchet'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="ts-metrics-grid">
              <MetricCard label="TS1 Additional Shares" value={fmtShares(antiDilutionData.ts1.withAD.additionalShares)} color="#2563eb" />
              <MetricCard label="TS2 Additional Shares" value={fmtShares(antiDilutionData.ts2.withAD.additionalShares)} color="#7c3aed" />
              <MetricCard label="TS1 Founder % (with AD)" value={fmtPct(antiDilutionData.ts1.withAD.founderPct)} color={antiDilutionData.ts1.withAD.founderPct >= antiDilutionData.ts2.withAD.founderPct ? '#0d9488' : '#dc2626'} />
              <MetricCard label="TS2 Founder % (with AD)" value={fmtPct(antiDilutionData.ts2.withAD.founderPct)} color={antiDilutionData.ts2.withAD.founderPct >= antiDilutionData.ts1.withAD.founderPct ? '#0d9488' : '#dc2626'} />
            </div>

            {/* Cap Tables — Two columns */}
            <div className="ts-two-col" style={{ marginTop: 28 }}>
              {/* TS1 Column */}
              <div>
                <div className="ts-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }} />
                    <h3 className="ts-card-title" style={{ margin: 0, color: '#2563eb' }}>TS1 — GVP</h3>
                  </div>

                  {renderCapTable(antiDilutionData.ts1.before, '1. Before Down Round', '#1e293b', false)}
                  {renderCapTable(antiDilutionData.ts1.withoutAD, '2. After Down Round (No Anti-Dilution)', '#d97706', true)}
                  {renderCapTable(antiDilutionData.ts1.withAD, `3. After Down Round (${antiDilutionData.ts1.withAD.method})`, '#2563eb', true)}

                  {antiDilutionData.ts1.withAD.additionalShares > 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
                      Anti-dilution adjustment: <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>+{fmtShares(antiDilutionData.ts1.withAD.additionalShares)}</span> shares issued to Series A
                    </div>
                  )}
                </div>
              </div>

              {/* TS2 Column */}
              <div>
                <div className="ts-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c3aed' }} />
                    <h3 className="ts-card-title" style={{ margin: 0, color: '#7c3aed' }}>TS2 — GCP</h3>
                  </div>

                  {renderCapTable(antiDilutionData.ts2.before, '1. Before Down Round', '#1e293b', false)}
                  {renderCapTable(antiDilutionData.ts2.withoutAD, '2. After Down Round (No Anti-Dilution)', '#d97706', true)}
                  {renderCapTable(antiDilutionData.ts2.withAD, `3. After Down Round (${antiDilutionData.ts2.withAD.method})`, '#7c3aed', true)}

                  {antiDilutionData.ts2.withAD.additionalShares > 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
                      Anti-dilution adjustment: <span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: 600 }}>+{fmtShares(antiDilutionData.ts2.withAD.additionalShares)}</span> shares issued to Series A
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dilution Impact Comparison */}
            <div className="ts-card" style={{ marginTop: 28 }}>
              <h3 className="ts-card-title">Founder Dilution Impact Comparison</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>Scenario</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>TS1 Founder %</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>TS2 Founder %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: 500 }}>Before Down Round</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtPct(antiDilutionData.ts1.before.founderPct)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtPct(antiDilutionData.ts2.before.founderPct)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: 500 }}>After Down Round (No AD)</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtPct(antiDilutionData.ts1.withoutAD.founderPct)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtPct(antiDilutionData.ts2.withoutAD.founderPct)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: 500 }}>After Down Round (With AD)</td>
                      <td style={{
                        padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600,
                        color: antiDilutionData.ts1.withAD.founderPct >= antiDilutionData.ts2.withAD.founderPct ? '#0d9488' : '#dc2626',
                      }}>{fmtPct(antiDilutionData.ts1.withAD.founderPct)}</td>
                      <td style={{
                        padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600,
                        color: antiDilutionData.ts2.withAD.founderPct >= antiDilutionData.ts1.withAD.founderPct ? '#0d9488' : '#dc2626',
                      }}>{fmtPct(antiDilutionData.ts2.withAD.founderPct)}</td>
                    </tr>
                    <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: 600 }}>Dilution from AD</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626', fontWeight: 600 }}>
                        {fmtPct(antiDilutionData.ts1.withoutAD.founderPct - antiDilutionData.ts1.withAD.founderPct)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626', fontWeight: 600 }}>
                        {fmtPct(antiDilutionData.ts2.withoutAD.founderPct - antiDilutionData.ts2.withAD.founderPct)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
                "Dilution from AD" shows additional founder dilution caused by anti-dilution adjustments beyond the normal dilution from the down round itself.
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

// Slider subcomponent
function Slider({ label, value, min, max, step, format, onChange }) {
  return (
    <div className="ts-slider-container">
      <div className="ts-slider-label">
        <span>{label}</span>
        <span className="ts-slider-value">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

// Metric card subcomponent
function MetricCard({ label, value, color = '#0d9488' }) {
  return (
    <div className="ts-metric-card">
      <div className="ts-metric-value" style={{ color }}>{value}</div>
      <div className="ts-metric-label">{label}</div>
    </div>
  );
}

export default TermSheetAnalyzer;
