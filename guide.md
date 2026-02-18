# Venture Capital Tools — Guide

These tools are designed to help you reason about the mechanics of venture capital — how startups are valued, how deal terms shape economics, and how fund structures determine LP returns. Each one takes a question that seems straightforward but hides significant complexity, and breaks it into components you can estimate and manipulate independently.

### A Note on Analytical Decomposition

The same principle applies here as in financial modelling more broadly. Someone asks "What is this company worth?" and you can't answer that as a single number — it depends on growth trajectory, risk of failure, comparable companies, and quality factors. But you *can* answer: "What's the revenue forecast?", "What's the survival probability?", and "What do similar companies trade at?" Combine those three answers through a structured framework and you have a defensible valuation range.

Every tool in this guide follows this pattern:

1. **Start with a question** that's too complex to answer directly
2. **Decompose** it into component factors — the inputs you see in the tool
3. **Specify the relationships** between those factors — the formulas
4. **Recombine** them to produce the answer — the outputs

The tools are presented in a logical sequence:

| # | Tool | Core Question |
|---|------|---------------|
| 1 | [VC Valuation](#1-vc-valuation) | What is this company worth today? |
| 2 | [Valuation Nuances](#2-valuation-nuances) | How do deal terms shift real economics away from headline valuations? |
| 3 | [Term Sheet Analyzer](#3-term-sheet-analyzer) | How do competing term sheets compare on founder economics? |
| 4 | [Fund Fees Explorer](#4-fund-fees-explorer) | How do management fees and carry affect LP net returns? |
| 5 | [Fund J-Curve](#5-fund-j-curve) | What does the investor's cash journey look like? |

---

## 1. VC Valuation

### What It Does

Triangulates a startup valuation using three approaches: DCF (discounted cash flow), comparable company multiples, and quality adjustments. The distinctive feature is a risk-adjusted discount rate that embeds survival probability — the risk that there may be no company at all, which is quite different from the risk that revenues might be volatile.

### How the Problem Is Decomposed

The question is: *"What is this company worth?"* — one of the hardest questions in finance, and especially hard for startups that may have no revenue, no profit, and a high probability of ceasing to exist.

The tool breaks it into three independent estimation approaches, then blends them:

```
"What is this company worth?"
  │
  ├─ APPROACH 1: Discounted Cash Flow
  │    ├─ Revenue trajectory    → "What will revenue be in Years 1-5?"
  │    │    └─ Current ARR × growth rates (year by year)
  │    ├─ Profitability         → "How much cash does each £ of revenue generate?"
  │    │    └─ Gross margin − operating expenses
  │    ├─ Terminal value         → "What is it worth at Year 5?"
  │    │    └─ Year 5 Revenue × exit multiple
  │    └─ Discount rate          → "What rate reflects the risk?"
  │         ├─ Base rate         → time value of money
  │         └─ Survival risk     → probability of extinction
  │              ├─ Survival rate  → % chance of reaching maturity
  │              └─ Time horizon   → years until "established"
  │
  ├─ APPROACH 2: Comparable Companies
  │    ├─ Peer multiples        → "What do similar companies trade at?"
  │    │    └─ Valuation ÷ Revenue for each comparable
  │    └─ Apply median to current revenue
  │
  ├─ APPROACH 3: Quality Adjustment
  │    └─ "Is this company better or worse than the comparables?"
  │         ├─ Team quality       (weighted 20%)
  │         ├─ Product quality    (weighted 20%)
  │         ├─ Market quality     (weighted 15%)
  │         ├─ Traction           (weighted 15%)
  │         └─ Defensibility      (weighted 10%)
  │
  └─ BLEND: average across approaches → valuation range
```

The key decomposition insight is the **separation of operating performance from existential risk**. Traditional DCF uses a single discount rate to capture both the time value of money and company-specific risk. This tool separates them: the base rate handles time value, and the survival probability handles the risk that the company simply ceases to exist. That's more honest for startups, where the dominant risk isn't volatility around a forecast — it's that there may be no company at all.

The triangulation across three methods is itself a decomposition principle: no single method is reliable for startups, but consistent signals across methods increase confidence.

### Computational Structure

**Risk-Adjusted Discount Rate** (the core innovation)
```
Annual failure rate = 1 − survival_rate^(1/years_to_established)
Adjusted rate = (base_rate + failure_rate) / (1 − failure_rate)
```
Example: 35% survival over 4 years → 23% annual failure → 15% base rate becomes ~50% effective rate.

**DCF**
```
Revenue[t] = Revenue[t-1] × (1 + growth_rate[t])
Cash Flow[t] = Revenue[t] × gross_margin − Revenue[t] × opex%
Terminal Value = Year 5 Revenue × terminal_multiple
DCF = Σ(CF[t] / (1 + rate)^t) + Terminal Value / (1 + rate)⁵
```
Calculated twice: once with the base rate, once with the risk-adjusted rate.

**Comparable Analysis**
```
Median multiple = median of (valuation / revenue) across comparable companies
Comparable Value = current_revenue × median_multiple × quality_multiplier
```

**Quality Multiplier** (five factors, weighted)
```
Per factor: multiplier = 1 + ((score − 3) / 2) × weight
Total = product of all five factors
```
Scores of 1–5 map to 0.7x–1.3x per factor (centred on neutral at 3).

**Valuation Range:** Low/Mid/High blended from both approaches.

### How to Think About the Inputs

**The stage preset is your starting point, not your answer.** Selecting "Series A" pre-fills survival rate (35%), years to established (4), and base discount rate (15%). These are market averages. If you believe a specific company is lower-risk than a typical Series A, adjust the survival rate upward — but be prepared to explain why.

**Survival rate is the single most powerful lever.** Moving survival from 35% to 50% dramatically reduces the risk-adjusted discount rate, which in turn dramatically increases the DCF valuation. That tells you something important: de-risking is the most value-creative activity a startup can undertake. It's not just about reducing risk — it directly increases what the company is worth.

**Growth rates should tell a story, not just go up.** The five individual growth rate inputs (Y1–Y5) let you model a trajectory. A typical pattern: high initial growth (100%+) that decelerates over time (to 30-50% by Year 5). Flat or accelerating growth over 5 years is rare.

**Gross margin and OpEx% together determine your cash flow.** If gross margin is 70% and OpEx is 80% of revenue, your cash flow is *negative*. This is normal for early-stage companies, but your growth rates need to be high enough that revenue eventually outpaces OpEx.

**Terminal multiple deserves careful thought.** This single number often dominates the DCF. A 15x revenue multiple on Year 5 revenue assumes the market will value the company richly at maturity. If your terminal multiple accounts for more than 70% of total DCF value, your valuation is essentially a bet on the exit, not on the cash flows.

**Quality scores are subjective — use them for relative comparison.** Score a company 3/5 on everything first (neutral baseline). Then ask: "Is this team *above average* or *below average* for companies at this stage?" Only move scores you can justify.

**Compare DCF and comparable valuations.** If the DCF is much higher than the comparable, your revenue projections may be too aggressive. If comparables are much higher, the market may be overvalued — or your projections are too conservative. The *gap* between the two methods is where the most useful conversation happens.

---

## 2. Valuation Nuances

*This tool is under development.*

### What It Will Do

Explore how deal terms shift real economics away from headline valuations. A "$10M pre-money valuation" sounds simple, but the actual economics depend heavily on the structure layered on top: participating preferred shares, cumulative dividends, option pool placement, and convertible note terms. This tool will make those hidden dynamics visible.

### Core Question

*"What is the real valuation once you account for deal structure?"*

The headline valuation — the number in the press release — is rarely what determines founder economics. Participating preferred means investors share in the upside *after* getting their money back. Cumulative dividends accrete a return before common shareholders see anything. Pre-money option pools dilute founders before the investor's price is calculated. Each of these mechanisms can shift tens of percentage points of effective ownership without changing the headline number.

This tool will decompose a headline valuation into its structural components and show how each provision affects the *effective* valuation — what founders and investors actually receive at different exit scenarios.

---

## 3. Term Sheet Analyzer

*This tool is under development.*

### What It Will Do

Compare competing term sheets side by side. When a startup receives multiple offers, the headline valuation is only one dimension — the protective provisions, board composition, anti-dilution clauses, and liquidation preferences can make a "lower" offer more founder-friendly than a "higher" one.

### Core Question

*"Which term sheet is actually better for founders?"*

The tool will decompose term sheets into their component provisions and model the economic impact of each across a range of exit scenarios. A 1x non-participating preference at $12M pre-money might be worth more to founders than a 1.5x participating preference at $15M pre-money — but only at certain exit valuations. The crossover analysis reveals which deal is better under which assumptions.

---

## 4. Fund Fees Explorer

*This tool is under development.*

### What It Will Do

Model VC fund fee structures from the LP perspective. Management fees and carried interest are the two primary costs of investing in a VC fund, and their interaction with fund performance determines the net return LPs actually receive.

### Core Question

*"How do fees affect LP net returns?"*

A "2 and 20" fund (2% management fee, 20% carry) sounds standard, but the details matter enormously. Does the management fee apply to committed capital or invested capital? Does it step down after the investment period? Is there a preferred return hurdle before carry kicks in? Is the carry calculated deal-by-deal or on a whole-fund basis? Each structural choice can shift LP net returns by several percentage points — which, compounded over a 10-year fund life, represents a meaningful difference in absolute returns.

---

## 5. Fund J-Curve

### What It Does

Models the cash flow experience from the **investor's perspective** — how a venture fund's portfolio of investments creates capital calls (money going out) and distributions (money coming back) over its lifetime.

**A note on fund structure.** Venture capital funds are typically structured as **Limited Liability Partnerships (LLPs)** with two key features. First, they have a **limited lifespan** — usually 10-12 years (the tool models 15 to capture late exits). Second, they separate the people who provide the capital from the people who invest it. The investors who put money into the fund are called **Limited Partners (LPs)** — "limited" because they have no control over which companies get funded. The fund managers who make the investment decisions are called **General Partners (GPs)**. LPs commit capital upfront but it gets drawn down ("called") over time as the GP finds and funds companies. Returns flow back to LPs as portfolio companies are exited. The J-curve in this tool is the LP's experience: money going out in the early years (capital calls), then money coming back in the later years (distributions).

### How the Problem Is Decomposed

The question is: *"What does the LP's cash flow experience look like?"* — a portfolio-level question that aggregates many individual company outcomes into a single fund trajectory.

The tool breaks it through **two levels** — strategy decisions at the fund level, and outcome modelling at the company level:

```
"What is the fund's cash trajectory?"
  │
  ├─ FUND STRATEGY (top-level choices)
  │    ├─ Fund size             → total capital available
  │    ├─ Number of companies   → portfolio breadth
  │    ├─ Deployment period     → how fast capital goes out
  │    ├─ Follow-on reserve     → how much is held back for winners
  │    └─ Stage allocation      → % in Seed / Series A / Series B
  │
  └─ COMPANY OUTCOMES (per stage profile, per company)
       ├─ Initial check size    → first investment
       ├─ Follow-on rounds      → conditional on survival at each stage
       │    ├─ Survival probability to next stage
       │    └─ Additional capital if survived
       ├─ Time to exit          → when returns arrive
       └─ Exit multiple distribution → probability-weighted outcomes
            └─ e.g., 60% fail, 20% return 2x, 12% return 8x, ...
```

The decomposition principle here is **aggregation from the bottom up**. The fund's J-curve is not modelled directly — it *emerges* from simulating each company independently and summing the results. This mirrors how venture funds actually work: the GP makes individual investment decisions, and the fund-level outcome is the aggregate.

The stage allocation input is where strategy meets arithmetic. By shifting the mix between Seed (high risk, long duration, power-law returns) and Series B (lower risk, shorter duration, compressed returns), you change the *shape* of the aggregate curve without changing any individual company model. That tells you something important: portfolio construction — not individual deal selection — is the primary determinant of fund-level cash flow timing.

### Computational Structure

**Per Company (staggered across deployment period):**
```
Month of investment: capital call = −initial_check
Follow-on A: additional capital × survival_probability_to_A
Follow-on B: additional capital × cumulative_survival
Exit: total_capital_in_company × expected_multiple × survival_to_exit
```

**Fund Level (180-month aggregation):**
```
Monthly net flow = Σ(all company capital calls + distributions)
Cumulative J-curve = running sum of net flows
TVPI = total_returned / total_invested
DPI @ Year 10 = distributions_through_month_120 / calls_through_month_120
```

Stage profiles encode survival chains and exit multiple distributions (e.g., Seed: 60% fail at 0x, 20% return 2x, 12% return 8x, 6% return 15x, 2% return 30x).

### How to Think About the Inputs

**Stage allocation is the primary strategic choice.** This determines the *shape* of the fund's J-curve:
- Seed-heavy funds: deep trough, long wait (7+ years to exits), high variance, potential for outlier returns
- Series B-heavy funds: shallow trough, faster exits (3-4 years), lower variance, compressed multiples
- Multi-stage: smoother curve but more capital-intensive (follow-ons)

**Number of companies vs. fund size determines check size.** A £100M fund investing in 20 companies deploys ~£5M per company (including follow-ons). A 40-company fund deploys ~£2.5M. More companies = better diversification but smaller ownership stakes. Fewer companies = concentrated bets with higher variance.

**Follow-on reserve is often underestimated.** At 50% reserve, half the fund is held back for follow-on rounds in winners. This means initial deployment is only half the fund size, spread over the deployment period. Too little reserve (20%) means you can't support your winners. Too much (70%) means tiny initial checks and limited portfolio breadth.

**Deployment period shapes the early curve.** A 3-year deployment means rapid capital calls — the J-curve drops steeply. A 6-year deployment spreads calls out, creating a shallower descent but a longer time to peak capital call.

**Compare the four presets to understand fund strategy trade-offs:**
- Seed Specialist: Highest risk, highest potential TVPI, latest breakeven
- Series A Focused: Balanced — the "default" VC model
- Growth/Series B: Fastest DPI, lowest TVPI, shallowest curve
- Multi-Stage: Smoothest curve, but requires the most capital management skill

**DPI at Year 10 is what LPs care about most.** TVPI includes unrealised gains (paper returns). DPI is cash returned. A fund with 2.5x TVPI but 0.5x DPI at Year 10 has mostly unrealised value — LPs haven't actually gotten their money back yet. This is the fundamental tension in early-stage VC.

**The survival chain is the reality check.** For Seed investments: only 40% survive to Series A, 65% of those to Series B, 70% of those to exit. Cumulative: ~18% of seed investments produce an exit. This is why the 2% chance of a 30x return matters so much — a small number of outliers drive all fund returns. If you take away one number from this tool, take that one.

---

## Connecting the Tools

These tools form a sequence through the venture capital process:

1. **VC Valuation** establishes what the company is worth — the starting point for any deal
2. **Valuation Nuances** reveals how deal structure shifts the real economics away from the headline number
3. **Term Sheet Analyzer** compares competing offers on the dimensions that actually matter to founders
4. **Fund Fees Explorer** shows the cost structure that determines what LPs actually receive
5. **Fund J-Curve** models the LP's cash flow experience across the entire fund lifecycle

The outputs of one tool inform the inputs of another:
- The valuation from Tool 1 becomes the headline number that Tool 2 adjusts for deal structure
- The term sheet provisions in Tool 3 include the liquidation preferences and anti-dilution clauses that create the nuances in Tool 2
- The fund return multiples from Tool 5 must exceed the fee drag from Tool 4 for LPs to achieve target returns

Start with the tool that matches your current question. Use the connections to deepen your analysis.
