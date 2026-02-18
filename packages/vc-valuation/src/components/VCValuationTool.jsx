import React, { useState, useMemo } from 'react';

const VCValuationTool = () => {
  // Stage presets with characteristic survival rates
  const stagePresets = {
    preSeed: {
      name: 'Pre-Seed',
      survivalRate: 0.10,
      yearsToEstablished: 6,
      baseDiscount: 0.20,
      typicalRevenue: 0,
      typicalMultiple: 20,
      description: 'Idea stage. High uncertainty, minimal traction. 10% survive to established.'
    },
    seed: {
      name: 'Seed',
      survivalRate: 0.20,
      yearsToEstablished: 5,
      baseDiscount: 0.18,
      typicalRevenue: 200,
      typicalMultiple: 15,
      description: 'Early product, initial customers. 20% survival rate over 5 years.'
    },
    seriesA: {
      name: 'Series A',
      survivalRate: 0.35,
      yearsToEstablished: 4,
      baseDiscount: 0.15,
      typicalRevenue: 1500,
      typicalMultiple: 12,
      description: 'Product-market fit emerging. 35% reach established stage.'
    },
    seriesB: {
      name: 'Series B',
      survivalRate: 0.50,
      yearsToEstablished: 3,
      baseDiscount: 0.12,
      typicalRevenue: 8000,
      typicalMultiple: 10,
      description: 'Scaling operations. 50% survival, more predictable trajectory.'
    },
    growth: {
      name: 'Growth',
      survivalRate: 0.70,
      yearsToEstablished: 2,
      baseDiscount: 0.10,
      typicalRevenue: 30000,
      typicalMultiple: 8,
      description: 'Proven model, scaling aggressively. 70% reach exit/establishment.'
    }
  };

  // Default comparables
  const defaultComparables = [
    { name: 'Comparable A', valuation: 50, revenue: 5, stage: 'Series A' },
    { name: 'Comparable B', valuation: 80, revenue: 8, stage: 'Series A' },
    { name: 'Comparable C', valuation: 120, revenue: 15, stage: 'Series B' },
  ];

  const [selectedStage, setSelectedStage] = useState('seriesA');

  // DCF Inputs
  const [currentRevenue, setCurrentRevenue] = useState(1500); // £k
  const [revenueGrowthY1, setRevenueGrowthY1] = useState(100);
  const [revenueGrowthY2, setRevenueGrowthY2] = useState(80);
  const [revenueGrowthY3, setRevenueGrowthY3] = useState(60);
  const [revenueGrowthY4, setRevenueGrowthY4] = useState(40);
  const [revenueGrowthY5, setRevenueGrowthY5] = useState(30);
  const [grossMargin, setGrossMargin] = useState(70);
  const [opexAsRevenuePct, setOpexAsRevenuePct] = useState(90); // Operating expenses as % of revenue
  const [terminalMultiple, setTerminalMultiple] = useState(10);

  // Risk Adjustment Inputs
  const [baseDiscountRate, setBaseDiscountRate] = useState(15);
  const [survivalRate, setSurvivalRate] = useState(35);
  const [yearsToEstablished, setYearsToEstablished] = useState(4);

  // Quality Scores (1-5 scale)
  const [teamScore, setTeamScore] = useState(3);
  const [productScore, setProductScore] = useState(3);
  const [marketScore, setMarketScore] = useState(3);
  const [tractionScore, setTractionScore] = useState(3);
  const [defensibilityScore, setDefensibilityScore] = useState(3);

  // Comparables
  const [comparables, setComparables] = useState(defaultComparables);
  const [showComparableEditor, setShowComparableEditor] = useState(false);

  const handleStageChange = (stage) => {
    setSelectedStage(stage);
    const preset = stagePresets[stage];
    setSurvivalRate(preset.survivalRate * 100);
    setYearsToEstablished(preset.yearsToEstablished);
    setBaseDiscountRate(preset.baseDiscount * 100);
    setCurrentRevenue(preset.typicalRevenue);
    setTerminalMultiple(preset.typicalMultiple);
  };

  const updateComparable = (index, field, value) => {
    setComparables(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Core calculations
  const calculations = useMemo(() => {
    // Revenue projections
    const growthRates = [revenueGrowthY1, revenueGrowthY2, revenueGrowthY3, revenueGrowthY4, revenueGrowthY5];
    const revenues = [currentRevenue];
    for (let i = 0; i < 5; i++) {
      revenues.push(revenues[i] * (1 + growthRates[i] / 100));
    }

    // Cash flows (simplified: Gross Profit - OpEx)
    const cashFlows = revenues.slice(1).map((rev, i) => {
      const grossProfit = rev * (grossMargin / 100);
      const opex = rev * (opexAsRevenuePct / 100);
      return grossProfit - opex;
    });

    // Terminal value (based on Year 5 revenue)
    const terminalValue = revenues[5] * terminalMultiple;

    // === RISK ADJUSTMENT CALCULATION ===
    const s = survivalRate / 100;
    const n = yearsToEstablished;
    const r = baseDiscountRate / 100;

    // Annual failure rate: f = 1 - s^(1/n)
    const annualFailureRate = 1 - Math.pow(s, 1 / n);

    // Adjusted discount rate: r_adj = (r + f) / (1 - f)
    const adjustedDiscountRate = (r + annualFailureRate) / (1 - annualFailureRate);

    // === DCF CALCULATIONS ===
    // Base DCF (using unadjusted rate)
    let baseDCF = 0;
    for (let i = 0; i < 5; i++) {
      baseDCF += cashFlows[i] / Math.pow(1 + r, i + 1);
    }
    baseDCF += terminalValue / Math.pow(1 + r, 5);

    // Risk-adjusted DCF (using adjusted rate)
    let adjustedDCF = 0;
    for (let i = 0; i < 5; i++) {
      adjustedDCF += cashFlows[i] / Math.pow(1 + adjustedDiscountRate, i + 1);
    }
    adjustedDCF += terminalValue / Math.pow(1 + adjustedDiscountRate, 5);

    // === COMPARABLE ANALYSIS ===
    const validComparables = comparables.filter(c => c.revenue > 0 && c.valuation > 0);
    const multiples = validComparables.map(c => c.valuation / c.revenue);
    const medianMultiple = multiples.length > 0
      ? multiples.sort((a, b) => a - b)[Math.floor(multiples.length / 2)]
      : terminalMultiple;
    const avgMultiple = multiples.length > 0
      ? multiples.reduce((a, b) => a + b, 0) / multiples.length
      : terminalMultiple;

    // Quality adjustment factors (multiplicative, centred on 1.0)
    // Score of 3 = neutral (1.0x), Score of 1 = 0.7x, Score of 5 = 1.3x
    const scoreToMultiplier = (score, weight) => {
      const deviation = (score - 3) / 2; // -1 to +1
      const maxAdjustment = weight; // e.g., 0.15 for 15%
      return 1 + (deviation * maxAdjustment);
    };

    const qualityFactors = {
      team: { score: teamScore, weight: 0.20, multiplier: scoreToMultiplier(teamScore, 0.20) },
      product: { score: productScore, weight: 0.20, multiplier: scoreToMultiplier(productScore, 0.20) },
      market: { score: marketScore, weight: 0.15, multiplier: scoreToMultiplier(marketScore, 0.15) },
      traction: { score: tractionScore, weight: 0.15, multiplier: scoreToMultiplier(tractionScore, 0.15) },
      defensibility: { score: defensibilityScore, weight: 0.10, multiplier: scoreToMultiplier(defensibilityScore, 0.10) }
    };

    const totalQualityMultiplier = Object.values(qualityFactors)
      .reduce((acc, f) => acc * f.multiplier, 1);

    // Comparable-based valuation
    const comparableBaseValue = currentRevenue * medianMultiple;
    const comparableAdjustedValue = comparableBaseValue * totalQualityMultiplier;

    // === VALUATION SUMMARY ===
    const valuationRange = {
      low: Math.min(adjustedDCF, comparableAdjustedValue * 0.8),
      mid: (adjustedDCF + comparableAdjustedValue) / 2,
      high: Math.max(baseDCF * 0.8, comparableAdjustedValue * 1.2)
    };

    return {
      revenues,
      cashFlows,
      terminalValue,
      annualFailureRate,
      adjustedDiscountRate,
      baseDCF,
      adjustedDCF,
      discountImpact: baseDCF > 0 ? ((baseDCF - adjustedDCF) / baseDCF) * 100 : 0,
      multiples,
      medianMultiple,
      avgMultiple,
      qualityFactors,
      totalQualityMultiplier,
      comparableBaseValue,
      comparableAdjustedValue,
      valuationRange
    };
  }, [currentRevenue, revenueGrowthY1, revenueGrowthY2, revenueGrowthY3, revenueGrowthY4, revenueGrowthY5,
      grossMargin, opexAsRevenuePct, terminalMultiple, baseDiscountRate, survivalRate, yearsToEstablished,
      teamScore, productScore, marketScore, tractionScore, defensibilityScore, comparables]);

  // Format helpers
  const formatValue = (val) => {
    if (Math.abs(val) >= 1000000) return `£${(val / 1000000).toFixed(1)}bn`;
    if (Math.abs(val) >= 1000) return `£${(val / 1000).toFixed(1)}m`;
    return `£${val.toFixed(0)}k`;
  };

  const formatPct = (val) => `${(val * 100).toFixed(1)}%`;

  return (
    <div className="page-wrapper">
      <style>{`
        * { box-sizing: border-box; }

        .page-wrapper {
          min-height: 100vh;
          background: #f8fafc;
          color: #334155;
          font-family: 'Source Sans 3', -apple-system, sans-serif;
          padding: 40px;
        }

        .page-title {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 32px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 10px;
          letter-spacing: -0.5px;
        }

        .stage-btn {
          padding: 12px 18px;
          border: 1px solid rgba(37, 99, 235, 0.1);
          background: rgba(241, 245, 249, 0.9);
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 6px;
        }
        .stage-btn:hover {
          background: rgba(226, 232, 240, 0.9);
          border-color: rgba(37, 99, 235, 0.2);
          color: #334155;
        }
        .stage-btn.active {
          background: rgba(37, 99, 235, 0.08);
          border-color: rgba(37, 99, 235, 0.4);
          color: #2563eb;
        }

        .panel {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(203, 213, 225, 0.6);
          border-radius: 8px;
          padding: 20px;
        }

        .section-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #94a3b8;
          margin-bottom: 14px;
          font-weight: 600;
        }

        .input-row {
          margin-bottom: 16px;
        }
        .input-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 11px;
        }
        .input-label { color: #64748b; }
        .input-value {
          font-family: monospace;
          color: #2563eb;
          font-weight: 500;
        }
        input[type="range"] {
          width: 100%;
          height: 4px;
          -webkit-appearance: none;
          background: rgba(203, 213, 225, 0.5);
          border-radius: 2px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          background: #2563eb;
          border-radius: 50%;
          cursor: pointer;
        }

        .metric-card {
          background: rgba(241, 245, 249, 0.8);
          border: 1px solid rgba(203, 213, 225, 0.5);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }
        .metric-value {
          font-family: monospace;
          font-size: 24px;
          color: #2563eb;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .metric-label {
          font-size: 10px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .score-btn {
          width: 32px;
          height: 32px;
          border: 1px solid rgba(203, 213, 225, 0.6);
          background: rgba(241, 245, 249, 0.8);
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.15s;
        }
        .score-btn:hover {
          background: rgba(226, 232, 240, 0.8);
          border-color: rgba(37, 99, 235, 0.2);
        }
        .score-btn.active {
          background: rgba(37, 99, 235, 0.1);
          border-color: rgba(37, 99, 235, 0.4);
          color: #2563eb;
        }

        .formula-box {
          background: rgba(241, 245, 249, 0.9);
          border: 1px solid rgba(203, 213, 225, 0.4);
          border-radius: 6px;
          padding: 14px;
          font-family: monospace;
          font-size: 12px;
          color: #64748b;
          margin-top: 12px;
        }

        .comparable-row {
          display: grid;
          grid-template-columns: 1fr 70px 70px 70px;
          gap: 8px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(203, 213, 225, 0.3);
          font-size: 11px;
          align-items: center;
        }
        .comparable-input {
          background: rgba(241, 245, 249, 0.9);
          border: 1px solid rgba(203, 213, 225, 0.5);
          color: #334155;
          padding: 6px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-family: monospace;
          width: 100%;
        }
        .comparable-input:focus {
          outline: none;
          border-color: rgba(37, 99, 235, 0.4);
        }

        .valuation-bar {
          height: 40px;
          background: rgba(241, 245, 249, 0.8);
          border-radius: 6px;
          position: relative;
          overflow: hidden;
          margin: 16px 0;
        }
        .valuation-marker {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 3px;
          background: #2563eb;
          border-radius: 2px;
        }
        .valuation-range {
          position: absolute;
          top: 8px;
          bottom: 8px;
          background: rgba(88, 166, 255, 0.2);
          border-radius: 4px;
        }

        .main-layout {
          display: grid;
          grid-template-columns: 320px 1fr 340px;
          gap: 24px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .financials-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          font-size: 11px;
          font-family: monospace;
        }

        .quality-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(203, 213, 225, 0.3);
        }

        .quality-label {
          width: 100px;
        }

        .score-buttons {
          display: flex;
          gap: 4px;
        }

        @media (max-width: 1200px) {
          .main-layout {
            grid-template-columns: 1fr 1fr;
          }
          .main-layout > div:nth-child(3) {
            grid-column: span 2;
          }
        }

        @media (max-width: 900px) {
          .page-wrapper {
            padding: 20px;
          }
          .page-title {
            font-size: 26px;
          }
          .main-layout {
            grid-template-columns: 1fr;
          }
          .main-layout > div:nth-child(3) {
            grid-column: span 1;
          }
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .metric-value {
            font-size: 20px;
          }
          .stage-btn {
            padding: 10px 14px;
            font-size: 11px;
          }
          .financials-grid {
            font-size: 10px;
            gap: 4px;
          }
          .quality-row {
            flex-wrap: wrap;
          }
          .quality-label {
            width: 100%;
            margin-bottom: 8px;
          }
          .comparable-row {
            grid-template-columns: 1fr 60px 60px 60px;
            gap: 4px;
            font-size: 10px;
          }
        }

        @media (max-width: 500px) {
          .metrics-grid {
            grid-template-columns: 1fr 1fr;
          }
          .metric-card {
            padding: 12px;
          }
          .metric-value {
            font-size: 18px;
          }
          .financials-grid {
            overflow-x: auto;
          }
        }
      `}</style>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '2.5px',
            color: '#94a3b8',
            marginBottom: '8px'
          }}>
            Startup Valuation Framework
          </div>
          <h1 className="page-title">
            VC Method Valuation
          </h1>
          <p style={{
            color: '#94a3b8',
            fontSize: '13px',
            maxWidth: '700px',
            lineHeight: 1.6
          }}>
            Combine DCF fundamentals with venture-specific risk adjustment and comparable benchmarking.
            The risk-adjusted discount rate reflects the probability of total loss, not just volatility.
          </p>
        </div>

        {/* Stage Selection */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          {Object.entries(stagePresets).map(([key, preset]) => (
            <button
              key={key}
              className={`stage-btn ${selectedStage === key ? 'active' : ''}`}
              onClick={() => handleStageChange(key)}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div style={{
          background: 'rgba(37, 99, 235, 0.04)',
          border: '1px solid rgba(37, 99, 235, 0.08)',
          borderRadius: '6px',
          padding: '12px 16px',
          marginBottom: '28px',
          fontSize: '12px',
          color: '#64748b'
        }}>
          {stagePresets[selectedStage]?.description}
        </div>

        {/* Main Grid */}
        <div className="main-layout">

          {/* Left Column - DCF Inputs */}
          <div>
            <div className="panel" style={{ marginBottom: '16px' }}>
              <h3 className="section-title">Revenue Projections</h3>

              <div className="input-row">
                <div className="input-header">
                  <span className="input-label">Current ARR</span>
                  <span className="input-value">£{currentRevenue.toLocaleString()}k</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50000"
                  step="100"
                  value={currentRevenue}
                  onChange={(e) => setCurrentRevenue(Number(e.target.value))}
                />
              </div>

              {[
                [revenueGrowthY1, setRevenueGrowthY1, 'Y1'],
                [revenueGrowthY2, setRevenueGrowthY2, 'Y2'],
                [revenueGrowthY3, setRevenueGrowthY3, 'Y3'],
                [revenueGrowthY4, setRevenueGrowthY4, 'Y4'],
                [revenueGrowthY5, setRevenueGrowthY5, 'Y5']
              ].map(([val, setter, label]) => (
                <div key={label} className="input-row">
                  <div className="input-header">
                    <span className="input-label">{label} Growth</span>
                    <span className="input-value">{val}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="5"
                    value={val}
                    onChange={(e) => setter(Number(e.target.value))}
                  />
                </div>
              ))}
            </div>

            <div className="panel" style={{ marginBottom: '16px' }}>
              <h3 className="section-title">Unit Economics</h3>

              <div className="input-row">
                <div className="input-header">
                  <span className="input-label">Gross Margin</span>
                  <span className="input-value">{grossMargin}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  step="5"
                  value={grossMargin}
                  onChange={(e) => setGrossMargin(Number(e.target.value))}
                />
              </div>

              <div className="input-row">
                <div className="input-header">
                  <span className="input-label">OpEx (% of Revenue)</span>
                  <span className="input-value">{opexAsRevenuePct}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="150"
                  step="5"
                  value={opexAsRevenuePct}
                  onChange={(e) => setOpexAsRevenuePct(Number(e.target.value))}
                />
              </div>

              <div className="input-row">
                <div className="input-header">
                  <span className="input-label">Terminal Multiple (EV/Rev)</span>
                  <span className="input-value">{terminalMultiple}x</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  value={terminalMultiple}
                  onChange={(e) => setTerminalMultiple(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="panel">
              <h3 className="section-title">Risk Parameters</h3>

              <div className="input-row">
                <div className="input-header">
                  <span className="input-label">Base Discount Rate</span>
                  <span className="input-value">{baseDiscountRate}%</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="30"
                  step="1"
                  value={baseDiscountRate}
                  onChange={(e) => setBaseDiscountRate(Number(e.target.value))}
                />
              </div>

              <div className="input-row">
                <div className="input-header">
                  <span className="input-label">Survival Rate (to established)</span>
                  <span className="input-value">{survivalRate}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="5"
                  value={survivalRate}
                  onChange={(e) => setSurvivalRate(Number(e.target.value))}
                />
              </div>

              <div className="input-row">
                <div className="input-header">
                  <span className="input-label">Years to Established</span>
                  <span className="input-value">{yearsToEstablished} years</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="1"
                  value={yearsToEstablished}
                  onChange={(e) => setYearsToEstablished(Number(e.target.value))}
                />
              </div>

              <div className="formula-box">
                <div style={{ marginBottom: '8px', color: '#2563eb' }}>Risk-Adjusted Rate:</div>
                <div style={{ marginBottom: '4px' }}>
                  f = 1 - {(survivalRate/100).toFixed(2)}^(1/{yearsToEstablished}) = <span style={{ color: '#d97706' }}>{formatPct(calculations.annualFailureRate)}</span>
                </div>
                <div>
                  r<sub>adj</sub> = ({baseDiscountRate}% + {formatPct(calculations.annualFailureRate)}) / (1 - {formatPct(calculations.annualFailureRate)}) = <span style={{ color: '#d97706' }}>{formatPct(calculations.adjustedDiscountRate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column - Valuations */}
          <div>
            {/* Key Metrics */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value">{formatValue(calculations.baseDCF)}</div>
                <div className="metric-label">DCF (Base)</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ color: '#d97706' }}>{formatValue(calculations.adjustedDCF)}</div>
                <div className="metric-label">DCF (Risk-Adj)</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ color: '#7c3aed' }}>{formatValue(calculations.comparableAdjustedValue)}</div>
                <div className="metric-label">Comparable (Adj)</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ color: '#16a34a' }}>{formatValue(calculations.valuationRange.mid)}</div>
                <div className="metric-label">Blended Mid</div>
              </div>
            </div>

            {/* Valuation Range Visualization */}
            <div className="panel" style={{ marginBottom: '20px' }}>
              <h3 className="section-title">Valuation Range</h3>

              <div className="valuation-bar">
                {(() => {
                  const minVal = Math.min(calculations.valuationRange.low * 0.8, 0);
                  const maxVal = calculations.valuationRange.high * 1.2;
                  const range = maxVal - minVal;
                  const toPercent = (v) => ((v - minVal) / range) * 100;

                  return (
                    <>
                      <div
                        className="valuation-range"
                        style={{
                          left: `${toPercent(calculations.valuationRange.low)}%`,
                          width: `${toPercent(calculations.valuationRange.high) - toPercent(calculations.valuationRange.low)}%`
                        }}
                      />
                      <div
                        className="valuation-marker"
                        style={{ left: `${toPercent(calculations.adjustedDCF)}%`, background: '#d97706' }}
                        title={`Risk-Adj DCF: ${formatValue(calculations.adjustedDCF)}`}
                      />
                      <div
                        className="valuation-marker"
                        style={{ left: `${toPercent(calculations.comparableAdjustedValue)}%`, background: '#7c3aed' }}
                        title={`Comparable: ${formatValue(calculations.comparableAdjustedValue)}`}
                      />
                    </>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                <span>Low: {formatValue(calculations.valuationRange.low)}</span>
                <span>Mid: {formatValue(calculations.valuationRange.mid)}</span>
                <span>High: {formatValue(calculations.valuationRange.high)}</span>
              </div>
            </div>

            {/* Revenue Projections Table */}
            <div className="panel" style={{ marginBottom: '20px' }}>
              <h3 className="section-title">Projected Financials</h3>

              <div className="financials-grid">
                <div style={{ color: '#94a3b8' }}>Year</div>
                {[0, 1, 2, 3, 4, 5].map(y => (
                  <div key={y} style={{ color: '#64748b', textAlign: 'right' }}>{y === 0 ? 'Now' : `Y${y}`}</div>
                ))}

                <div style={{ color: '#94a3b8' }}>Revenue</div>
                {calculations.revenues.map((r, i) => (
                  <div key={i} style={{ color: '#2563eb', textAlign: 'right' }}>{formatValue(r)}</div>
                ))}

                <div style={{ color: '#94a3b8' }}>Cash Flow</div>
                <div style={{ color: '#94a3b8', textAlign: 'right' }}>—</div>
                {calculations.cashFlows.map((cf, i) => (
                  <div key={i} style={{ color: cf >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>
                    {formatValue(cf)}
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(203, 213, 225, 0.4)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px'
              }}>
                <span style={{ color: '#94a3b8' }}>Terminal Value (Y5):</span>
                <span style={{ color: '#2563eb', fontFamily: "monospace" }}>
                  {formatValue(calculations.terminalValue)}
                </span>
              </div>
            </div>

            {/* Risk Impact */}
            <div className="panel">
              <h3 className="section-title">Risk Adjustment Impact</h3>

              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: '8px',
                    background: 'rgba(203, 213, 225, 0.6)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${100 - calculations.discountImpact}%`,
                      background: 'linear-gradient(90deg, #d97706, #2563eb)',
                      borderRadius: '4px'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                    <span>Risk-Adjusted</span>
                    <span>Base DCF</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '28px',
                    fontFamily: "monospace",
                    color: '#dc2626',
                    fontWeight: 600
                  }}>
                    -{calculations.discountImpact.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Value Discount
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(220, 38, 38, 0.08)',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#64748b',
                lineHeight: 1.6
              }}>
                With <strong style={{ color: '#d97706' }}>{formatPct(calculations.annualFailureRate)}</strong> annual failure probability,
                the effective discount rate jumps from {baseDiscountRate}% to <strong style={{ color: '#d97706' }}>{formatPct(calculations.adjustedDiscountRate)}</strong>.
                This reflects the compounding risk of total loss—not volatility, but extinction.
              </div>
            </div>
          </div>

          {/* Right Column - Comparables & Quality */}
          <div>
            {/* Quality Scores */}
            <div className="panel" style={{ marginBottom: '16px' }}>
              <h3 className="section-title">Quality Adjustment Factors</h3>

              {[
                { label: 'Team', score: teamScore, setter: setTeamScore, weight: '20%' },
                { label: 'Product / Tech', score: productScore, setter: setProductScore, weight: '20%' },
                { label: 'Market / TAM', score: marketScore, setter: setMarketScore, weight: '15%' },
                { label: 'Traction', score: tractionScore, setter: setTractionScore, weight: '15%' },
                { label: 'Defensibility', score: defensibilityScore, setter: setDefensibilityScore, weight: '10%' }
              ].map(({ label, score, setter, weight }) => (
                <div key={label} className="quality-row">
                  <div className="quality-label">
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{label}</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>Weight: {weight}</div>
                  </div>
                  <div className="score-buttons">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        className={`score-btn ${score === n ? 'active' : ''}`}
                        onClick={() => setter(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div style={{
                    marginLeft: 'auto',
                    fontFamily: "monospace",
                    fontSize: '11px',
                    color: calculations.qualityFactors[label.toLowerCase().split(' ')[0]]?.multiplier >= 1 ? '#16a34a' : '#dc2626'
                  }}>
                    {calculations.qualityFactors[label.toLowerCase().split(' ')[0]]?.multiplier.toFixed(2)}x
                  </div>
                </div>
              ))}

              <div style={{
                marginTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: 'rgba(37, 99, 235, 0.06)',
                borderRadius: '6px'
              }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Total Quality Multiplier:</span>
                <span style={{
                  fontFamily: "monospace",
                  fontSize: '16px',
                  color: calculations.totalQualityMultiplier >= 1 ? '#16a34a' : '#dc2626',
                  fontWeight: 600
                }}>
                  {calculations.totalQualityMultiplier.toFixed(2)}x
                </span>
              </div>
            </div>

            {/* Comparables */}
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 className="section-title" style={{ marginBottom: 0 }}>Comparable Companies</h3>
                <button
                  onClick={() => setShowComparableEditor(!showComparableEditor)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '10px',
                    background: 'transparent',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    color: '#2563eb',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {showComparableEditor ? 'Done' : 'Edit'}
                </button>
              </div>

              <div className="comparable-row" style={{ borderBottom: '1px solid rgba(203, 213, 225, 0.5)' }}>
                <span style={{ color: '#94a3b8' }}>Company</span>
                <span style={{ color: '#94a3b8', textAlign: 'right' }}>Val (£m)</span>
                <span style={{ color: '#94a3b8', textAlign: 'right' }}>Rev (£m)</span>
                <span style={{ color: '#94a3b8', textAlign: 'right' }}>Multiple</span>
              </div>

              {comparables.map((comp, i) => (
                <div key={i} className="comparable-row">
                  {showComparableEditor ? (
                    <>
                      <input
                        className="comparable-input"
                        value={comp.name}
                        onChange={(e) => updateComparable(i, 'name', e.target.value)}
                      />
                      <input
                        className="comparable-input"
                        type="number"
                        value={comp.valuation}
                        onChange={(e) => updateComparable(i, 'valuation', Number(e.target.value))}
                        style={{ textAlign: 'right' }}
                      />
                      <input
                        className="comparable-input"
                        type="number"
                        value={comp.revenue}
                        onChange={(e) => updateComparable(i, 'revenue', Number(e.target.value))}
                        style={{ textAlign: 'right' }}
                      />
                      <span style={{
                        color: '#7c3aed',
                        textAlign: 'right',
                        fontFamily: "monospace"
                      }}>
                        {comp.revenue > 0 ? `${(comp.valuation / comp.revenue).toFixed(1)}x` : '—'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#334155' }}>{comp.name}</span>
                      <span style={{ color: '#64748b', textAlign: 'right', fontFamily: "monospace" }}>
                        £{comp.valuation}m
                      </span>
                      <span style={{ color: '#64748b', textAlign: 'right', fontFamily: "monospace" }}>
                        £{comp.revenue}m
                      </span>
                      <span style={{ color: '#7c3aed', textAlign: 'right', fontFamily: "monospace" }}>
                        {comp.revenue > 0 ? `${(comp.valuation / comp.revenue).toFixed(1)}x` : '—'}
                      </span>
                    </>
                  )}
                </div>
              ))}

              {showComparableEditor && (
                <button
                  onClick={() => setComparables([...comparables, { name: 'New Comp', valuation: 50, revenue: 5, stage: 'Series A' }])}
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '8px',
                    background: 'rgba(37, 99, 235, 0.08)',
                    border: '1px dashed rgba(37, 99, 235, 0.2)',
                    color: '#2563eb',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  + Add Comparable
                </button>
              )}

              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(124, 58, 237, 0.08)',
                borderRadius: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                  <span style={{ color: '#64748b' }}>Median Multiple:</span>
                  <span style={{ color: '#7c3aed', fontFamily: "monospace" }}>
                    {calculations.medianMultiple.toFixed(1)}x
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                  <span style={{ color: '#64748b' }}>Base Comparable Value:</span>
                  <span style={{ color: '#64748b', fontFamily: "monospace" }}>
                    {formatValue(calculations.comparableBaseValue)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#64748b' }}>Quality-Adjusted:</span>
                  <span style={{ color: '#7c3aed', fontFamily: "monospace", fontWeight: 600 }}>
                    {formatValue(calculations.comparableAdjustedValue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Insight */}
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'rgba(22, 163, 74, 0.08)',
              border: '1px solid rgba(22, 163, 74, 0.15)',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#64748b',
              lineHeight: 1.7
            }}>
              <strong style={{ color: '#16a34a' }}>Valuation Summary:</strong><br/>
              The risk-adjusted DCF suggests <strong>{formatValue(calculations.adjustedDCF)}</strong>,
              while comparable analysis (adjusted for quality) suggests <strong>{formatValue(calculations.comparableAdjustedValue)}</strong>.
              The blended midpoint is <strong style={{ color: '#16a34a' }}>{formatValue(calculations.valuationRange.mid)}</strong>.
              {calculations.adjustedDCF > calculations.comparableAdjustedValue * 1.5 && (
                <span style={{ color: '#d97706' }}> Note: DCF significantly exceeds comparables—projections may be optimistic.</span>
              )}
              {calculations.comparableAdjustedValue > calculations.adjustedDCF * 1.5 && (
                <span style={{ color: '#d97706' }}> Note: Comparables exceed DCF—either market is frothy or projections conservative.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VCValuationTool;
