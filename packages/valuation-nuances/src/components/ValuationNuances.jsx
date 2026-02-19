import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmtM = (v) => {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(2)}B`;
  if (Math.abs(v) >= 1) return `$${v.toFixed(2)}M`;
  return `$${(v * 1000).toFixed(0)}K`;
};
const fmtDollar = (v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;
const fmtPctWhole = (v) => `${v.toFixed(1)}%`;
const fmtN = (v) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtK = (v) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return v.toFixed(0);
};

const TABS = [
  { id: 'vc-method', label: 'VC Method' },
  { id: 'option-pool', label: 'Option Pool' },
  { id: 'multi-round', label: 'Multi-Round' },
  { id: 'convertible-notes', label: 'Convertible Notes' },
  { id: 'options-pricing', label: 'Options Pricing' },
  { id: 'participating-pref', label: 'Participating Pref.' },
  { id: 'cum-dividends', label: 'Cum. Dividends' },
];

function comb(n, k) {
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

const EXIT_VALUES_M = [3, 5, 10, 15, 20, 30, 40, 50, 54, 75, 100, 200, 500, 1000, 5000, 10000];

const ValuationNuances = () => {
  const [activeTab, setActiveTab] = useState('vc-method');

  // Tab A - VC Method inputs
  const [investment, setInvestment] = useState(3);
  const [netIncome, setNetIncome] = useState(3);
  const [peMultiple, setPeMultiple] = useState(18);
  const [requiredReturn, setRequiredReturn] = useState(40);
  const [yearsToExit, setYearsToExit] = useState(5);
  const [currentShares, setCurrentShares] = useState(1000000);

  // Tab B - Option Pool
  const [optionPoolPct, setOptionPoolPct] = useState(20);

  // Tab C - Multi-Round
  const [seriesBInvestment, setSeriesBInvestment] = useState(7);
  const [seriesBReturn, setSeriesBReturn] = useState(20);
  const [yearsBtoExit, setYearsBtoExit] = useState(2);

  // Tab D - Convertible Notes
  const [noteAmount, setNoteAmount] = useState(500000);
  const [noteCurrentShares, setNoteCurrentShares] = useState(2040000);
  const [seriesARaise, setSeriesARaise] = useState(3000000);
  const [seriesAStakePct, setSeriesAStakePct] = useState(32);
  const [discountRate, setDiscountRate] = useState(80);
  const [valuationCap, setValuationCap] = useState(6000000);

  // Tab E - Options Pricing
  const [optCurrentShares, setOptCurrentShares] = useState(3000000);
  const [optSharePrice, setOptSharePrice] = useState(2.0);
  const [optInvestment, setOptInvestment] = useState(4000000);
  const [optOptionAmount, setOptOptionAmount] = useState(4000000);
  const [strikePremium, setStrikePremium] = useState(25);
  const [annualVolatility, setAnnualVolatility] = useState(40);

  // Tab F - Participating Preferred
  const [negotiatedPreMoney, setNegotiatedPreMoney] = useState(7);

  // Tab G - Cumulative Dividends
  const [dividendRate, setDividendRate] = useState(10);

  // Sensitivity toggle for Tab A
  const [altReturn, setAltReturn] = useState(30);

  // ========== Tab A calculations ==========
  const vcMethod = useMemo(() => {
    const futureCompanyValue = netIncome * peMultiple;
    const futureInvestmentValue = investment * Math.pow(1 + requiredReturn / 100, yearsToExit);
    const vcStake = futureInvestmentValue / futureCompanyValue;
    const postMoney = investment / vcStake;
    const preMoney = postMoney - investment;
    const sharePrice = preMoney / (currentShares / 1000000);
    const newShares = investment / sharePrice * 1000000;

    // Alt return comparison
    const altFutureInvValue = investment * Math.pow(1 + altReturn / 100, yearsToExit);
    const altVcStake = altFutureInvValue / futureCompanyValue;
    const altPostMoney = investment / altVcStake;
    const altPreMoney = altPostMoney - investment;
    const altSharePrice = altPreMoney / (currentShares / 1000000);
    const altNewShares = investment / altSharePrice * 1000000;

    return {
      futureCompanyValue,
      futureInvestmentValue,
      vcStake,
      postMoney,
      preMoney,
      sharePrice,
      newShares,
      alt: {
        futureInvestmentValue: altFutureInvValue,
        vcStake: altVcStake,
        postMoney: altPostMoney,
        preMoney: altPreMoney,
        sharePrice: altSharePrice,
        newShares: altNewShares,
      }
    };
  }, [investment, netIncome, peMultiple, requiredReturn, yearsToExit, currentShares, altReturn]);

  // ========== Tab B calculations ==========
  const optionPool = useMemo(() => {
    const poolPct = optionPoolPct / 100;
    const f = vcMethod.vcStake; // required VC ownership fraction

    // Scenario 1: Options issued BEFORE the round
    const s1FounderShares = currentShares * (1 - poolPct);
    const s1OptionShares = currentShares * poolPct;
    const s1VcShares = currentShares * f / (1 - f);
    const s1Total = currentShares + s1VcShares;
    const s1VcPct = s1VcShares / s1Total;
    const s1FounderPct = s1FounderShares / s1Total;
    const s1OptionPct = s1OptionShares / s1Total;
    const s1SharePrice = investment / (s1VcShares / 1000000);
    const s1PreMoney = s1SharePrice * currentShares / 1000000;
    const s1PostMoney = s1PreMoney + investment;

    // Scenario 2: Options issued AFTER round, without factoring dilution
    const s2VcShares = currentShares * f / (1 - f);
    const s2TotalAfterVc = currentShares + s2VcShares;
    const s2OptionShares = s2TotalAfterVc * poolPct / (1 - poolPct);
    const s2Total = s2TotalAfterVc + s2OptionShares;
    const s2VcPct = s2VcShares / s2Total;
    const s2FounderPct = currentShares / s2Total;
    const s2OptionPct = s2OptionShares / s2Total;
    const s2SharePrice = investment / (s2VcShares / 1000000);
    const s2PreMoney = s2SharePrice * currentShares / 1000000;
    const s2PostMoney = s2PreMoney + investment;

    // Scenario 3: Options issued AFTER round, with dilution factored in
    const adjustedF = f / (1 - poolPct);
    const s3VcShares = currentShares * adjustedF / (1 - adjustedF);
    const s3TotalAfterVc = currentShares + s3VcShares;
    const s3OptionShares = s3TotalAfterVc * poolPct / (1 - poolPct);
    const s3Total = s3TotalAfterVc + s3OptionShares;
    const s3VcPct = s3VcShares / s3Total;
    const s3FounderPct = currentShares / s3Total;
    const s3OptionPct = s3OptionShares / s3Total;
    const s3SharePrice = investment / (s3VcShares / 1000000);
    const s3PreMoney = s3SharePrice * currentShares / 1000000;
    const s3PostMoney = s3PreMoney + investment;

    return {
      scenario1: {
        founderShares: s1FounderShares, optionShares: s1OptionShares, vcShares: s1VcShares,
        total: s1Total, vcPct: s1VcPct, founderPct: s1FounderPct, optionPct: s1OptionPct,
        sharePrice: s1SharePrice, preMoney: s1PreMoney, postMoney: s1PostMoney,
      },
      scenario2: {
        founderShares: currentShares, optionShares: s2OptionShares, vcShares: s2VcShares,
        total: s2Total, vcPct: s2VcPct, founderPct: s2FounderPct, optionPct: s2OptionPct,
        sharePrice: s2SharePrice, preMoney: s2PreMoney, postMoney: s2PostMoney,
      },
      scenario3: {
        founderShares: currentShares, optionShares: s3OptionShares, vcShares: s3VcShares,
        total: s3Total, vcPct: s3VcPct, founderPct: s3FounderPct, optionPct: s3OptionPct,
        sharePrice: s3SharePrice, preMoney: s3PreMoney, postMoney: s3PostMoney,
      },
    };
  }, [vcMethod, currentShares, optionPoolPct, investment]);

  // ========== Tab C calculations ==========
  const multiRound = useMemo(() => {
    const futureCompanyValue = netIncome * peMultiple;
    const poolPct = optionPoolPct / 100;

    // Series B
    const seriesBFutureValue = seriesBInvestment * Math.pow(1 + seriesBReturn / 100, yearsBtoExit);
    const seriesBStake = seriesBFutureValue / futureCompanyValue;

    // Series A at exit
    const seriesAFutureValue = investment * Math.pow(1 + requiredReturn / 100, yearsToExit);
    const seriesAStakeAtExit = seriesAFutureValue / futureCompanyValue;

    // Series A pre-Series-B stake (must account for Series B dilution)
    const seriesAStakePreB = seriesAStakeAtExit / (1 - seriesBStake);
    const f = seriesAStakePreB;

    // Scenario 1: Pool before round
    const s1FounderShares = currentShares * (1 - poolPct);
    const s1OptionShares = currentShares * poolPct;
    const s1VcShares = currentShares * f / (1 - f);
    const s1Total = currentShares + s1VcShares;
    const s1SharePrice = investment / (s1VcShares / 1000000);
    const s1PreMoney = s1SharePrice * currentShares / 1000000;
    const s1PostMoney = s1PreMoney + investment;

    // Scenario 2: Pool after round, no adjustment
    const s2VcShares = currentShares * f / (1 - f);
    const s2TotalAfterVc = currentShares + s2VcShares;
    const s2OptionShares = s2TotalAfterVc * poolPct / (1 - poolPct);
    const s2Total = s2TotalAfterVc + s2OptionShares;
    const s2SharePrice = investment / (s2VcShares / 1000000);
    const s2PreMoney = s2SharePrice * currentShares / 1000000;
    const s2PostMoney = s2PreMoney + investment;

    // Scenario 3: Pool after round, with adjustment
    const adjustedF = f / (1 - poolPct);
    const s3VcShares = currentShares * adjustedF / (1 - adjustedF);
    const s3TotalAfterVc = currentShares + s3VcShares;
    const s3OptionShares = s3TotalAfterVc * poolPct / (1 - poolPct);
    const s3Total = s3TotalAfterVc + s3OptionShares;
    const s3SharePrice = investment / (s3VcShares / 1000000);
    const s3PreMoney = s3SharePrice * currentShares / 1000000;
    const s3PostMoney = s3PreMoney + investment;

    // Series B valuations (same across scenarios since Series B is based on exit value)
    const seriesBPostMoney = seriesBInvestment / seriesBStake;
    const seriesBPreMoney = seriesBPostMoney - seriesBInvestment;

    return {
      seriesBStake,
      seriesAStakeAtExit,
      seriesAStakePreB: f,
      seriesBPreMoney,
      seriesBPostMoney,
      scenario1: {
        vcShares: s1VcShares, total: s1Total,
        sharePrice: s1SharePrice, preMoney: s1PreMoney, postMoney: s1PostMoney,
        vcPct: s1VcShares / s1Total,
      },
      scenario2: {
        vcShares: s2VcShares, total: s2Total,
        sharePrice: s2SharePrice, preMoney: s2PreMoney, postMoney: s2PostMoney,
        vcPct: s2VcShares / s2Total,
      },
      scenario3: {
        vcShares: s3VcShares, total: s3Total,
        sharePrice: s3SharePrice, preMoney: s3PreMoney, postMoney: s3PostMoney,
        vcPct: s3VcShares / s3Total,
      },
    };
  }, [investment, netIncome, peMultiple, requiredReturn, yearsToExit, currentShares, optionPoolPct, seriesBInvestment, seriesBReturn, yearsBtoExit]);

  // ========== Tab D calculations ==========
  const convertibleNotes = useMemo(() => {
    const stakeFrac = seriesAStakePct / 100;
    const postMoney = seriesARaise / stakeFrac;
    const preMoney = postMoney - seriesARaise;
    const seriesAPrice = preMoney / noteCurrentShares;
    const seriesAShares = seriesARaise / seriesAPrice;
    const totalAfterA = noteCurrentShares + seriesAShares;

    // Note conversion
    const discountPrice = seriesAPrice * (discountRate / 100);
    const capPrice = valuationCap / totalAfterA;
    const effectivePrice = Math.min(discountPrice, capPrice);
    const noteShares = noteAmount / effectivePrice;
    const grandTotal = noteCurrentShares + seriesAShares + noteShares;

    // Sensitivity: vary Series A stake from 10% to 55%
    const sensitivity = [];
    for (let s = 10; s <= 55; s += 1) {
      const sf = s / 100;
      const pm = seriesARaise / sf;
      const pre = pm - seriesARaise;
      const sp = pre / noteCurrentShares;
      const saShares = seriesARaise / sp;
      const totA = noteCurrentShares + saShares;
      const dp = sp * (discountRate / 100);
      const cp = valuationCap / totA;
      const ep = Math.min(dp, cp);
      const ns = noteAmount / ep;
      const gt = noteCurrentShares + saShares + ns;
      sensitivity.push({
        stake: s,
        seriesAPrice: sp,
        discountPrice: dp,
        capPrice: cp,
        effectivePrice: ep,
        noteShares: ns,
        notePct: ns / gt * 100,
        founderPct: noteCurrentShares / gt * 100,
        seriesAPct: saShares / gt * 100,
      });
    }

    return {
      postMoney,
      preMoney,
      seriesAPrice,
      seriesAShares,
      totalAfterA,
      discountPrice,
      capPrice,
      effectivePrice,
      noteShares,
      grandTotal,
      founderShares: noteCurrentShares,
      founderPct: noteCurrentShares / grandTotal,
      seriesAPct: seriesAShares / grandTotal,
      notePct: noteShares / grandTotal,
      sensitivity,
    };
  }, [noteAmount, noteCurrentShares, seriesARaise, seriesAStakePct, discountRate, valuationCap]);

  // ========== Tab E calculations ==========
  const optionsPricing = useMemo(() => {
    const u = 1 + annualVolatility / 100;
    const d = 1 / u;
    const strikePrice = optSharePrice * (1 + strikePremium / 100);
    const investmentShares = optInvestment / optSharePrice;
    const optionShares = optOptionAmount / strikePrice;
    const years = 5;

    const nodes = [];
    let expectedOptionValue = 0;

    for (let k = 0; k <= years; k++) {
      const freq = comb(years, k) / Math.pow(2, years);
      const multiplier = Math.pow(u, k) * Math.pow(d, years - k);
      const shareValue = optSharePrice * multiplier;
      const totalStockValue = shareValue * optionShares;
      const optionPayoffPerShare = Math.max(0, shareValue - strikePrice);
      const totalOptionPayoff = optionPayoffPerShare * optionShares;
      expectedOptionValue += freq * totalOptionPayoff;

      nodes.push({
        ups: k,
        downs: years - k,
        frequency: freq,
        multiplier,
        shareValue,
        totalStockValue,
        optionPayoffPerShare,
        totalOptionPayoff,
      });
    }

    const impliedInvestment = optInvestment - expectedOptionValue;
    const impliedSharePrice = impliedInvestment / investmentShares;
    const impliedPreMoney = impliedSharePrice * optCurrentShares;

    return {
      u, d, strikePrice, investmentShares, optionShares,
      nodes: nodes.reverse(), // show 5 ups first
      expectedOptionValue,
      impliedInvestment,
      impliedSharePrice,
      impliedPreMoney,
    };
  }, [optCurrentShares, optSharePrice, optInvestment, optOptionAmount, strikePremium, annualVolatility]);

  // ========== Tab F calculations ==========
  const participatingPref = useMemo(() => {
    const preMoney = negotiatedPreMoney;
    const postMoney = preMoney + investment;
    const sharePrice = preMoney / (currentShares / 1000000);
    const vcShares = investment / sharePrice * 1000000;
    const totalShares = currentShares + vcShares;
    const vcOwnership = vcShares / totalShares;
    const futureCompanyValue = netIncome * peMultiple;

    const waterfall = EXIT_VALUES_M.map(exitM => {
      const exit = exitM;

      // Participating preferred
      let vcPayoutPart, founderPayoutPart;
      if (exit <= investment) {
        vcPayoutPart = exit;
        founderPayoutPart = 0;
      } else {
        vcPayoutPart = investment + (exit - investment) * vcOwnership;
        founderPayoutPart = (exit - investment) * (1 - vcOwnership);
      }

      // Non-participating (baseline)
      const vcConvert = exit * vcOwnership;
      const vcNonPart = Math.max(investment, vcConvert);
      const founderNonPart = exit - vcNonPart;

      const effectiveVcPct = exit > 0 ? vcPayoutPart / exit : 0;
      const annualizedReturn = vcPayoutPart > 0 ? Math.pow(vcPayoutPart / investment, 1 / yearsToExit) - 1 : -1;

      return {
        exitM: exit,
        vcPayoutPart,
        founderPayoutPart,
        vcNonPart,
        founderNonPart,
        effectiveVcPct,
        annualizedReturn,
      };
    });

    // Conversion threshold for non-participating
    const conversionThreshold = investment / vcOwnership;

    // Implied pre-money at expected exit with participating preferred
    // At expected exit, VC gets: investment + (futureCompanyValue - investment) * vcOwnership
    // VC wants this to equal investment * (1+RRR)^years
    const targetVcPayout = investment * Math.pow(1 + requiredReturn / 100, yearsToExit);
    // targetVcPayout = investment + (futureCompanyValue - investment) * vcOwn
    // => vcOwn = (targetVcPayout - investment) / (futureCompanyValue - investment)
    const impliedVcOwn = futureCompanyValue > investment
      ? (targetVcPayout - investment) / (futureCompanyValue - investment)
      : 1;
    const impliedPostMoney = impliedVcOwn > 0 ? investment / impliedVcOwn : 0;
    const impliedPreMoney = impliedPostMoney - investment;

    // Chart data
    const chartData = waterfall.map(w => ({
      exit: w.exitM,
      participating: w.vcPayoutPart,
      nonParticipating: w.vcNonPart,
      founderPart: w.founderPayoutPart,
    }));

    return {
      preMoney, postMoney, sharePrice, vcShares, totalShares, vcOwnership,
      futureCompanyValue, waterfall, conversionThreshold,
      impliedPreMoney, chartData,
    };
  }, [investment, netIncome, peMultiple, requiredReturn, yearsToExit, currentShares, negotiatedPreMoney]);

  // ========== Tab G calculations ==========
  const cumDividends = useMemo(() => {
    const preMoney = negotiatedPreMoney;
    const postMoney = preMoney + investment;
    const sharePrice = preMoney / (currentShares / 1000000);
    const vcShares = investment / sharePrice * 1000000;
    const totalShares = currentShares + vcShares;
    const vcOwnership = vcShares / totalShares;
    const futureCompanyValue = netIncome * peMultiple;

    const accruedDividends = investment * (dividendRate / 100) * yearsToExit;
    const enhancedClaim = investment + accruedDividends;

    const waterfall = EXIT_VALUES_M.map(exitM => {
      const exit = exitM;

      // Participating preferred with cumulative dividends
      let vcPayoutPart, founderPayoutPart;
      if (exit <= enhancedClaim) {
        vcPayoutPart = exit;
        founderPayoutPart = 0;
      } else {
        vcPayoutPart = enhancedClaim + (exit - enhancedClaim) * vcOwnership;
        founderPayoutPart = (exit - enhancedClaim) * (1 - vcOwnership);
      }

      // Non-participating with dividends
      const vcConvert = exit * vcOwnership;
      const vcNonPart = Math.max(enhancedClaim, vcConvert);
      const founderNonPart = exit - vcNonPart;

      // Without dividends (baseline from Tab F)
      let vcNoDivPart;
      if (exit <= investment) {
        vcNoDivPart = exit;
      } else {
        vcNoDivPart = investment + (exit - investment) * vcOwnership;
      }

      const effectiveVcPct = exit > 0 ? vcPayoutPart / exit : 0;
      const annualizedReturn = vcPayoutPart > 0 ? Math.pow(vcPayoutPart / investment, 1 / yearsToExit) - 1 : -1;

      return {
        exitM: exit,
        vcPayoutPart,
        founderPayoutPart,
        vcNonPart,
        founderNonPart,
        vcNoDivPart,
        effectiveVcPct,
        annualizedReturn,
      };
    });

    // Implied pre-money with participating + dividends at expected exit
    const targetVcPayout = investment * Math.pow(1 + requiredReturn / 100, yearsToExit);
    const impliedVcOwn = futureCompanyValue > enhancedClaim
      ? (targetVcPayout - enhancedClaim) / (futureCompanyValue - enhancedClaim)
      : 1;
    const impliedPostMoney = impliedVcOwn > 0 ? investment / impliedVcOwn : 0;
    const impliedPreMoney = impliedPostMoney - investment;

    const chartData = waterfall.map(w => ({
      exit: w.exitM,
      withDividends: w.vcPayoutPart,
      withoutDividends: w.vcNoDivPart,
      nonParticipating: w.vcNonPart,
    }));

    return {
      preMoney, postMoney, vcOwnership, accruedDividends, enhancedClaim,
      waterfall, impliedPreMoney, chartData,
    };
  }, [investment, netIncome, peMultiple, requiredReturn, yearsToExit, currentShares, negotiatedPreMoney, dividendRate]);

  // ========== Render helpers ==========
  const thStyle = { padding: '10px 12px', textAlign: 'right', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 };
  const thStyleLeft = { ...thStyle, textAlign: 'left' };
  const tdStyle = { padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 };
  const tdStyleLeft = { ...tdStyle, textAlign: 'left', fontFamily: "'Source Sans 3', sans-serif" };
  const trHover = {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.15s',
  };

  const renderRow = (cells, key, highlight = false) => (
    <tr key={key}
      style={{ ...trHover, background: highlight ? 'rgba(13, 148, 136, 0.04)' : 'transparent' }}
      onMouseEnter={e => e.currentTarget.style.background = highlight ? 'rgba(13, 148, 136, 0.08)' : '#f8fafc'}
      onMouseLeave={e => e.currentTarget.style.background = highlight ? 'rgba(13, 148, 136, 0.04)' : 'transparent'}
    >
      {cells}
    </tr>
  );

  const cardPanel = (title, children) => (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 28, marginBottom: 28 }}>
      <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: 20, fontWeight: 600, margin: '0 0 20px 0', color: '#1e293b' }}>{title}</h3>
      {children}
    </div>
  );

  // ========== Sidebar renderers ==========
  const renderSidebarA = () => (
    <>
      <div className="vn-section-title" style={{ marginTop: 0 }}>Core Assumptions</div>
      <Slider label="Investment Amount" value={investment} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setInvestment} />
      <Slider label="Projected Net Income" value={netIncome} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setNetIncome} />
      <Slider label="P/E Multiple" value={peMultiple} min={5} max={40} step={1}
        format={v => `${v}x`} onChange={setPeMultiple} />
      <Slider label="Required Return" value={requiredReturn} min={10} max={80} step={5}
        format={v => `${v}%`} onChange={setRequiredReturn} />
      <Slider label="Years to Exit" value={yearsToExit} min={1} max={10} step={1}
        format={v => `${v} yrs`} onChange={setYearsToExit} />
      <Slider label="Current Shares" value={currentShares} min={100000} max={10000000} step={100000}
        format={v => fmtN(v)} onChange={setCurrentShares} />
      <div className="vn-section-title">Sensitivity</div>
      <Slider label="Alt. Required Return" value={altReturn} min={10} max={80} step={5}
        format={v => `${v}%`} onChange={setAltReturn} />
    </>
  );

  const renderSidebarB = () => (
    <>
      <div className="vn-section-title" style={{ marginTop: 0 }}>Core Assumptions</div>
      <Slider label="Investment Amount" value={investment} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setInvestment} />
      <Slider label="Projected Net Income" value={netIncome} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setNetIncome} />
      <Slider label="P/E Multiple" value={peMultiple} min={5} max={40} step={1}
        format={v => `${v}x`} onChange={setPeMultiple} />
      <Slider label="Required Return" value={requiredReturn} min={10} max={80} step={5}
        format={v => `${v}%`} onChange={setRequiredReturn} />
      <Slider label="Years to Exit" value={yearsToExit} min={1} max={10} step={1}
        format={v => `${v} yrs`} onChange={setYearsToExit} />
      <Slider label="Current Shares" value={currentShares} min={100000} max={10000000} step={100000}
        format={v => fmtN(v)} onChange={setCurrentShares} />
      <div className="vn-section-title">Option Pool</div>
      <Slider label="Option Pool %" value={optionPoolPct} min={5} max={40} step={1}
        format={v => `${v}%`} onChange={setOptionPoolPct} />
    </>
  );

  const renderSidebarC = () => (
    <>
      <div className="vn-section-title" style={{ marginTop: 0 }}>Series A</div>
      <Slider label="Investment Amount" value={investment} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setInvestment} />
      <Slider label="Required Return" value={requiredReturn} min={10} max={80} step={5}
        format={v => `${v}%`} onChange={setRequiredReturn} />
      <Slider label="Years to Exit" value={yearsToExit} min={1} max={10} step={1}
        format={v => `${v} yrs`} onChange={setYearsToExit} />
      <Slider label="Current Shares" value={currentShares} min={100000} max={10000000} step={100000}
        format={v => fmtN(v)} onChange={setCurrentShares} />
      <div className="vn-section-title">Exit Assumptions</div>
      <Slider label="Projected Net Income" value={netIncome} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setNetIncome} />
      <Slider label="P/E Multiple" value={peMultiple} min={5} max={40} step={1}
        format={v => `${v}x`} onChange={setPeMultiple} />
      <div className="vn-section-title">Series B</div>
      <Slider label="Series B Investment" value={seriesBInvestment} min={1} max={30} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setSeriesBInvestment} />
      <Slider label="Series B Required Return" value={seriesBReturn} min={5} max={60} step={5}
        format={v => `${v}%`} onChange={setSeriesBReturn} />
      <Slider label="Years B to Exit" value={yearsBtoExit} min={1} max={5} step={1}
        format={v => `${v} yrs`} onChange={setYearsBtoExit} />
      <div className="vn-section-title">Option Pool</div>
      <Slider label="Option Pool %" value={optionPoolPct} min={5} max={40} step={1}
        format={v => `${v}%`} onChange={setOptionPoolPct} />
    </>
  );

  const renderSidebarD = () => (
    <>
      <div className="vn-section-title" style={{ marginTop: 0 }}>Series A Terms</div>
      <Slider label="Series A Raise" value={seriesARaise} min={500000} max={20000000} step={100000}
        format={v => `$${fmtK(v)}`} onChange={setSeriesARaise} />
      <Slider label="Series A Stake %" value={seriesAStakePct} min={5} max={60} step={1}
        format={v => `${v}%`} onChange={setSeriesAStakePct} />
      <Slider label="Current Shares" value={noteCurrentShares} min={100000} max={10000000} step={10000}
        format={v => fmtN(v)} onChange={setNoteCurrentShares} />
      <div className="vn-section-title">Note Terms</div>
      <Slider label="Note Amount" value={noteAmount} min={100000} max={5000000} step={50000}
        format={v => `$${fmtK(v)}`} onChange={setNoteAmount} />
      <Slider label="Discount Rate" value={discountRate} min={50} max={100} step={5}
        format={v => `${v}%`} onChange={setDiscountRate} />
      <Slider label="Valuation Cap" value={valuationCap} min={1000000} max={30000000} step={500000}
        format={v => `$${fmtK(v)}`} onChange={setValuationCap} />
    </>
  );

  const renderSidebarE = () => (
    <>
      <div className="vn-section-title" style={{ marginTop: 0 }}>Equity Investment</div>
      <Slider label="Current Shares" value={optCurrentShares} min={1000000} max={10000000} step={100000}
        format={v => fmtN(v)} onChange={setOptCurrentShares} />
      <Slider label="Share Price" value={optSharePrice} min={0.5} max={10} step={0.25}
        format={v => `$${v.toFixed(2)}`} onChange={setOptSharePrice} />
      <Slider label="Investment Amount" value={optInvestment} min={1000000} max={20000000} step={500000}
        format={v => `$${fmtK(v)}`} onChange={setOptInvestment} />
      <div className="vn-section-title">Option Terms</div>
      <Slider label="Option Amount" value={optOptionAmount} min={1000000} max={20000000} step={500000}
        format={v => `$${fmtK(v)}`} onChange={setOptOptionAmount} />
      <Slider label="Strike Premium" value={strikePremium} min={0} max={100} step={5}
        format={v => `${v}%`} onChange={setStrikePremium} />
      <Slider label="Annual Volatility" value={annualVolatility} min={10} max={100} step={5}
        format={v => `${v}%`} onChange={setAnnualVolatility} />
    </>
  );

  const renderSidebarF = () => (
    <>
      <div className="vn-section-title" style={{ marginTop: 0 }}>Deal Terms</div>
      <Slider label="Investment Amount" value={investment} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setInvestment} />
      <Slider label="Negotiated Pre-Money" value={negotiatedPreMoney} min={1} max={30} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setNegotiatedPreMoney} />
      <Slider label="Current Shares" value={currentShares} min={100000} max={10000000} step={100000}
        format={v => fmtN(v)} onChange={setCurrentShares} />
      <div className="vn-section-title">Exit Assumptions</div>
      <Slider label="Projected Net Income" value={netIncome} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setNetIncome} />
      <Slider label="P/E Multiple" value={peMultiple} min={5} max={40} step={1}
        format={v => `${v}x`} onChange={setPeMultiple} />
      <Slider label="Required Return" value={requiredReturn} min={10} max={80} step={5}
        format={v => `${v}%`} onChange={setRequiredReturn} />
      <Slider label="Years to Exit" value={yearsToExit} min={1} max={10} step={1}
        format={v => `${v} yrs`} onChange={setYearsToExit} />
    </>
  );

  const renderSidebarG = () => (
    <>
      <div className="vn-section-title" style={{ marginTop: 0 }}>Deal Terms</div>
      <Slider label="Investment Amount" value={investment} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setInvestment} />
      <Slider label="Negotiated Pre-Money" value={negotiatedPreMoney} min={1} max={30} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setNegotiatedPreMoney} />
      <Slider label="Current Shares" value={currentShares} min={100000} max={10000000} step={100000}
        format={v => fmtN(v)} onChange={setCurrentShares} />
      <div className="vn-section-title">Exit Assumptions</div>
      <Slider label="Projected Net Income" value={netIncome} min={0.5} max={20} step={0.5}
        format={v => `$${v.toFixed(1)}M`} onChange={setNetIncome} />
      <Slider label="P/E Multiple" value={peMultiple} min={5} max={40} step={1}
        format={v => `${v}x`} onChange={setPeMultiple} />
      <Slider label="Required Return" value={requiredReturn} min={10} max={80} step={5}
        format={v => `${v}%`} onChange={setRequiredReturn} />
      <Slider label="Years to Exit" value={yearsToExit} min={1} max={10} step={1}
        format={v => `${v} yrs`} onChange={setYearsToExit} />
      <div className="vn-section-title">Dividends</div>
      <Slider label="Annual Dividend Rate" value={dividendRate} min={0} max={25} step={1}
        format={v => `${v}%`} onChange={setDividendRate} />
    </>
  );

  // ========== Tab content renderers ==========
  const renderTabA = () => {
    const v = vcMethod;
    return (
      <>
        <div className="vn-metrics-grid">
          <MetricCard label="Future Company Value" value={fmtM(v.futureCompanyValue)} />
          <MetricCard label="Future Investment Value" value={fmtM(v.futureInvestmentValue)} />
          <MetricCard label="Required VC Stake" value={fmtPct(v.vcStake)} color="#2563eb" />
          <MetricCard label="Post-Money Valuation" value={fmtM(v.postMoney)} />
          <MetricCard label="Pre-Money Valuation" value={fmtM(v.preMoney)} color="#7c3aed" />
          <MetricCard label="Share Price" value={fmtDollar(v.sharePrice)} color="#d97706" />
          <MetricCard label="New Shares Issued" value={fmtN(Math.round(v.newShares))} color="#64748b" />
        </div>

        {cardPanel('Sensitivity: Required Return Comparison', (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={thStyleLeft}>Metric</th>
                <th style={thStyle}>{requiredReturn}% Return</th>
                <th style={thStyle}>{altReturn}% Return</th>
                <th style={thStyle}>Difference</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Future Investment Value', fmtM(v.futureInvestmentValue), fmtM(v.alt.futureInvestmentValue), fmtM(v.alt.futureInvestmentValue - v.futureInvestmentValue)],
                ['Required VC Stake', fmtPct(v.vcStake), fmtPct(v.alt.vcStake), fmtPct(v.alt.vcStake - v.vcStake)],
                ['Post-Money Valuation', fmtM(v.postMoney), fmtM(v.alt.postMoney), fmtM(v.alt.postMoney - v.postMoney)],
                ['Pre-Money Valuation', fmtM(v.preMoney), fmtM(v.alt.preMoney), fmtM(v.alt.preMoney - v.preMoney)],
                ['Share Price', fmtDollar(v.sharePrice), fmtDollar(v.alt.sharePrice), fmtDollar(v.alt.sharePrice - v.sharePrice)],
                ['New Shares Issued', fmtN(Math.round(v.newShares)), fmtN(Math.round(v.alt.newShares)), fmtN(Math.round(v.alt.newShares - v.newShares))],
              ].map(([label, val1, val2, diff], i) =>
                renderRow([
                  <td key="l" style={tdStyleLeft}>{label}</td>,
                  <td key="v1" style={tdStyle}>{val1}</td>,
                  <td key="v2" style={tdStyle}>{val2}</td>,
                  <td key="d" style={{ ...tdStyle, color: '#dc2626' }}>{diff}</td>,
                ], i)
              )}
            </tbody>
          </table>
        ))}

        {cardPanel('How It Works', (
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#1e293b' }}>Future Company Value</strong> = Net Income x P/E = ${netIncome}M x {peMultiple} = {fmtM(v.futureCompanyValue)}</p>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#1e293b' }}>Future Investment Value</strong> = Investment x (1 + RRR)^Years = ${investment}M x (1 + {requiredReturn}%)^{yearsToExit} = {fmtM(v.futureInvestmentValue)}</p>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#1e293b' }}>Required VC Stake</strong> = Future Inv. Value / Future Co. Value = {fmtM(v.futureInvestmentValue)} / {fmtM(v.futureCompanyValue)} = {fmtPct(v.vcStake)}</p>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#1e293b' }}>Post-Money</strong> = Investment / VC Stake = ${investment}M / {fmtPct(v.vcStake)} = {fmtM(v.postMoney)}</p>
            <p style={{ margin: 0 }}><strong style={{ color: '#1e293b' }}>Pre-Money</strong> = Post-Money - Investment = {fmtM(v.postMoney)} - ${investment}M = {fmtM(v.preMoney)}</p>
          </div>
        ))}
      </>
    );
  };

  const renderTabB = () => {
    const { scenario1: s1, scenario2: s2, scenario3: s3 } = optionPool;
    const scenarios = [
      { label: 'Pool Before Round', data: s1 },
      { label: 'Pool After (Naive)', data: s2 },
      { label: 'Pool After (Adjusted)', data: s3 },
    ];

    return (
      <>
        {cardPanel('Cap Table Comparison', (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyleLeft}>Party</th>
                  {scenarios.map(s => (
                    <th key={s.label} style={thStyle} colSpan={2}>{s.label}</th>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={thStyleLeft}></th>
                  {scenarios.map(s => (
                    <React.Fragment key={s.label}>
                      <th style={thStyle}>Shares</th>
                      <th style={thStyle}>Stake %</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Founders', 'Option Pool', 'VC (Series A)', 'Total'].map((party, i) => {
                  const getValues = (sc) => {
                    switch(party) {
                      case 'Founders': return [sc.founderShares, sc.founderPct];
                      case 'Option Pool': return [sc.optionShares, sc.optionPct];
                      case 'VC (Series A)': return [sc.vcShares, sc.vcPct];
                      case 'Total': return [sc.total, 1];
                      default: return [0, 0];
                    }
                  };
                  const isTotal = party === 'Total';
                  return renderRow([
                    <td key="l" style={{ ...tdStyleLeft, fontWeight: isTotal ? 600 : 400 }}>{party}</td>,
                    ...scenarios.flatMap(s => {
                      const [shares, pct] = getValues(s.data);
                      return [
                        <td key={`${s.label}-s`} style={{ ...tdStyle, fontWeight: isTotal ? 600 : 400 }}>{fmtN(Math.round(shares))}</td>,
                        <td key={`${s.label}-p`} style={{ ...tdStyle, fontWeight: isTotal ? 600 : 400 }}>{fmtPct(pct)}</td>,
                      ];
                    }),
                  ], i, isTotal);
                })}
              </tbody>
            </table>
          </div>
        ))}

        {cardPanel('Valuation Impact', (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyleLeft}>Metric</th>
                  {scenarios.map(s => (
                    <th key={s.label} style={thStyle}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Share Price', s => fmtDollar(s.sharePrice)],
                  ['Pre-Money', s => fmtM(s.preMoney)],
                  ['Post-Money', s => fmtM(s.postMoney)],
                  ['VC Ownership', s => fmtPct(s.vcPct)],
                  ['Founder Ownership', s => fmtPct(s.founderPct)],
                ].map(([label, fmt], i) =>
                  renderRow([
                    <td key="l" style={tdStyleLeft}>{label}</td>,
                    <td key="s1" style={tdStyle}>{fmt(s1)}</td>,
                    <td key="s2" style={tdStyle}>{fmt(s2)}</td>,
                    <td key="s3" style={tdStyle}>{fmt(s3)}</td>,
                  ], i)
                )}
              </tbody>
            </table>
          </div>
        ))}

        {cardPanel('Key Insight', (
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>
              When the option pool is created <strong style={{ color: '#1e293b' }}>before</strong> the round, it dilutes only existing shareholders (founders).
              When created <strong style={{ color: '#1e293b' }}>after</strong> without adjustment, the VC gets diluted below their target stake.
              The <strong style={{ color: '#0d9488' }}>adjusted scenario</strong> gives the VC a larger initial stake so they end up at exactly their target after pool dilution,
              effectively shifting the cost of the pool to the founders through a lower pre-money valuation
              ({fmtM(s3.preMoney)} vs {fmtM(s1.preMoney)}).
            </p>
          </div>
        ))}
      </>
    );
  };

  const renderTabC = () => {
    const m = multiRound;
    const scenarios = [
      { label: 'Pool Before', data: m.scenario1 },
      { label: 'Pool After (Naive)', data: m.scenario2 },
      { label: 'Pool After (Adj.)', data: m.scenario3 },
    ];

    return (
      <>
        <div className="vn-metrics-grid">
          <MetricCard label="Future Company Value" value={fmtM(netIncome * peMultiple)} />
          <MetricCard label="Series A Stake at Exit" value={fmtPct(m.seriesAStakeAtExit)} color="#2563eb" />
          <MetricCard label="Series A Stake Pre-B" value={fmtPct(m.seriesAStakePreB)} color="#7c3aed" />
          <MetricCard label="Series B Stake" value={fmtPct(m.seriesBStake)} color="#d97706" />
        </div>

        {cardPanel('Series A Valuations by Scenario', (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyleLeft}>Metric</th>
                  {scenarios.map(s => (
                    <th key={s.label} style={thStyle}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Series A VC Ownership', s => fmtPct(s.vcPct)],
                  ['Series A Share Price', s => fmtDollar(s.sharePrice)],
                  ['Series A Pre-Money', s => fmtM(s.preMoney)],
                  ['Series A Post-Money', s => fmtM(s.postMoney)],
                ].map(([label, fmt], i) =>
                  renderRow([
                    <td key="l" style={tdStyleLeft}>{label}</td>,
                    ...scenarios.map(s => (
                      <td key={s.label} style={tdStyle}>{fmt(s.data)}</td>
                    )),
                  ], i)
                )}
              </tbody>
            </table>
          </div>
        ))}

        {cardPanel('Series B Valuations', (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyleLeft}>Metric</th>
                  <th style={thStyle}>Value</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Series B Investment', fmtM(seriesBInvestment)],
                  ['Series B Required Return', `${seriesBReturn}%`],
                  ['Years B to Exit', `${yearsBtoExit} yrs`],
                  ['Series B Stake', fmtPct(m.seriesBStake)],
                  ['Series B Post-Money', fmtM(m.seriesBPostMoney)],
                  ['Series B Pre-Money', fmtM(m.seriesBPreMoney)],
                ].map(([label, val], i) =>
                  renderRow([
                    <td key="l" style={tdStyleLeft}>{label}</td>,
                    <td key="v" style={tdStyle}>{val}</td>,
                  ], i)
                )}
              </tbody>
            </table>
          </div>
        ))}

        {cardPanel('Key Insight', (
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>
              With a second funding round, Series A investors must account for future dilution from Series B.
              The required Series A stake <strong style={{ color: '#1e293b' }}>before</strong> Series B
              ({fmtPct(m.seriesAStakePreB)}) is higher than the stake needed at exit ({fmtPct(m.seriesAStakeAtExit)})
              because Series B will take {fmtPct(m.seriesBStake)} of the company.
              This further compresses the pre-money valuation for founders, especially when combined with option pool adjustments.
            </p>
          </div>
        ))}
      </>
    );
  };

  const renderTabD = () => {
    const c = convertibleNotes;
    return (
      <>
        <div className="vn-metrics-grid">
          <MetricCard label="Series A Price/Share" value={fmtDollar(c.seriesAPrice)} />
          <MetricCard label="Discount Price" value={fmtDollar(c.discountPrice)} color="#2563eb" />
          <MetricCard label="Cap Price" value={fmtDollar(c.capPrice)} color="#d97706" />
          <MetricCard label="Effective Price" value={fmtDollar(c.effectivePrice)} color="#dc2626" />
          <MetricCard label="Note Shares" value={fmtN(Math.round(c.noteShares))} color="#7c3aed" />
        </div>

        {cardPanel('Conversion Mechanics', (
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 20 }}>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#1e293b' }}>Post-Money</strong> = Series A Raise / Stake% = ${fmtK(seriesARaise)} / {seriesAStakePct}% = {fmtDollar(c.postMoney)}</p>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#1e293b' }}>Pre-Money</strong> = Post-Money - Raise = {fmtDollar(c.postMoney)} - ${fmtK(seriesARaise)} = {fmtDollar(c.preMoney)}</p>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#1e293b' }}>Series A Price</strong> = Pre-Money / Shares = {fmtDollar(c.preMoney)} / {fmtN(noteCurrentShares)} = {fmtDollar(c.seriesAPrice)}</p>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#2563eb' }}>Discount Price</strong> = Series A Price x {discountRate}% = {fmtDollar(c.discountPrice)}</p>
            <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#d97706' }}>Cap Price</strong> = Cap / Total Post-A Shares = ${fmtK(valuationCap)} / {fmtN(Math.round(c.totalAfterA))} = {fmtDollar(c.capPrice)}</p>
            <p style={{ margin: 0 }}><strong style={{ color: '#dc2626' }}>Effective Price</strong> = min(Discount, Cap) = {fmtDollar(c.effectivePrice)} ({c.capPrice < c.discountPrice ? 'Cap' : 'Discount'} governs)</p>
          </div>
        ))}

        {cardPanel('Three-Party Cap Table', (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={thStyleLeft}>Party</th>
                <th style={thStyle}>Shares</th>
                <th style={thStyle}>Stake %</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Founders', c.founderShares, c.founderPct],
                ['Series A', c.seriesAShares, c.seriesAPct],
                ['Note Holders', c.noteShares, c.notePct],
                ['Total', c.grandTotal, 1],
              ].map(([party, shares, pct], i) => {
                const isTotal = party === 'Total';
                return renderRow([
                  <td key="l" style={{ ...tdStyleLeft, fontWeight: isTotal ? 600 : 400 }}>{party}</td>,
                  <td key="s" style={{ ...tdStyle, fontWeight: isTotal ? 600 : 400 }}>{fmtN(Math.round(shares))}</td>,
                  <td key="p" style={{ ...tdStyle, fontWeight: isTotal ? 600 : 400 }}>{fmtPct(pct)}</td>,
                ], i, isTotal);
              })}
            </tbody>
          </table>
        ))}

        {cardPanel('Sensitivity: Note Ownership vs Series A Stake', (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={c.sensitivity} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="stake" tickFormatter={v => `${v}%`} fontSize={11} stroke="#94a3b8" label={{ value: 'Series A Stake %', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => `${v.toFixed(0)}%`} fontSize={11} stroke="#94a3b8" />
                <Tooltip formatter={(v) => `${v.toFixed(2)}%`} labelFormatter={l => `Series A Stake: ${l}%`} />
                <Line type="monotone" dataKey="notePct" name="Note Holder %" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="founderPct" name="Founder %" stroke="#0d9488" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="seriesAPct" name="Series A %" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </>
    );
  };

  const renderTabE = () => {
    const o = optionsPricing;
    return (
      <>
        <div className="vn-metrics-grid">
          <MetricCard label="Up Factor (u)" value={o.u.toFixed(4)} />
          <MetricCard label="Down Factor (d)" value={o.d.toFixed(4)} color="#dc2626" />
          <MetricCard label="Strike Price" value={fmtDollar(o.strikePrice)} color="#d97706" />
          <MetricCard label="Investment Shares" value={fmtN(Math.round(o.investmentShares))} color="#2563eb" />
          <MetricCard label="Option Shares" value={fmtN(Math.round(o.optionShares))} color="#7c3aed" />
        </div>

        {cardPanel('5-Year Binomial Tree — Terminal Nodes', (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyleLeft}>Node</th>
                  <th style={thStyle}>Frequency</th>
                  <th style={thStyle}>Multiplier</th>
                  <th style={thStyle}>Share Value</th>
                  <th style={thStyle}>Option Payoff/Share</th>
                  <th style={thStyle}>Total Option Payoff</th>
                </tr>
              </thead>
              <tbody>
                {o.nodes.map((node, i) =>
                  renderRow([
                    <td key="l" style={tdStyleLeft}>{node.ups}u {node.downs}d</td>,
                    <td key="f" style={tdStyle}>{(node.frequency * 100).toFixed(2)}%</td>,
                    <td key="m" style={tdStyle}>{node.multiplier.toFixed(4)}x</td>,
                    <td key="sv" style={tdStyle}>{fmtDollar(node.shareValue)}</td>,
                    <td key="op" style={{ ...tdStyle, color: node.optionPayoffPerShare > 0 ? '#0d9488' : '#94a3b8' }}>{fmtDollar(node.optionPayoffPerShare)}</td>,
                    <td key="tp" style={{ ...tdStyle, color: node.totalOptionPayoff > 0 ? '#0d9488' : '#94a3b8' }}>{fmtM(node.totalOptionPayoff / 1e6)}</td>,
                  ], i, node.totalOptionPayoff > 0)
                )}
              </tbody>
            </table>
          </div>
        ))}

        {cardPanel('Implied Valuation', (
          <>
            <div className="vn-metrics-grid" style={{ marginBottom: 20 }}>
              <MetricCard label="Expected Option Value" value={fmtM(o.expectedOptionValue / 1e6)} color="#0d9488" />
              <MetricCard label="Implied Equity Investment" value={fmtM(o.impliedInvestment / 1e6)} color="#2563eb" />
              <MetricCard label="Implied Share Price" value={fmtDollar(o.impliedSharePrice)} color="#d97706" />
              <MetricCard label="Implied Pre-Money" value={fmtM(o.impliedPreMoney / 1e6)} color="#7c3aed" />
            </div>
            <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
              <p style={{ margin: '0 0 8px 0' }}>The VC pays <strong style={{ color: '#1e293b' }}>${fmtK(optInvestment)}</strong> for {fmtN(Math.round(o.investmentShares))} shares at ${optSharePrice.toFixed(2)}/share, plus receives options on {fmtN(Math.round(o.optionShares))} additional shares.</p>
              <p style={{ margin: '0 0 8px 0' }}>The expected value of these options is <strong style={{ color: '#0d9488' }}>{fmtM(o.expectedOptionValue / 1e6)}</strong>, so the implied equity investment is only {fmtM(o.impliedInvestment / 1e6)}.</p>
              <p style={{ margin: 0 }}>This means the implied share price is <strong style={{ color: '#d97706' }}>{fmtDollar(o.impliedSharePrice)}</strong> vs the headline price of ${optSharePrice.toFixed(2)}, giving an implied pre-money of <strong style={{ color: '#7c3aed' }}>{fmtM(o.impliedPreMoney / 1e6)}</strong> vs the headline {fmtM(optSharePrice * optCurrentShares / 1e6)}.</p>
            </div>
          </>
        ))}
      </>
    );
  };

  const renderTabF = () => {
    const p = participatingPref;
    return (
      <>
        <div className="vn-metrics-grid">
          <MetricCard label="Pre-Money" value={fmtM(p.preMoney)} />
          <MetricCard label="Post-Money" value={fmtM(p.postMoney)} color="#2563eb" />
          <MetricCard label="VC Ownership" value={fmtPct(p.vcOwnership)} color="#7c3aed" />
          <MetricCard label="Future Co. Value" value={fmtM(p.futureCompanyValue)} color="#d97706" />
          <MetricCard label="Conversion Threshold" value={fmtM(p.conversionThreshold)} color="#dc2626" />
          <MetricCard label="Implied Pre-Money (Part.)" value={fmtM(p.impliedPreMoney)} color="#0d9488" />
        </div>

        {cardPanel('Liquidation Waterfall — Participating vs Non-Participating', (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyleLeft}>Exit Value</th>
                  <th style={{ ...thStyle, color: '#0d9488' }}>VC Payout (Part.)</th>
                  <th style={thStyle}>Founder Payout (Part.)</th>
                  <th style={{ ...thStyle, color: '#2563eb' }}>VC Payout (Non-Part.)</th>
                  <th style={thStyle}>Effective VC %</th>
                  <th style={thStyle}>Annualized Return</th>
                </tr>
              </thead>
              <tbody>
                {p.waterfall.map((w, i) => {
                  const isExpected = w.exitM === netIncome * peMultiple;
                  return renderRow([
                    <td key="e" style={{ ...tdStyleLeft, fontWeight: isExpected ? 600 : 400 }}>{fmtM(w.exitM)}{isExpected ? ' *' : ''}</td>,
                    <td key="vp" style={{ ...tdStyle, color: '#0d9488' }}>{fmtM(w.vcPayoutPart)}</td>,
                    <td key="fp" style={tdStyle}>{fmtM(w.founderPayoutPart)}</td>,
                    <td key="vnp" style={{ ...tdStyle, color: '#2563eb' }}>{fmtM(w.vcNonPart)}</td>,
                    <td key="pct" style={tdStyle}>{fmtPct(w.effectiveVcPct)}</td>,
                    <td key="ret" style={{ ...tdStyle, color: w.annualizedReturn >= 0 ? '#0d9488' : '#dc2626' }}>{fmtPctWhole(w.annualizedReturn * 100)}</td>,
                  ], i, isExpected);
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>* Expected exit value based on VC method</div>
          </div>
        ))}

        {cardPanel('VC Payout Comparison', (
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <LineChart data={p.chartData.filter(d => d.exit <= 200)} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="exit" tickFormatter={v => `$${v}M`} fontSize={11} stroke="#94a3b8" />
                <YAxis tickFormatter={v => `$${v}M`} fontSize={11} stroke="#94a3b8" />
                <Tooltip formatter={(v) => fmtM(v)} labelFormatter={l => `Exit: $${l}M`} />
                <Line type="monotone" dataKey="participating" name="Participating Pref." stroke="#0d9488" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="nonParticipating" name="Non-Participating" stroke="#2563eb" strokeWidth={2} dot={false} strokeDasharray="6 3" />
                <Line type="monotone" dataKey="founderPart" name="Founder (Part.)" stroke="#d97706" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}

        {cardPanel('Key Insight', (
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>
              With <strong style={{ color: '#1e293b' }}>participating preferred</strong>, the VC gets their investment back <em>plus</em> their pro-rata share of remaining proceeds.
              This means the headline pre-money of <strong style={{ color: '#7c3aed' }}>{fmtM(p.preMoney)}</strong> overstates what founders actually receive.
              At the expected exit of {fmtM(p.futureCompanyValue)}, the implied pre-money accounting for participation is only <strong style={{ color: '#0d9488' }}>{fmtM(p.impliedPreMoney)}</strong>.
              The non-participating conversion threshold is {fmtM(p.conversionThreshold)} — below this, the VC takes the liquidation preference instead of converting.
            </p>
          </div>
        ))}
      </>
    );
  };

  const renderTabG = () => {
    const c = cumDividends;
    const p = participatingPref;
    return (
      <>
        <div className="vn-metrics-grid">
          <MetricCard label="Accrued Dividends" value={fmtM(c.accruedDividends)} color="#d97706" />
          <MetricCard label="Enhanced Claim" value={fmtM(c.enhancedClaim)} color="#dc2626" />
          <MetricCard label="VC Ownership" value={fmtPct(c.vcOwnership)} color="#7c3aed" />
          <MetricCard label="Implied Pre-Money (Div.)" value={fmtM(c.impliedPreMoney)} color="#0d9488" />
        </div>

        {cardPanel(`Liquidation Waterfall — With ${dividendRate}% Cumulative Dividends`, (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyleLeft}>Exit Value</th>
                  <th style={{ ...thStyle, color: '#dc2626' }}>VC (Part. + Div.)</th>
                  <th style={thStyle}>Founder (Part. + Div.)</th>
                  <th style={{ ...thStyle, color: '#0d9488' }}>VC (Part. No Div.)</th>
                  <th style={{ ...thStyle, color: '#2563eb' }}>VC (Non-Part. + Div.)</th>
                  <th style={thStyle}>Effective VC %</th>
                  <th style={thStyle}>Annualized Return</th>
                </tr>
              </thead>
              <tbody>
                {c.waterfall.map((w, i) => {
                  const isExpected = w.exitM === netIncome * peMultiple;
                  return renderRow([
                    <td key="e" style={{ ...tdStyleLeft, fontWeight: isExpected ? 600 : 400 }}>{fmtM(w.exitM)}{isExpected ? ' *' : ''}</td>,
                    <td key="vd" style={{ ...tdStyle, color: '#dc2626' }}>{fmtM(w.vcPayoutPart)}</td>,
                    <td key="fd" style={tdStyle}>{fmtM(w.founderPayoutPart)}</td>,
                    <td key="vnd" style={{ ...tdStyle, color: '#0d9488' }}>{fmtM(w.vcNoDivPart)}</td>,
                    <td key="vnp" style={{ ...tdStyle, color: '#2563eb' }}>{fmtM(w.vcNonPart)}</td>,
                    <td key="pct" style={tdStyle}>{fmtPct(w.effectiveVcPct)}</td>,
                    <td key="ret" style={{ ...tdStyle, color: w.annualizedReturn >= 0 ? '#0d9488' : '#dc2626' }}>{fmtPctWhole(w.annualizedReturn * 100)}</td>,
                  ], i, isExpected);
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>* Expected exit value based on VC method</div>
          </div>
        ))}

        {cardPanel('VC Payout Comparison', (
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <LineChart data={c.chartData.filter(d => d.exit <= 200)} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="exit" tickFormatter={v => `$${v}M`} fontSize={11} stroke="#94a3b8" />
                <YAxis tickFormatter={v => `$${v}M`} fontSize={11} stroke="#94a3b8" />
                <Tooltip formatter={(v) => fmtM(v)} labelFormatter={l => `Exit: $${l}M`} />
                <Line type="monotone" dataKey="withDividends" name="Part. + Dividends" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="withoutDividends" name="Part. No Dividends" stroke="#0d9488" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="nonParticipating" name="Non-Part. + Dividends" stroke="#2563eb" strokeWidth={2} dot={false} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}

        {cardPanel('Key Insight', (
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>
              Adding a <strong style={{ color: '#1e293b' }}>{dividendRate}% cumulative dividend</strong> increases the VC's preferred claim
              from {fmtM(investment)} to <strong style={{ color: '#dc2626' }}>{fmtM(c.enhancedClaim)}</strong> over {yearsToExit} years
              (accrued dividends of {fmtM(c.accruedDividends)}).
              This further reduces the implied pre-money valuation to <strong style={{ color: '#0d9488' }}>{fmtM(c.impliedPreMoney)}</strong>,
              compared to {fmtM(p.impliedPreMoney)} without dividends.
              The longer the time to exit, the more significant the dividend impact becomes.
            </p>
          </div>
        ))}
      </>
    );
  };

  const renderSidebar = () => {
    switch(activeTab) {
      case 'vc-method': return renderSidebarA();
      case 'option-pool': return renderSidebarB();
      case 'multi-round': return renderSidebarC();
      case 'convertible-notes': return renderSidebarD();
      case 'options-pricing': return renderSidebarE();
      case 'participating-pref': return renderSidebarF();
      case 'cum-dividends': return renderSidebarG();
      default: return null;
    }
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'vc-method': return renderTabA();
      case 'option-pool': return renderTabB();
      case 'multi-round': return renderTabC();
      case 'convertible-notes': return renderTabD();
      case 'options-pricing': return renderTabE();
      case 'participating-pref': return renderTabF();
      case 'cum-dividends': return renderTabG();
      default: return null;
    }
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .vn-wrapper { padding: 40px; }
        .vn-title { font-size: 38px; }
        .vn-tab-bar {
          display: flex;
          gap: 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .vn-tab-btn {
          padding: 10px 18px;
          border: none;
          background: #ffffff;
          color: #64748b;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Source Sans 3', sans-serif;
          font-weight: 500;
        }
        .vn-tab-btn:not(:last-child) { border-right: 1px solid #e2e8f0; }
        .vn-tab-btn.active {
          background: linear-gradient(135deg, rgba(13, 148, 136, 0.1), rgba(22, 163, 74, 0.1));
          color: #0d9488;
          font-weight: 600;
        }
        .vn-tab-btn:hover:not(.active) {
          background: #f8fafc;
          color: #1e293b;
        }
        .vn-section-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #94a3b8;
          margin-bottom: 16px;
          margin-top: 28px;
          font-weight: 500;
        }
        .vn-slider-container { margin-bottom: 20px; }
        .vn-slider-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
          color: #64748b;
        }
        .vn-slider-value {
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
        .vn-metric-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 18px;
          text-align: center;
        }
        .vn-metric-value {
          font-family: monospace;
          font-size: 26px;
          font-weight: 500;
          color: #0d9488;
          margin-bottom: 4px;
        }
        .vn-metric-label {
          font-size: 11px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .vn-main-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 48px;
        }
        .vn-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 28px;
        }
        .vn-chart-container {
          width: 100%;
          overflow: hidden;
        }
        .vn-chart-container svg {
          display: block;
          width: 100%;
          height: auto;
        }
        @media (max-width: 1100px) {
          .vn-main-layout { grid-template-columns: 1fr; gap: 32px; }
          .vn-metrics-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .vn-title { font-size: 28px; }
          .vn-wrapper { padding: 20px; }
          .vn-metric-value { font-size: 20px; }
          .vn-metric-label { font-size: 9px; }
        }
        @media (max-width: 600px) {
          .vn-metrics-grid { grid-template-columns: repeat(2, 1fr); }
          .vn-tab-btn { padding: 8px 12px; font-size: 11px; }
        }
      `}</style>

      <div className="vn-wrapper" style={{
        maxWidth: 1400,
        margin: '0 auto',
        fontFamily: "'Source Sans 3', sans-serif",
        color: '#1e293b',
        background: 'linear-gradient(145deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%)',
        minHeight: '100vh',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 className="vn-title" style={{
            fontFamily: "'Crimson Pro', serif",
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: 8,
            marginTop: 0,
          }}>Valuation Nuances</h1>
          <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
            Explore VC valuation methods, option pool mechanics, convertible notes, option pricing, and liquidation preferences.
          </p>
        </div>

        {/* Tab Bar */}
        <div className="vn-tab-bar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`vn-tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Layout */}
        <div className="vn-main-layout">
          {/* Left Sidebar */}
          <div>
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 24,
            }}>
              {renderSidebar()}
            </div>
          </div>

          {/* Right Content */}
          <div>
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
};

function Slider({ label, value, min, max, step, format, onChange }) {
  return (
    <div className="vn-slider-container">
      <div className="vn-slider-label">
        <span>{label}</span>
        <span className="vn-slider-value">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function MetricCard({ label, value, color = '#0d9488' }) {
  return (
    <div className="vn-metric-card">
      <div className="vn-metric-value" style={{ color }}>{value}</div>
      <div className="vn-metric-label">{label}</div>
    </div>
  );
}

export default ValuationNuances;
