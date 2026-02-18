import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, ResponsiveContainer } from 'recharts';

const PRESETS = {
  standard: {
    label: 'Standard 2/20',
    fundSize: 100,
    investmentPeriod: 5,
    fundLife: 10,
    feeType: 'rate',
    feeRate: 2.0,
    stepDown: false,
    postFeeRate: 2.0,
    feeBasis: 'committed',
    totalBudget: 2.0,
    budgetGrowthRate: 5,
    otherFundsAUM: 0,
    carryRate: 20,
    hurdleRate: 8,
    carryBasis: 'whole-fund',
    successRate: 50,
    grossTVPI: 2.5,
  },
  founderFriendly: {
    label: 'Founder Friendly',
    fundSize: 75,
    investmentPeriod: 4,
    fundLife: 10,
    feeType: 'rate',
    feeRate: 2.0,
    stepDown: true,
    postFeeRate: 1.5,
    feeBasis: 'invested',
    totalBudget: 2.0,
    budgetGrowthRate: 5,
    otherFundsAUM: 0,
    carryRate: 20,
    hurdleRate: 8,
    carryBasis: 'whole-fund',
    successRate: 50,
    grossTVPI: 2.0,
  },
  topTier: {
    label: 'Top-Tier GP',
    fundSize: 500,
    investmentPeriod: 5,
    fundLife: 12,
    feeType: 'rate',
    feeRate: 2.0,
    stepDown: false,
    postFeeRate: 2.0,
    feeBasis: 'committed',
    totalBudget: 2.0,
    budgetGrowthRate: 5,
    otherFundsAUM: 0,
    carryRate: 25,
    hurdleRate: 0,
    carryBasis: 'deal-by-deal',
    successRate: 50,
    grossTVPI: 3.5,
  },
  noHurdle: {
    label: 'No Hurdle',
    fundSize: 200,
    investmentPeriod: 5,
    fundLife: 10,
    feeType: 'rate',
    feeRate: 2.0,
    stepDown: false,
    postFeeRate: 2.0,
    feeBasis: 'committed',
    totalBudget: 2.0,
    budgetGrowthRate: 5,
    otherFundsAUM: 0,
    carryRate: 20,
    hurdleRate: 0,
    carryBasis: 'whole-fund',
    successRate: 50,
    grossTVPI: 2.5,
  },
};

function computeFund(params) {
  const {
    fundSize, investmentPeriod, fundLife, feeType, feeRate, stepDown,
    postFeeRate, feeBasis, totalBudget, budgetGrowthRate, otherFundsAUM,
    carryRate, hurdleRate, carryBasis, successRate, grossTVPI
  } = params;

  const years = [];
  let cumulFees = 0;

  // Pass 1: compute management fees
  for (let y = 1; y <= fundLife; y++) {
    let mgmtFee;

    if (feeType === 'budget') {
      const totalExpense = totalBudget * Math.pow(1 + budgetGrowthRate / 100, y - 1);
      const totalAUM = fundSize + otherFundsAUM;
      mgmtFee = totalAUM > 0 ? totalExpense * (fundSize / totalAUM) : 0;
    } else {
      if (y <= investmentPeriod) {
        mgmtFee = fundSize * (feeRate / 100);
      } else {
        const rate = stepDown ? postFeeRate : feeRate;
        if (feeBasis === 'invested') {
          const investedCap = fundSize - cumulFees;
          mgmtFee = investedCap * (rate / 100);
        } else {
          mgmtFee = fundSize * (rate / 100);
        }
      }
    }

    cumulFees += mgmtFee;
    years.push({ year: y, mgmtFee, cumulFees });
  }

  const totalFees = cumulFees;
  const investedCapital = fundSize - totalFees;
  const grossProceeds = investedCapital * grossTVPI;

  // Distribute returns: ramp from year 4 to fund end
  const distStartYear = Math.min(4, fundLife);
  const distYears = Math.max(1, fundLife - distStartYear + 1);
  let totalWeight = 0;
  for (let i = 0; i < distYears; i++) totalWeight += (i + 1);

  // Carry calculation
  const totalProfit = grossProceeds - fundSize;
  let hurdleAmount = 0;
  if (hurdleRate > 0) {
    hurdleAmount = fundSize * (Math.pow(1 + hurdleRate / 100, fundLife) - 1);
  }

  // Whole-fund carry (always computed for clawback comparison)
  const wholeFundCarryable = Math.max(0, totalProfit - hurdleAmount);
  const wholeFundCarry = wholeFundCarryable * (carryRate / 100);

  // Deal-by-deal carry and clawback
  let dealByDealCarry = 0;
  let clawback = 0;
  let totalCarry;

  if (carryBasis === 'deal-by-deal') {
    const winnerCost = investedCapital * (successRate / 100);
    dealByDealCarry = (carryRate / 100) * Math.max(0, grossProceeds - winnerCost);
    clawback = Math.max(0, dealByDealCarry - wholeFundCarry);
    totalCarry = wholeFundCarry; // After clawback, GP keeps only whole-fund carry
  } else {
    totalCarry = wholeFundCarry;
  }

  // Assign distributions and carry per year
  let cumulDist = 0;
  let cumulCarry = 0;
  for (let i = 0; i < years.length; i++) {
    const y = years[i].year;
    if (y >= distStartYear && grossProceeds > 0) {
      const weight = (y - distStartYear + 1) / totalWeight;
      const dist = grossProceeds * weight;
      const carry = totalCarry * weight;
      cumulDist += dist;
      cumulCarry += carry;
      years[i].distribution = dist;
      years[i].carry = carry;
      years[i].cumulDist = cumulDist;
      years[i].cumulCarry = cumulCarry;
      years[i].netToLP = dist - carry - years[i].mgmtFee;
    } else {
      years[i].distribution = 0;
      years[i].carry = 0;
      years[i].cumulDist = cumulDist;
      years[i].cumulCarry = cumulCarry;
      years[i].netToLP = -years[i].mgmtFee;
    }
  }

  const netToLPs = grossProceeds - totalFees - totalCarry;
  const netTVPI = netToLPs / fundSize;

  return {
    years,
    totalFees,
    investedCapital,
    grossProceeds,
    totalCarry,
    dealByDealCarry,
    clawback,
    netToLPs,
    netTVPI,
    feeDrag: grossTVPI - (netToLPs / fundSize),
  };
}

function computeNetTVPI(params, grossTVPI) {
  const p = { ...params, grossTVPI };
  const result = computeFund(p);
  return result.netTVPI;
}

const FundFees = () => {
  const [selectedPreset, setSelectedPreset] = useState('standard');
  const [params, setParams] = useState({ ...PRESETS.standard });

  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setSelectedPreset(null);
  };

  const applyPreset = (key) => {
    setSelectedPreset(key);
    setParams({ ...PRESETS[key] });
  };

  const result = useMemo(() => computeFund(params), [params]);

  const sensitivityData = useMemo(() => {
    const points = [];
    for (let g = 0.5; g <= 5.0; g += 0.1) {
      const gross = Math.round(g * 10) / 10;
      const net = computeNetTVPI(params, gross);
      points.push({ gross, net, noFee: gross });
    }
    return points;
  }, [params]);

  const showClawback = params.carryBasis === 'deal-by-deal' && result.clawback > 0;

  // Waterfall chart data
  const waterfall = useMemo(() => {
    const { totalFees, investedCapital, grossProceeds, totalCarry, dealByDealCarry, clawback, netToLPs } = result;
    const fundSize = params.fundSize;
    const grossReturns = grossProceeds - investedCapital;

    if (showClawback) {
      // 7-bar waterfall with deal-by-deal carry and clawback
      const afterDbdCarry = grossProceeds - dealByDealCarry;
      return [
        { label: 'Committed\nCapital', value: fundSize, start: 0, color: '#0d9488', type: 'add' },
        { label: 'Mgmt\nFees', value: totalFees, start: fundSize - totalFees, color: '#dc2626', type: 'subtract' },
        { label: 'Invested\nCapital', value: investedCapital, start: 0, color: '#2563eb', type: 'subtotal' },
        { label: 'Gross\nReturns', value: grossReturns > 0 ? grossReturns : 0, start: investedCapital, color: '#16a34a', type: 'add' },
        { label: 'D-b-D\nCarry', value: dealByDealCarry, start: grossProceeds - dealByDealCarry, color: '#dc2626', type: 'subtract' },
        { label: 'Clawback', value: clawback, start: afterDbdCarry, color: '#16a34a', type: 'add' },
        { label: 'Net to\nLPs', value: netToLPs, start: 0, color: '#0d9488', type: 'total' },
      ];
    }

    return [
      { label: 'Committed\nCapital', value: fundSize, start: 0, color: '#0d9488', type: 'add' },
      { label: 'Mgmt\nFees', value: totalFees, start: fundSize - totalFees, color: '#dc2626', type: 'subtract' },
      { label: 'Invested\nCapital', value: investedCapital, start: 0, color: '#2563eb', type: 'subtotal' },
      { label: 'Gross\nReturns', value: grossReturns > 0 ? grossReturns : 0, start: investedCapital, color: '#16a34a', type: 'add' },
      { label: 'Carry', value: totalCarry, start: grossProceeds - totalCarry, color: '#dc2626', type: 'subtract' },
      { label: 'Net to\nLPs', value: netToLPs, start: 0, color: '#0d9488', type: 'total' },
    ];
  }, [result, params.fundSize, params.carryBasis, showClawback]);

  const fmtM = (v) => `$${v.toFixed(1)}m`;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .ff-wrapper { padding: 40px; }
        .ff-title { font-size: 38px; }
        .ff-preset-btn {
          padding: 12px 18px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.25s ease;
          border-radius: 8px;
          font-family: 'Source Sans 3', sans-serif;
        }
        .ff-preset-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .ff-preset-btn.active {
          background: linear-gradient(135deg, rgba(13, 148, 136, 0.1), rgba(22, 163, 74, 0.1));
          border-color: rgba(13, 148, 136, 0.4);
          color: #0d9488;
          box-shadow: 0 0 20px rgba(13, 148, 136, 0.1);
        }
        .ff-slider-container { margin-bottom: 20px; }
        .ff-slider-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
          color: #64748b;
        }
        .ff-slider-value {
          font-family: monospace;
          color: #0d9488;
          font-weight: 500;
        }
        input[type="range"] {
          width: 100%;
          height: 5px;
          -webkit-appearance: none;
          background: #e2e8f0;
          border-radius: 3px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: linear-gradient(135deg, #0d9488, #16a34a);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(13, 148, 136, 0.4);
          transition: transform 0.2s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.12);
        }
        .ff-metric-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 18px;
          text-align: center;
        }
        .ff-metric-value {
          font-family: monospace;
          font-size: 26px;
          font-weight: 500;
          color: #0d9488;
          margin-bottom: 4px;
        }
        .ff-metric-label {
          font-size: 11px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .ff-section-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #94a3b8;
          margin-bottom: 16px;
          margin-top: 28px;
          font-weight: 500;
        }
        .ff-toggle-group {
          display: flex;
          gap: 0;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          margin-bottom: 16px;
        }
        .ff-toggle-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: #ffffff;
          color: #64748b;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Source Sans 3', sans-serif;
        }
        .ff-toggle-btn:not(:last-child) { border-right: 1px solid #e2e8f0; }
        .ff-toggle-btn.active {
          background: linear-gradient(135deg, rgba(13, 148, 136, 0.1), rgba(22, 163, 74, 0.1));
          color: #0d9488;
          font-weight: 600;
        }
        .ff-main-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 48px;
        }
        .ff-metrics-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 28px;
        }
        .ff-metrics-grid.has-clawback {
          grid-template-columns: repeat(6, 1fr);
        }
        .ff-chart-container {
          width: 100%;
          overflow: hidden;
        }
        .ff-chart-container svg {
          display: block;
          width: 100%;
          height: auto;
        }
        @media (max-width: 1100px) {
          .ff-main-layout { grid-template-columns: 1fr; gap: 32px; }
          .ff-metrics-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .ff-metrics-grid.has-clawback { grid-template-columns: repeat(3, 1fr); }
          .ff-title { font-size: 28px; }
          .ff-wrapper { padding: 20px; }
          .ff-metric-value { font-size: 20px; }
          .ff-metric-label { font-size: 9px; }
        }
        @media (max-width: 600px) {
          .ff-metrics-grid { grid-template-columns: repeat(2, 1fr); }
          .ff-metrics-grid.has-clawback { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div className="ff-wrapper" style={{
        maxWidth: 1400,
        margin: '0 auto',
        fontFamily: "'Source Sans 3', sans-serif",
        color: '#1e293b',
        background: 'linear-gradient(145deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%)',
        minHeight: '100vh',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 className="ff-title" style={{
            fontFamily: "'Crimson Pro', serif",
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: 8,
            marginTop: 0,
          }}>Fund Fees Explorer</h1>
          <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
            Model VC fund fee structures — management fees, carried interest, hurdle rates, and net LP returns.
          </p>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 36, flexWrap: 'wrap' }}>
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              className={`ff-preset-btn${selectedPreset === key ? ' active' : ''}`}
              onClick={() => applyPreset(key)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Main Layout */}
        <div className="ff-main-layout">
          {/* Left Sidebar */}
          <div>
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 24,
            }}>
              <div className="ff-section-title" style={{ marginTop: 0 }}>Fund Parameters</div>

              <Slider label="Fund Size" value={params.fundSize} min={10} max={1000} step={10}
                format={v => `$${v}m`} onChange={v => updateParam('fundSize', v)} />
              <Slider label="Investment Period" value={params.investmentPeriod} min={2} max={7} step={1}
                format={v => `${v} yrs`} onChange={v => updateParam('investmentPeriod', v)} />
              <Slider label="Fund Life" value={params.fundLife} min={7} max={15} step={1}
                format={v => `${v} yrs`} onChange={v => updateParam('fundLife', v)} />

              <div className="ff-section-title">Management Fees</div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Fee Type</div>
                <div className="ff-toggle-group">
                  <button className={`ff-toggle-btn${params.feeType === 'rate' ? ' active' : ''}`}
                    onClick={() => updateParam('feeType', 'rate')}>Rate-Based</button>
                  <button className={`ff-toggle-btn${params.feeType === 'budget' ? ' active' : ''}`}
                    onClick={() => updateParam('feeType', 'budget')}>Budget-Based</button>
                </div>
              </div>

              {params.feeType === 'rate' ? (
                <>
                  <Slider label="Fee Rate" value={params.feeRate} min={0} max={3} step={0.1}
                    format={v => `${v.toFixed(1)}%`} onChange={v => updateParam('feeRate', v)} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={params.stepDown}
                        onChange={e => updateParam('stepDown', e.target.checked)}
                        style={{ accentColor: '#0d9488' }} />
                      Step-down after investment period
                    </label>
                  </div>

                  {params.stepDown && (
                    <Slider label="Post-Investment Rate" value={params.postFeeRate} min={0} max={3} step={0.1}
                      format={v => `${v.toFixed(1)}%`} onChange={v => updateParam('postFeeRate', v)} />
                  )}

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Fee Basis (post-investment)</div>
                    <div className="ff-toggle-group">
                      <button className={`ff-toggle-btn${params.feeBasis === 'committed' ? ' active' : ''}`}
                        onClick={() => updateParam('feeBasis', 'committed')}>Committed</button>
                      <button className={`ff-toggle-btn${params.feeBasis === 'invested' ? ' active' : ''}`}
                        onClick={() => updateParam('feeBasis', 'invested')}>Invested</button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Slider label="Total GP Budget" value={params.totalBudget} min={0.5} max={10} step={0.1}
                    format={v => `$${v.toFixed(1)}m/yr`} onChange={v => updateParam('totalBudget', v)} />
                  <Slider label="Budget Growth Rate" value={params.budgetGrowthRate} min={0} max={10} step={0.5}
                    format={v => `${v.toFixed(1)}%`} onChange={v => updateParam('budgetGrowthRate', v)} />
                  <Slider label="Other Funds AUM" value={params.otherFundsAUM} min={0} max={2000} step={50}
                    format={v => `$${v}m`} onChange={v => updateParam('otherFundsAUM', v)} />
                </>
              )}

              <div className="ff-section-title">Carry Terms</div>

              <Slider label="Carry Rate" value={params.carryRate} min={0} max={30} step={1}
                format={v => `${v}%`} onChange={v => updateParam('carryRate', v)} />
              <Slider label="Preferred Return (Hurdle)" value={params.hurdleRate} min={0} max={15} step={0.5}
                format={v => `${v.toFixed(1)}%`} onChange={v => updateParam('hurdleRate', v)} />

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Carry Basis</div>
                <div className="ff-toggle-group">
                  <button className={`ff-toggle-btn${params.carryBasis === 'whole-fund' ? ' active' : ''}`}
                    onClick={() => updateParam('carryBasis', 'whole-fund')}>Whole-Fund</button>
                  <button className={`ff-toggle-btn${params.carryBasis === 'deal-by-deal' ? ' active' : ''}`}
                    onClick={() => updateParam('carryBasis', 'deal-by-deal')}>Deal-by-Deal</button>
                </div>
              </div>

              {params.carryBasis === 'deal-by-deal' && (
                <Slider label="Deals That Succeed" value={params.successRate} min={10} max={100} step={5}
                  format={v => `${v}%`} onChange={v => updateParam('successRate', v)} />
              )}

              <div className="ff-section-title">Fund Performance</div>

              <Slider label="Gross TVPI" value={params.grossTVPI} min={0.5} max={5} step={0.1}
                format={v => `${v.toFixed(1)}x`} onChange={v => updateParam('grossTVPI', v)} />
            </div>
          </div>

          {/* Right Content */}
          <div>
            {/* Metric Cards */}
            <div className={`ff-metrics-grid${showClawback ? ' has-clawback' : ''}`}>
              <MetricCard label="Gross TVPI" value={`${params.grossTVPI.toFixed(1)}x`} />
              <MetricCard label="Net TVPI" value={`${result.netTVPI.toFixed(2)}x`}
                color={result.netTVPI >= 1 ? '#16a34a' : '#dc2626'} />
              <MetricCard label="Total Mgmt Fees" value={fmtM(result.totalFees)} color="#d97706" />
              <MetricCard label="Total Carry" value={fmtM(result.totalCarry)} color="#7c3aed" />
              {showClawback && (
                <MetricCard label="Clawback" value={fmtM(result.clawback)} color="#16a34a" />
              )}
              <MetricCard label="Fee Drag" value={`${result.feeDrag.toFixed(2)}x`} color="#dc2626" />
            </div>

            {/* Waterfall Chart */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 28,
              marginBottom: 28,
            }}>
              <h3 style={{
                fontFamily: "'Crimson Pro', serif",
                fontSize: 20,
                fontWeight: 600,
                margin: '0 0 20px 0',
                color: '#1e293b',
              }}>Fee Waterfall</h3>
              <WaterfallChart data={waterfall} />
            </div>

            {/* Sensitivity Chart */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 28,
              marginBottom: 28,
            }}>
              <h3 style={{
                fontFamily: "'Crimson Pro', serif",
                fontSize: 20,
                fontWeight: 600,
                margin: '0 0 20px 0',
                color: '#1e293b',
              }}>Net vs Gross TVPI Sensitivity</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sensitivityData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke="#e2e8f0" />
                  <XAxis dataKey="gross" type="number" domain={[0.5, 5]}
                    tickFormatter={v => `${v.toFixed(1)}x`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    label={{ value: 'Gross TVPI', position: 'bottom', offset: -2, style: { fontSize: 11, fill: '#94a3b8' } }} />
                  <YAxis domain={['auto', 'auto']}
                    tickFormatter={v => `${v.toFixed(1)}x`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    label={{ value: 'Net TVPI', angle: -90, position: 'insideLeft', offset: 5, style: { fontSize: 11, fill: '#94a3b8' } }} />
                  <Tooltip
                    formatter={(val, name) => [`${val.toFixed(2)}x`, name === 'net' ? 'Net TVPI' : 'No Fees']}
                    labelFormatter={v => `Gross: ${v.toFixed(1)}x`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="noFee" stroke="#e2e8f0" strokeWidth={1.5}
                    strokeDasharray="6 4" dot={false} name="No Fees" />
                  <Line type="monotone" dataKey="net" stroke="#0d9488" strokeWidth={2.5}
                    dot={false} name="Net TVPI" />
                  <ReferenceDot x={params.grossTVPI} y={result.netTVPI}
                    r={6} fill="#0d9488" stroke="#ffffff" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                The gap between the lines represents cumulative fee drag at each gross return level.
              </div>
            </div>

            {/* Year-by-Year Table */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 28,
            }}>
              <h3 style={{
                fontFamily: "'Crimson Pro', serif",
                fontSize: 20,
                fontWeight: 600,
                margin: '0 0 20px 0',
                color: '#1e293b',
              }}>Year-by-Year Breakdown</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      {['Year', 'Mgmt Fee', 'Cumul Fees', 'Distribution', 'Carry', ...(showClawback ? ['Clawback'] : []), 'Net to LP'].map(h => (
                        <th key={h} style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontSize: 11,
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          fontWeight: 500,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.years.map(yr => (
                      <tr key={yr.year} style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: '#64748b' }}>
                          {yr.year}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>
                          ${yr.mgmtFee.toFixed(1)}m
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>
                          ${yr.cumulFees.toFixed(1)}m
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: yr.distribution > 0 ? '#16a34a' : '#94a3b8' }}>
                          ${yr.distribution.toFixed(1)}m
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: yr.carry > 0 ? '#7c3aed' : '#94a3b8' }}>
                          ${yr.carry.toFixed(1)}m
                        </td>
                        {showClawback && (
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#16a34a' }}>
                            {yr.year === result.years[result.years.length - 1].year ? `$${result.clawback.toFixed(1)}m` : '—'}
                          </td>
                        )}
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500, color: yr.netToLP >= 0 ? '#0d9488' : '#dc2626' }}>
                          ${yr.netToLP.toFixed(1)}m
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr style={{ borderTop: '2px solid #e2e8f0', fontWeight: 600 }}>
                      <td style={{ padding: '12px 12px', textAlign: 'right', color: '#1e293b' }}>Total</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>
                        ${result.totalFees.toFixed(1)}m
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right' }}></td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#16a34a' }}>
                        ${result.grossProceeds.toFixed(1)}m
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#7c3aed' }}>
                        ${result.totalCarry.toFixed(1)}m
                      </td>
                      {showClawback && (
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#16a34a' }}>
                          ${result.clawback.toFixed(1)}m
                        </td>
                      )}
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#0d9488' }}>
                        ${result.netToLPs.toFixed(1)}m
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Slider subcomponent
function Slider({ label, value, min, max, step, format, onChange }) {
  return (
    <div className="ff-slider-container">
      <div className="ff-slider-label">
        <span>{label}</span>
        <span className="ff-slider-value">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

// Metric card subcomponent
function MetricCard({ label, value, color = '#0d9488' }) {
  return (
    <div className="ff-metric-card">
      <div className="ff-metric-value" style={{ color }}>{value}</div>
      <div className="ff-metric-label">{label}</div>
    </div>
  );
}

// Waterfall chart (SVG)
function WaterfallChart({ data }) {
  const width = 800;
  const height = 360;
  const pad = { top: 40, right: 30, bottom: 70, left: 80 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map(d => d.start + d.value), ...data.map(d => d.value));
  const scaleY = (v) => pad.top + chartH - (v / maxVal) * chartH;
  const barW = chartW / data.length;
  const barPad = barW * 0.2;

  return (
    <div className="ff-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const val = maxVal * frac;
          const y = scaleY(val);
          return (
            <g key={frac}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y}
                stroke="#e2e8f0" strokeDasharray="4,6" />
              <text x={pad.left - 10} y={y + 4} textAnchor="end"
                fill="#94a3b8" fontSize={11} fontFamily="monospace">
                ${(val).toFixed(0)}m
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = pad.left + i * barW + barPad;
          const w = barW - barPad * 2;
          const barTop = scaleY(d.start + d.value);
          const barBottom = scaleY(d.start);
          const barHeight = barBottom - barTop;
          const isSubtract = d.type === 'subtract';

          return (
            <g key={i}>
              {/* Connector lines between bars */}
              {i > 0 && i < data.length - 1 && (
                <line
                  x1={pad.left + (i - 1) * barW + barW - barPad}
                  y1={d.type === 'subtract' ? scaleY(d.start + d.value) : scaleY(data[i - 1].start + data[i - 1].value)}
                  x2={x}
                  y2={d.type === 'subtract' ? scaleY(d.start + d.value) : scaleY(data[i - 1].start + data[i - 1].value)}
                  stroke="#cbd5e1" strokeDasharray="3,3" strokeWidth={1}
                />
              )}
              <rect
                x={x} y={barTop} width={w} height={Math.max(1, barHeight)}
                fill={d.color}
                rx={3}
                opacity={isSubtract ? 0.85 : 1}
              />
              {/* Value label on bar */}
              <text
                x={x + w / 2}
                y={barTop - 8}
                textAnchor="middle"
                fill={d.color}
                fontSize={12}
                fontFamily="monospace"
                fontWeight={500}
              >
                {isSubtract ? '−' : ''}${d.value.toFixed(1)}m
              </text>
              {/* X-axis label */}
              {d.label.split('\n').map((line, li) => (
                <text
                  key={li}
                  x={x + w / 2}
                  y={height - pad.bottom + 18 + li * 14}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize={11}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={pad.left} y1={scaleY(0)} x2={width - pad.right} y2={scaleY(0)}
          stroke="#94a3b8" strokeWidth={1} />
      </svg>
    </div>
  );
}

export default FundFees;
