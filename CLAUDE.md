# VC Tools

Interactive web-based tools for venture capital analysis exercises. Deployed on Vercel.

Modelled after the `financial-tools` monorepo (`/Users/dpd24/Dropbox/Apps/financial-tools/`). Same tech stack, styling conventions, and build/deploy workflow.

## Project Structure

- `packages/*/` — Vite + React source code
- `{tool-name}/` (root level) — **Built output** served by Vercel (do NOT edit directly)
- `shared.css` — Shared CSS variables and navigation styles (same as financial-tools)
- `index.html` — Home page / navigation hub
- `build.js` — Build orchestration script

## Build & Deploy Workflow

**Critical**: Vercel serves built output from root-level directories, not from `packages/`.

After changing any Vite tool source in `packages/*/`:
1. Commit the source changes
2. Run `npm run build`
3. Commit the rebuilt output (root-level `{tool-name}/` directory)
4. Push both commits

Preview locally: `npm run dev:{tool-name}`

## Styling Conventions

Same as financial-tools:
- **Fonts**: Crimson Pro (headers/branding), Source Sans 3 (body/UI)
- **Theme**: Light — `#f8fafc` background, `#ffffff` cards, `#e2e8f0` borders
- **Text**: `#1e293b` primary, `#64748b` secondary
- **Accents**: Teal `#0d9488`, Blue `#2563eb`, Red `#dc2626`, Amber `#d97706`, Purple `#7c3aed`
- **Google Fonts link**: `Crimson+Pro:wght@400;600;700&family=Source+Sans+3:wght@300;400;600`

## Tools (4 planned)

| Tool | Package | Source Exercise |
|------|---------|----------------|
| VC Valuation | `@vc-tools/vc-valuation` | Valuation exercises + Valuation with participation |
| Term Sheet Analyzer | `@vc-tools/term-sheet-analyzer` | VC termsheets |
| Fund Fees Explorer | `@vc-tools/fund-fees` | LP fees exercise |
| Venture Loan | `@vc-tools/venture-loan` | Venture loan |

## Navigation

Every tool page has a `<nav class="site-nav">` linking to all tools. When adding or removing a tool, update navigation in all tool `index.html` files plus the root `index.html`.

---

## Tool Specifications

### 1. VC Valuation (`vc-valuation`)

**Source**: `Valuation exercises.pdf/.xlsx` + `Valuation exercise with participation.pdf/.xlsx`

Combines both valuation exercises into a single multi-tab tool. Covers the core VC valuation methods and deal structure mechanics.

**Tab A — VC Method**
- Inputs: investment amount, projected net income, P/E multiple, required return, years to exit, current shares outstanding
- Calculates: future company value, future investment value, required VC stake, post-money/pre-money valuation, share price, new shares issued
- Sensitivity: toggle between different required return rates (e.g. 30% vs 40%)

**Tab B — Option Pool Dilution**
- Builds on Tab A inputs
- Three scenarios: (1) options issued before the round, (2) options issued after without factoring dilution, (3) options issued after with expected dilution factored in
- Inputs: option pool size (% of company)
- Shows cap table for each scenario: founder shares, option shares, VC shares, total shares, stake percentages, value

**Tab C — Multi-Round Dilution**
- Extends Tab A/B with a second funding round
- Additional inputs: Series B investment amount, Series B required return, years from Series B to exit
- Calculates Series B stake, then back-solves for required Series A stake across the three option pool scenarios
- Shows pre-money, post-money, and share price for each

**Tab D — Convertible Notes**
- Inputs: note amount, current shares, Series A raise amount, Series A stake %, discount rate, valuation cap
- Calculates both conversion prices (discount vs cap), selects lower, derives note shares
- Outputs three-party cap table: founders, Series A, note holders (shares + stake %)
- Toggle: vary Series A stake to see impact on note conversion

**Tab E — Option Pricing (Binomial)**
- Inputs: current shares, share price, investment amount, option amount, option premium (strike premium %), annual volatility
- Builds 5-year binomial tree: for each terminal node shows frequency, stock price multiplier, share value, option payoff
- Calculates expected option value
- Derives implied investment amount (investment minus option value), implied share price, implied pre-money valuation

**Tab F — Participating Preferred**
- Inputs: investment, net income, P/E, required return, years to exit, current shares, negotiated pre-money
- Liquidation waterfall table across a range of exit valuations ($3M to $10B):
  - VC payout (preferred claim + pro-rata remainder), founder payout, effective VC %, annualized VC return
- Comparison with baseline (non-participating) payout
- Derives implied pre-money valuation at the expected exit value
- Shows how participation shifts economics vs the headline valuation

**Tab G — Cumulative Dividends**
- Extends Tab F with cumulative non-cash dividend (annual rate on issue price)
- Inputs: dividend rate (e.g. 10%)
- Same waterfall table but with enhanced preferred claim (investment + accumulated dividends)
- Shows further implied valuation reduction vs headline pre-money

### 2. Term Sheet Analyzer (`term-sheet-analyzer`)

**Source**: `VC termsheets.pdf/.xlsx`

Side-by-side comparison tool for analyzing two competing VC term sheets. Uses the "Great Idea, Inc." scenario as the default but allows all parameters to be edited.

**Section A — Deal Structure**
- Two columns (Term Sheet 1 vs Term Sheet 2)
- Editable inputs per term sheet: share price, pre-money valuation, investment amount, option pool size
- Derived: post-money, shares issued, founder value after option pool
- Highlights key differences

**Section B — Liquidation Preferences**
- Inputs per term sheet: dividend type (cumulative/non-cumulative), dividend rate, guaranteed return rate, participation (yes/no with cap)
- Timeframe input (years to exit)
- Waterfall table at multiple exit valuations ($5M, $10M, $20M, $50M, $100M):
  - Series A payout, common holders payout, effective VC ownership %
- Conversion threshold: at what exit value does converting to common beat the preference
- Chart: VC payout vs common payout across exit values

**Section C — Anti-Dilution Protection**
- Inputs: anti-dilution type per term sheet (none, weighted average, full ratchet, or hybrid like "weighted average above 50% of price, full ratchet below")
- Down-round scenario inputs: new investment amount, new share price
- Three cap tables: (1) before down round, (2) after down round without anti-dilution, (3) after down round with anti-dilution
- Shows additional shares issued to Series A under each protection type
- Compares dilution impact on founders across term sheets

### 3. Fund Fees Explorer (`fund-fees`)

**Source**: `LP fees exercise.pdf/.xlsx`

Models VC fund economics from the LP perspective: fee structures, carry/clawback mechanics, and their impact on net returns.

**Section A — Fee Structure Comparison**
- Inputs: base annual expenses (starting amount + growth rate), fund vintages (year, size) for up to 6 funds
- Calculates pro-rata expense allocation across concurrent fund vintages by AUM share
- Compares budget-based (actual allocated expenses) vs fixed-rate management fee (e.g. 2% of committed capital)
- Shows cumulative difference over fund life
- Toggle: fee basis — committed capital vs paid-in capital (with drawdown schedule over N years)

**Section B — Carry & Clawback**
- Inputs: fund size, gross distribution amount, portion of portfolio exited, carry rate
- Two carry methods: deal-by-deal vs whole-fund (European waterfall)
- Calculates: distributed carry, true carry (on whole fund), clawback amount
- Shows LP net distribution under each method

**Section C — Fee-for-Clawback Trade**
- Models the proposed exchange: GP waives clawback in return for switching from budget-based to percentage-based fees
- Shows the dollar value of each side of the trade
- LP cash flow timeline (drawdowns, distributions, clawback/fee adjustments)
- Calculates net IRR under: (1) original terms with clawback recovery, (2) proposed fee swap

### 4. Venture Loan Calculator (`venture-loan`)

**Source**: `Venture loan.docx/.xlsx`

Models convertible loan/note mechanics showing how discount and cap provisions interact across different Series A pricing scenarios.

**Inputs**
- Loan amount, price discount %, valuation cap, next round size, current shares outstanding, annual interest rate, time to conversion (years)

**Outputs**
- Table across a range of Series A share prices (e.g. $0.50 to $6.00):
  - Discounted price, shares via discount method, ownership % via discount
  - Capped price, shares via cap method, ownership % via cap
  - Effective conversion: lower of discount/cap (highlighted)
- Chart: ownership % via discount vs ownership % via cap across share prices, with crossover point highlighted
- Three-party cap table at a user-selected share price: founder shares, Series A shares, note shares, total, stake %

---

## Source Files (reference material, not deployed)

Located in the repo root:
- `LP fees exercise.pdf` / `.xlsx` — Fund fees exercise description and workings
- `Valuation exercises.pdf` / `.xlsx` — VC method, convertible notes, option pricing
- `Valuation exercise with participation.pdf` / `.xlsx` — Participating preferred, cumulative dividends
- `VC termsheets.pdf` / `.xlsx` — Term sheet comparison exercise
- `Venture loan.docx` / `.xlsx` — Convertible loan exercise

## Gotchas

- `shared.css` warnings during build ("doesn't exist at build time") are harmless — resolved at runtime
