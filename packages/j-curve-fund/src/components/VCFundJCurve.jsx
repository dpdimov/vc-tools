import React, { useState, useMemo } from 'react';

const VCFundJCurve = () => {
  // Stage profiles with characteristic parameters
  const stageProfiles = {
    seed: {
      name: 'Seed',
      initialCheck: 500,
      followOnToA: 1500,
      followOnToB: 4000,
      survivalToA: 0.40,
      survivalToB: 0.65,
      survivalToExit: 0.70,
      timeToA: 18,
      timeToB: 36,
      timeToExit: 84,
      exitDistribution: [
        { prob: 0.60, multiple: 0 },
        { prob: 0.20, multiple: 2 },
        { prob: 0.12, multiple: 8 },
        { prob: 0.06, multiple: 15 },
        { prob: 0.02, multiple: 30 }
      ]
    },
    seriesA: {
      name: 'Series A',
      initialCheck: 2000,
      followOnToA: 0,
      followOnToB: 5000,
      survivalToA: 1.0,
      survivalToB: 0.55,
      survivalToExit: 0.75,
      timeToA: 0,
      timeToB: 20,
      timeToExit: 60,
      exitDistribution: [
        { prob: 0.50, multiple: 0 },
        { prob: 0.25, multiple: 1.5 },
        { prob: 0.15, multiple: 5 },
        { prob: 0.08, multiple: 10 },
        { prob: 0.02, multiple: 18 }
      ]
    },
    seriesB: {
      name: 'Series B',
      initialCheck: 5000,
      followOnToA: 0,
      followOnToB: 0,
      survivalToA: 1.0,
      survivalToB: 1.0,
      survivalToExit: 0.65,
      timeToA: 0,
      timeToB: 0,
      timeToExit: 42,
      exitDistribution: [
        { prob: 0.40, multiple: 0 },
        { prob: 0.30, multiple: 1.2 },
        { prob: 0.20, multiple: 3 },
        { prob: 0.08, multiple: 6 },
        { prob: 0.02, multiple: 12 }
      ]
    }
  };

  const presets = {
    seedSpecialist: {
      name: 'Seed Specialist',
      fundSize: 50000,
      numCompanies: 25,
      stageAllocation: { seed: 100, seriesA: 0, seriesB: 0 },
      deploymentYears: 4,
      followOnReserve: 60,
      description: 'High-risk, high-reward. Deep J-curve with long recovery but potential for outlier returns.'
    },
    seriesAFocused: {
      name: 'Series A Focused',
      fundSize: 100000,
      numCompanies: 20,
      stageAllocation: { seed: 20, seriesA: 80, seriesB: 0 },
      deploymentYears: 4,
      followOnReserve: 50,
      description: 'Balanced risk profile. Moderate trough depth with more predictable exit timing.'
    },
    growthStage: {
      name: 'Growth / Series B',
      fundSize: 200000,
      numCompanies: 15,
      stageAllocation: { seed: 0, seriesA: 20, seriesB: 80 },
      deploymentYears: 3,
      followOnReserve: 30,
      description: 'Lower variance, faster exits. Shallower J-curve but compressed multiples.'
    },
    multiStage: {
      name: 'Multi-Stage Balanced',
      fundSize: 150000,
      numCompanies: 22,
      stageAllocation: { seed: 30, seriesA: 45, seriesB: 25 },
      deploymentYears: 4,
      followOnReserve: 45,
      description: 'Diversified across stages. Blended risk/return with staggered cash flows.'
    }
  };

  const [selectedPreset, setSelectedPreset] = useState('seriesAFocused');
  const [params, setParams] = useState(presets.seriesAFocused);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPreset, setComparisonPreset] = useState('seedSpecialist');

  const handlePresetChange = (presetKey) => {
    setSelectedPreset(presetKey);
    setParams(presets[presetKey]);
  };

  const handleParamChange = (param, value) => {
    setSelectedPreset('custom');
    setParams(prev => ({ ...prev, [param]: value }));
  };

  const handleAllocationChange = (stage, value) => {
    setSelectedPreset('custom');
    const newAllocation = { ...params.stageAllocation, [stage]: value };
    const total = Object.values(newAllocation).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(newAllocation).forEach(k => {
        newAllocation[k] = Math.round((newAllocation[k] / total) * 100);
      });
    }
    setParams(prev => ({ ...prev, stageAllocation: newAllocation }));
  };

  const simulateFund = (p) => {
    const monthlyFlows = new Array(180).fill(0);
    const monthlyCallsOut = new Array(180).fill(0);
    const monthlyDistributions = new Array(180).fill(0);

    const stages = ['seed', 'seriesA', 'seriesB'];
    const companiesPerStage = {};
    let remaining = p.numCompanies;

    stages.forEach((stage, idx) => {
      if (idx === stages.length - 1) {
        companiesPerStage[stage] = remaining;
      } else {
        companiesPerStage[stage] = Math.round(p.numCompanies * (p.stageAllocation[stage] / 100));
        remaining -= companiesPerStage[stage];
      }
    });

    const monthsPerCompany = (p.deploymentYears * 12) / p.numCompanies;

    let companyIndex = 0;
    let totalInvested = 0;
    let totalReturned = 0;

    stages.forEach(stage => {
      const profile = stageProfiles[stage];
      const numInStage = companiesPerStage[stage];

      for (let i = 0; i < numInStage; i++) {
        const investMonth = Math.floor(companyIndex * monthsPerCompany);
        companyIndex++;

        const initialInvestment = profile.initialCheck;
        if (investMonth < 180) {
          monthlyFlows[investMonth] -= initialInvestment;
          monthlyCallsOut[investMonth] += initialInvestment;
          totalInvested += initialInvestment;
        }

        let expectedCompanies = 1.0;
        let totalCapitalInCompany = initialInvestment;

        if (profile.followOnToA > 0 && profile.timeToA > 0) {
          const followOnMonthA = investMonth + profile.timeToA;
          expectedCompanies *= profile.survivalToA;
          const followOnA = profile.followOnToA * expectedCompanies;

          if (followOnMonthA < 180 && followOnA > 0) {
            monthlyFlows[followOnMonthA] -= followOnA;
            monthlyCallsOut[followOnMonthA] += followOnA;
            totalInvested += followOnA;
            totalCapitalInCompany += profile.followOnToA;
          }
        }

        if (profile.followOnToB > 0 && profile.timeToB > 0) {
          const followOnMonthB = investMonth + profile.timeToB;
          expectedCompanies *= profile.survivalToB;
          const followOnB = profile.followOnToB * expectedCompanies;

          if (followOnMonthB < 180 && followOnB > 0) {
            monthlyFlows[followOnMonthB] -= followOnB;
            monthlyCallsOut[followOnMonthB] += followOnB;
            totalInvested += followOnB;
            totalCapitalInCompany += profile.followOnToB;
          }
        }

        const exitMonth = investMonth + profile.timeToExit;
        expectedCompanies *= profile.survivalToExit;

        const expectedMultiple = profile.exitDistribution.reduce(
          (sum, bucket) => sum + bucket.prob * bucket.multiple, 0
        );

        const exitValue = totalCapitalInCompany * expectedMultiple * expectedCompanies;

        if (exitMonth < 180) {
          monthlyFlows[exitMonth] += exitValue;
          monthlyDistributions[exitMonth] += exitValue;
          totalReturned += exitValue;
        }
      }
    });

    const cumulativeFlows = [];
    let cumulative = 0;
    for (let m = 0; m < 180; m++) {
      cumulative += monthlyFlows[m];
      cumulativeFlows.push({
        month: m,
        cash: cumulative,
        callsOut: monthlyCallsOut[m],
        distributions: monthlyDistributions[m]
      });
    }

    const calcMetrics = (month) => {
      const totalCalled = monthlyCallsOut.slice(0, month + 1).reduce((a, b) => a + b, 0);
      const totalDist = monthlyDistributions.slice(0, month + 1).reduce((a, b) => a + b, 0);
      const dpi = totalCalled > 0 ? totalDist / totalCalled : 0;
      return { totalCalled, totalDist, dpi };
    };

    return {
      cumulativeFlows,
      monthlyCallsOut,
      monthlyDistributions,
      totalInvested,
      totalReturned,
      tvpiExpected: totalInvested > 0 ? totalReturned / totalInvested : 0,
      metricsAtYear: {
        5: calcMetrics(60),
        7: calcMetrics(84),
        10: calcMetrics(120),
        12: calcMetrics(144)
      }
    };
  };

  const fundData = useMemo(() => simulateFund(params), [params]);
  const comparisonData = useMemo(() =>
    showComparison ? simulateFund(presets[comparisonPreset]) : null,
    [showComparison, comparisonPreset]
  );

  const metrics = useMemo(() => {
    const minCash = Math.min(...fundData.cumulativeFlows.map(p => p.cash));
    const breakEvenMonth = fundData.cumulativeFlows.findIndex((p, i, arr) =>
      i > 0 && p.cash >= 0 && arr[i-1].cash < 0
    );

    return {
      peakCapitalCall: Math.abs(minCash),
      breakEvenMonth: breakEvenMonth > 0 ? breakEvenMonth : 'Beyond Y15',
      breakEvenYear: breakEvenMonth > 0 ? (breakEvenMonth / 12).toFixed(1) : '>15',
      tvpi: fundData.tvpiExpected,
      dpiYear10: fundData.metricsAtYear[10].dpi
    };
  }, [fundData]);

  const width = 850;
  const height = 420;
  const padding = { top: 50, right: 50, bottom: 70, left: 90 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allCashValues = [
    ...fundData.cumulativeFlows.map(p => p.cash),
    ...(comparisonData ? comparisonData.cumulativeFlows.map(p => p.cash) : [])
  ];
  const minY = Math.min(...allCashValues, 0);
  const maxY = Math.max(...allCashValues, 0);
  const yRange = maxY - minY || 1;

  const maxMonth = 156;
  const scaleX = (month) => padding.left + (month / maxMonth) * chartWidth;
  const scaleY = (cash) => padding.top + chartHeight - ((cash - minY) / yRange) * chartHeight;

  const generatePath = (data) => {
    return data
      .filter(p => p.month <= maxMonth)
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.month)} ${scaleY(p.cash)}`)
      .join(' ');
  };

  const generateAreaPath = (data) => {
    const filtered = data.filter(p => p.month <= maxMonth);
    const linePath = generatePath(filtered);
    const lastMonth = filtered[filtered.length - 1]?.month || maxMonth;
    const zeroY = scaleY(0);
    return `${linePath} L ${scaleX(lastMonth)} ${zeroY} L ${scaleX(0)} ${zeroY} Z`;
  };

  const zeroLineY = scaleY(0);

  const yearlyData = useMemo(() => {
    const years = [];
    for (let y = 0; y < 13; y++) {
      const startMonth = y * 12;
      const endMonth = Math.min((y + 1) * 12, 180);
      const calls = fundData.monthlyCallsOut.slice(startMonth, endMonth).reduce((a, b) => a + b, 0);
      const dist = fundData.monthlyDistributions.slice(startMonth, endMonth).reduce((a, b) => a + b, 0);
      years.push({ year: y + 1, calls, distributions: dist, net: dist - calls });
    }
    return years;
  }, [fundData]);

  const maxBarValue = Math.max(...yearlyData.map(y => Math.max(y.calls, y.distributions)));

  return (
    <div className="page-wrapper" style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%)',
      color: '#1e293b',
      fontFamily: "'Source Sans 3', -apple-system, sans-serif"
    }}>
      <style>{`
        * { box-sizing: border-box; }

        .page-wrapper { padding: 40px; }
        .page-title { font-size: 38px; }

        .preset-btn {
          padding: 14px 22px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #64748b;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.25s ease;
          border-radius: 8px;
        }
        .preset-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .preset-btn.active {
          background: linear-gradient(135deg, rgba(136, 192, 208, 0.15), rgba(163, 190, 140, 0.15));
          border-color: rgba(136, 192, 208, 0.5);
          color: #0d9488;
          box-shadow: 0 0 24px rgba(136, 192, 208, 0.12);
        }

        .slider-container { margin-bottom: 22px; }
        .slider-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
          color: #64748b;
        }
        .slider-value {
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
          box-shadow: 0 2px 8px rgba(136, 192, 208, 0.4);
          transition: transform 0.2s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.12);
        }

        .metric-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 18px;
          text-align: center;
        }
        .metric-value {
          font-family: monospace;
          font-size: 26px;
          font-weight: 500;
          color: #0d9488;
          margin-bottom: 4px;
        }
        .metric-label {
          font-size: 11px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .toggle-btn {
          padding: 10px 16px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #64748b;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.25s;
          border-radius: 6px;
        }
        .toggle-btn:hover { background: #f1f5f9; }
        .toggle-btn.active {
          background: rgba(191, 97, 106, 0.15);
          border-color: rgba(191, 97, 106, 0.5);
          color: #dc2626;
        }

        .comparison-select {
          padding: 10px 14px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #1e293b;
          font-size: 12px;
          border-radius: 6px;
          cursor: pointer;
          outline: none;
        }

        .section-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #94a3b8;
          margin-bottom: 16px;
          font-weight: 500;
        }

        .allocation-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .allocation-label { width: 70px; font-size: 12px; color: #64748b; }
        .allocation-value {
          width: 40px;
          font-family: monospace;
          font-size: 12px;
          color: #16a34a;
          text-align: right;
        }

        .main-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 48px;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 28px;
        }
        .chart-container {
          width: 100%;
          overflow: hidden;
        }
        .chart-container svg {
          display: block;
          width: 100%;
          height: auto;
        }

        @media (max-width: 1000px) {
          .main-layout {
            grid-template-columns: 1fr;
            gap: 32px;
          }
          .metrics-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
          }
          .page-title { font-size: 28px; }
          .page-wrapper { padding: 20px; }
          .metric-value { font-size: 20px; }
          .metric-label { font-size: 9px; }
          .preset-btn {
            padding: 10px 14px;
            font-size: 11px;
          }
        }

        @media (max-width: 600px) {
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '44px' }}>
          <div style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: '#94a3b8',
            marginBottom: '12px'
          }}>
            Venture Capital Fund Modelling
          </div>
          <h1 className="page-title" style={{
            fontFamily: "'Crimson Pro', Georgia, serif",
            fontWeight: 600,
            marginBottom: '14px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0d9488 60%, #16a34a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px'
          }}>
            The GP's J-Curve
          </h1>
          <p style={{
            color: '#94a3b8',
            fontSize: '15px',
            maxWidth: '680px',
            lineHeight: 1.65
          }}>
            Explore how fund strategy shapes cash flows to LPs. Stage focus, portfolio construction,
            and follow-on reserves determine the depth of the trough and the slope of recovery.
          </p>
        </div>

        {/* Preset Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              className={`preset-btn ${selectedPreset === key ? 'active' : ''}`}
              onClick={() => handlePresetChange(key)}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Description */}
        <div style={{
          background: 'rgba(136, 192, 208, 0.06)',
          border: '1px solid rgba(136, 192, 208, 0.15)',
          borderRadius: '10px',
          padding: '18px 22px',
          marginBottom: '36px',
          fontSize: '13px',
          color: '#64748b',
          lineHeight: 1.65
        }}>
          <span style={{ color: '#0d9488', fontWeight: 500 }}>
            {presets[selectedPreset]?.name || 'Custom Strategy'}:
          </span>{' '}
          {presets[selectedPreset]?.description || 'Adjust parameters to explore different fund strategies.'}
        </div>

        <div className="main-layout">
          {/* Controls Panel */}
          <div>
            <h3 className="section-title">Fund Parameters</h3>

            <div className="slider-container">
              <div className="slider-label">
                <span>Fund Size</span>
                <span className="slider-value">£{(params.fundSize / 1000).toFixed(0)}m</span>
              </div>
              <input
                type="range"
                min="20000"
                max="500000"
                step="10000"
                value={params.fundSize}
                onChange={(e) => handleParamChange('fundSize', Number(e.target.value))}
              />
            </div>

            <div className="slider-container">
              <div className="slider-label">
                <span>Number of Companies</span>
                <span className="slider-value">{params.numCompanies}</span>
              </div>
              <input
                type="range"
                min="8"
                max="40"
                step="1"
                value={params.numCompanies}
                onChange={(e) => handleParamChange('numCompanies', Number(e.target.value))}
              />
            </div>

            <div className="slider-container">
              <div className="slider-label">
                <span>Deployment Period</span>
                <span className="slider-value">{params.deploymentYears} years</span>
              </div>
              <input
                type="range"
                min="2"
                max="6"
                step="1"
                value={params.deploymentYears}
                onChange={(e) => handleParamChange('deploymentYears', Number(e.target.value))}
              />
            </div>

            <div className="slider-container">
              <div className="slider-label">
                <span>Follow-on Reserve</span>
                <span className="slider-value">{params.followOnReserve}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="70"
                step="5"
                value={params.followOnReserve}
                onChange={(e) => handleParamChange('followOnReserve', Number(e.target.value))}
              />
            </div>

            {/* Stage Allocation */}
            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid rgba(139, 148, 158, 0.1)' }}>
              <h3 className="section-title">Stage Allocation</h3>

              {['seed', 'seriesA', 'seriesB'].map(stage => (
                <div key={stage} className="allocation-row">
                  <span className="allocation-label">
                    {stage === 'seed' ? 'Seed' : stage === 'seriesA' ? 'Series A' : 'Series B'}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={params.stageAllocation[stage]}
                    onChange={(e) => handleAllocationChange(stage, Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="allocation-value">{params.stageAllocation[stage]}%</span>
                </div>
              ))}
            </div>

            {/* Comparison Toggle */}
            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid rgba(139, 148, 158, 0.1)' }}>
              <h3 className="section-title">Compare Strategies</h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className={`toggle-btn ${showComparison ? 'active' : ''}`}
                  onClick={() => setShowComparison(!showComparison)}
                >
                  {showComparison ? 'Hide' : 'Show'} Comparison
                </button>
                {showComparison && (
                  <select
                    className="comparison-select"
                    value={comparisonPreset}
                    onChange={(e) => setComparisonPreset(e.target.value)}
                  >
                    {Object.entries(presets)
                      .filter(([key]) => key !== selectedPreset)
                      .map(([key, preset]) => (
                        <option key={key} value={key}>{preset.name}</option>
                      ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div>
            {/* Metrics Row */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value">£{(metrics.peakCapitalCall / 1000).toFixed(1)}m</div>
                <div className="metric-label">Peak Capital Call</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ color: '#dc2626' }}>Y{metrics.breakEvenYear}</div>
                <div className="metric-label">Break-Even</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ color: '#16a34a' }}>{metrics.tvpi.toFixed(2)}x</div>
                <div className="metric-label">Expected TVPI</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{metrics.dpiYear10.toFixed(2)}x</div>
                <div className="metric-label">DPI @ Year 10</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{params.numCompanies}</div>
                <div className="metric-label">Portfolio Cos</div>
              </div>
            </div>

            {/* SVG Chart */}
            <div className="chart-container" style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              marginBottom: '24px'
            }}>
              <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                {/* Grid lines */}
                {[...Array(7)].map((_, i) => {
                  const y = padding.top + (chartHeight / 6) * i;
                  return (
                    <line
                      key={`grid-${i}`}
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="4,6"
                    />
                  );
                })}

                {/* Vertical year markers */}
                {[0, 3, 5, 7, 10, 13].map(year => (
                  <line
                    key={`vyear-${year}`}
                    x1={scaleX(year * 12)}
                    y1={padding.top}
                    x2={scaleX(year * 12)}
                    y2={height - padding.bottom}
                    stroke="#e2e8f0"
                  />
                ))}

                {/* Zero line */}
                <line
                  x1={padding.left}
                  y1={zeroLineY}
                  x2={width - padding.right}
                  y2={zeroLineY}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />

                {/* Gradients */}
                <defs>
                  <linearGradient id="vcCurveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="vcComparisonGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="vcLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#dc2626" />
                    <stop offset="40%" stopColor="#d08770" />
                    <stop offset="70%" stopColor="#0d9488" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                </defs>

                {/* Comparison curve */}
                {showComparison && comparisonData && (
                  <>
                    <path d={generateAreaPath(comparisonData.cumulativeFlows)} fill="url(#vcComparisonGradient)" />
                    <path d={generatePath(comparisonData.cumulativeFlows)} fill="none" stroke="#dc2626" strokeWidth="2" opacity="0.6" strokeDasharray="8,5" />
                  </>
                )}

                {/* Main curve area */}
                <path d={generateAreaPath(fundData.cumulativeFlows)} fill="url(#vcCurveGradient)" />

                {/* Main curve */}
                <path d={generatePath(fundData.cumulativeFlows)} fill="none" stroke="url(#vcLineGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Trough marker */}
                {(() => {
                  const minPoint = fundData.cumulativeFlows
                    .filter(p => p.month <= maxMonth)
                    .reduce((min, p) => p.cash < min.cash ? p : min, fundData.cumulativeFlows[0]);
                  return (
                    <>
                      <circle cx={scaleX(minPoint.month)} cy={scaleY(minPoint.cash)} r="5" fill="#dc2626" stroke="#f8fafc" strokeWidth="2" />
                      <text x={scaleX(minPoint.month)} y={scaleY(minPoint.cash) + 20} fill="#dc2626" fontSize="10" fontFamily="monospace" textAnchor="middle">
                        Trough: -£{(Math.abs(minPoint.cash) / 1000).toFixed(1)}m @ Y{(minPoint.month / 12).toFixed(1)}
                      </text>
                    </>
                  );
                })()}

                {/* X-axis labels */}
                {[0, 3, 5, 7, 10, 13].map(year => (
                  <text key={year} x={scaleX(year * 12)} y={height - padding.bottom + 22} fill="#94a3b8" fontSize="11" fontFamily="monospace" textAnchor="middle">
                    {year === 0 ? 'Fund Start' : `Y${year}`}
                  </text>
                ))}

                {/* Y-axis labels */}
                {(() => {
                  const yTicks = [];
                  const step = yRange / 5;
                  for (let i = 0; i <= 5; i++) {
                    const val = minY + step * i;
                    yTicks.push(val);
                  }
                  return yTicks.map((val, i) => (
                    <text key={i} x={padding.left - 14} y={scaleY(val) + 4} fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="end">
                      {val >= 0 ? '' : '-'}£{Math.abs(val / 1000).toFixed(0)}m
                    </text>
                  ));
                })()}

                {/* Axis labels */}
                <text x={width / 2} y={height - 12} fill="#94a3b8" fontSize="11" fontFamily="'Source Sans 3', sans-serif" textAnchor="middle">
                  Fund Life (Years)
                </text>
                <text x={-height / 2 + 20} y={22} fill="#94a3b8" fontSize="11" fontFamily="'Source Sans 3', sans-serif" textAnchor="middle" transform="rotate(-90)">
                  Cumulative Net Cash Flow to LPs
                </text>

                {/* Legend */}
                {showComparison && (
                  <g transform={`translate(${width - padding.right - 150}, ${padding.top + 10})`}>
                    <rect x="-12" y="-10" width="160" height="54" fill="#f1f5f9" stroke="#e2e8f0" rx="6" />
                    <line x1="0" y1="8" x2="28" y2="8" stroke="url(#vcLineGradient)" strokeWidth="2" />
                    <text x="38" y="12" fill="#1e293b" fontSize="10">{presets[selectedPreset]?.name || 'Current'}</text>
                    <line x1="0" y1="30" x2="28" y2="30" stroke="#dc2626" strokeWidth="2" strokeDasharray="8,5" />
                    <text x="38" y="34" fill="#1e293b" fontSize="10">{presets[comparisonPreset]?.name}</text>
                  </g>
                )}
              </svg>
            </div>

            {/* Yearly Cash Flows Bar Chart */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '24px',
              border: '1px solid #e2e8f0'
            }}>
              <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: '20px', fontWeight: 500 }}>
                Annual Cash Flows
              </h4>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
                {yearlyData.map((y, i) => {
                  const callHeight = maxBarValue > 0 ? (y.calls / maxBarValue) * 100 : 0;
                  const distHeight = maxBarValue > 0 ? (y.distributions / maxBarValue) * 100 : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '100px' }}>
                        <div style={{
                          width: '14px',
                          height: `${callHeight}%`,
                          background: 'linear-gradient(180deg, #dc2626, #b91c1c)',
                          borderRadius: '2px 2px 0 0',
                          minHeight: y.calls > 0 ? '4px' : '0'
                        }} title={`Calls: £${(y.calls / 1000).toFixed(1)}m`} />
                        <div style={{
                          width: '14px',
                          height: `${distHeight}%`,
                          background: 'linear-gradient(180deg, #16a34a, #15803d)',
                          borderRadius: '2px 2px 0 0',
                          minHeight: y.distributions > 0 ? '4px' : '0'
                        }} title={`Distributions: £${(y.distributions / 1000).toFixed(1)}m`} />
                      </div>
                      <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace' }}>Y{y.year}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '24px', marginTop: '16px', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', background: '#dc2626', borderRadius: '2px' }} />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Capital Calls</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', background: '#16a34a', borderRadius: '2px' }} />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Distributions</span>
                </div>
              </div>
            </div>

            {/* Insights */}
            <div style={{
              marginTop: '24px',
              padding: '20px 24px',
              background: 'rgba(136, 192, 208, 0.04)',
              borderRadius: '12px',
              border: '1px solid rgba(136, 192, 208, 0.1)',
              fontSize: '13px',
              color: '#64748b',
              lineHeight: 1.7
            }}>
              <strong style={{ color: '#0d9488' }}>Reading the fund J-curve:</strong> The
              <span style={{ color: '#dc2626' }}> trough depth</span> reflects how much capital LPs must commit
              before distributions begin—driven by stage focus and follow-on reserves.
              <span style={{ color: '#d08770' }}> Deployment pace</span> controls how quickly capital is called.
              Earlier-stage funds show deeper, wider troughs but higher potential TVPI.
              Growth funds offer shallower curves with faster DPI but compressed multiples.
              The <span style={{ color: '#16a34a' }}>recovery slope</span> depends on exit timing
              and the power-law distribution of returns across the portfolio.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VCFundJCurve;
