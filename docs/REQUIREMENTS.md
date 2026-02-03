# Retirement Planner - Requirements Document

> Generated from requirements interview on February 3, 2026

---

## 1. Executive Summary

### 1.1 Project Vision
A comprehensive personal retirement planning application that answers the fundamental question: "Can I retire, and when?" The app combines spending analysis, investment tracking, Monte Carlo projections, and market research into a single, privacy-focused tool.

### 1.2 User Profile
- **Users**: Single user (personal use)
- **Retirement timeline**: Under 5 years away
- **Usage pattern**: Monthly deep-dive sessions
- **Technical comfort**: Comfortable with data, wants transaction-level detail
- **Primary device**: Desktop/laptop

### 1.3 Core Goals
1. **Know if I can retire** - Answer the big question with probability-based projections
2. **Understand spending** - Track where money goes, identify trends
3. **Optimize investments** - Track portfolio, maintain target allocation
4. **Research & anticipate** - Monitor markets, track predictions

---

## 2. Financial Accounts & Assets

### 2.1 Retirement Accounts
| Account Type | Tax Treatment | Import Source |
|--------------|---------------|---------------|
| 401(k) / 403(b) | Tax-deferred | Manual / CSV |
| Traditional IRA | Tax-deferred | Edward Jones CSV |
| Roth IRA / Roth 401(k) | Tax-free growth | Edward Jones CSV |
| Brokerage (taxable) | Capital gains | Various |

### 2.2 Banking Accounts
| Account Type | Purpose | Import Source |
|--------------|---------|---------------|
| Checking | Daily transactions | Capital One, USA Bank |
| Savings | Emergency fund | Capital One, USA Bank |
| Money Market | Short-term savings | Various |
| Credit Cards | Spending tracking | Capital One |

### 2.3 Other Assets
| Asset Type | Tracking Method | Data Source |
|------------|-----------------|-------------|
| Home equity | Auto-estimate | Zillow API (Zestimate) |
| Social Security | Manual projection | SSA.gov estimates |

### 2.4 Liabilities
| Liability Type | Tracking Needs |
|----------------|----------------|
| Other loans | Balance, rate, payment schedule |
| Credit cards | Balance, interest, payments |

---

## 3. Income Sources

### 3.1 Current Income
- W-2 employment (primary)
- Self-employment / side income
- Dividends and interest from investments

### 3.2 Future Retirement Income
- Social Security benefits (timing optimization needed)
- Investment withdrawals (sequencing strategy)
- Potential continued side income

---

## 4. Feature Requirements

### 4.1 Transaction Import & Management

#### CSV Import (Priority: HIGH)
- **Guided wizard** for step-by-step import process
- Auto-detect bank format (Edward Jones, Capital One, USA Bank)
- Column mapping UI for unknown/new formats
- Duplicate detection and handling
- Batch import of multiple files
- **Transaction-level detail** - every transaction searchable and tagged

#### Auto-Categorization
- Best-guess categorization with **flagging for review**
- Learn from user corrections over time
- Custom category creation
- Bulk recategorization tools
- Rule-based pattern matching (regex)

### 4.2 Spending Analysis

#### Core Metrics
- **Trends over time** (primary focus)
- Monthly/annual spending totals
- Category breakdown
- Essential vs. discretionary split

#### Visualizations
- Spending trend line charts
- Category pie/bar charts
- Month-over-month comparison
- Seasonal pattern detection

### 4.3 Investment Tracking

#### Portfolio Management
- **Asset allocation view** across all accounts
- Holdings by account and consolidated
- **Auto-fetch current prices** from free APIs
- Performance tracking over time

#### Rebalancing
- Target allocation configuration
- **Rebalancing alerts** when drift exceeds threshold
- Suggested trades to rebalance

### 4.4 Retirement Projections

#### Simulation Engine
- **Monte Carlo simulation** (1,000+ scenarios)
- **Inflation-adjusted** projections (show in today's dollars)
- **Guardrails strategy** - dynamic spending adjustments based on portfolio performance
- Success probability display

#### Key Variables
- Retirement age
- Annual spending (by phase)
- Inflation assumptions
- Return rate assumptions
- Social Security timing and amount
- **Healthcare costs** (Medicare, supplements, long-term care)

### 4.5 Scenario Planning

#### Scenario Types
- **Market conditions** - bull, bear, recession, stagflation
- **Major life events** - healthcare crisis, helping family, inheritance, home sale

#### Comparison
- Side-by-side scenario comparison
- Sensitivity analysis ("what breaks first")

### 4.6 Tax Planning

#### Withdrawal Sequencing
- **Optimal withdrawal order** (taxable → tax-deferred → Roth)
- Tax bracket visualization by year
- Basic RMD calculations and reminders

### 4.7 Market Research Hub *(DEFERRED - Phase 2)*

> **Note**: Research Hub deferred to post-MVP. Focus first on core retirement planning features.

#### Economic Indicators Dashboard (Passive Monitoring) - *Deferred*
- S&P 500, NASDAQ, Dow Jones
- Federal Funds Rate
- Inflation (CPI)
- Unemployment rate
- 10-year Treasury yield

#### Personal Predictions Journal - *Deferred*
- Create and track market predictions
- Outcome tracking (correct/incorrect/pending)
- Historical accuracy score

#### News Aggregation - *Deferred*
- Curated financial news feeds (RSS)
- Source selection and filtering

### 4.8 Goals & Milestones

#### Countdown & Tracking
- **Retirement countdown** to target date
- **Net worth milestones** (e.g., $1M, $1.5M)
- Progress visualization

#### Alerts
- **Rebalancing alerts** - when allocation drifts
- **Milestone alerts** - celebrate achievements

### 4.9 Real Estate Tracking

#### Home Value
- **Zillow-style auto-estimate** using Zillow API
- Manual override capability
- Historical value tracking
- Factor into net worth calculations

---

## 5. Data & Storage Requirements

### 5.1 Storage Architecture
- **Convex cloud database** - All financial data stored in Convex
- Data encrypted at rest, private to your Convex account
- Real-time sync and reactive queries
- Public repository safe (API keys in `.env.local`)

### 5.2 Data Security

#### Sensitive Data Handling
- **Account numbers**: Store only **last 4 digits** (mask as `****1234`)
- **Routing numbers**: Never stored
- **Full transaction descriptions**: Stored (needed for categorization)
- **Amounts**: Stored normally (needed for analysis)

#### Infrastructure Security
- Convex API keys in `.env.local` (gitignored)
- `.env.example` template with placeholder values for repo
- Convex functions provide server-side security
- Convex encryption at rest for all stored data
- No sensitive data in client-side code or logs

#### What Gets Stored in Convex
| Data | Stored | Format |
|------|--------|--------|
| Account names | ✅ | User-defined friendly names |
| Account numbers | ✅ | Last 4 digits only (`****1234`) |
| Routing numbers | ❌ | Never stored |
| Transaction amounts | ✅ | Full precision |
| Transaction descriptions | ✅ | Full text (for categorization) |
| Transaction dates | ✅ | Full date |
| Holdings/shares | ✅ | Full precision |
| Social Security estimates | ✅ | User-entered projections |

### 5.3 Backup & Export
- **Manual JSON export** on demand
- CSV export for spreadsheet use
- Convex provides data portability via export functions

---

## 6. User Experience Requirements

### 6.1 Visual Design
- **Dark mode** theme
- **Balanced data density** - informative but not overwhelming
- Clean, modern aesthetic
- Emphasis on data visualization

### 6.2 Navigation
- Dashboard overview as home
- Clear section navigation
- Breadcrumb context
- Quick actions accessible

### 6.3 Import Workflow
- Guided wizard (step-by-step)
- Progress indication
- Error handling with clear messages
- Review before commit

### 6.4 Responsive Design
- **Desktop-optimized** (primary use case)
- Minimum 1280px viewport target
- Mobile not required for MVP

---

## 7. Technical Requirements

### 7.1 Technology Stack
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Next.js 14+ (App Router) | User preference, modern React |
| Database | **Convex** | Real-time, serverless, great DX, TypeScript-first |
| State | Zustand | Lightweight, persists to storage |
| Charts | Recharts | Easy to use, good React integration |
| Styling | Tailwind CSS | Rapid development, dark mode |
| CSV Parsing | Papa Parse | Robust, handles edge cases |

> **Note**: Using Convex means financial data is stored in Convex cloud (encrypted, private to your account). Requires internet connection. Public repo safe with `.env.local` for API keys.

### 7.2 External APIs
| API | Purpose | Rate Limit | Phase |
|-----|---------|------------|-------|
| Alpha Vantage | Stock/ETF prices | 25/day (free) | MVP |
| Zillow (unofficial) | Home estimates | TBD | MVP |
| FRED | Economic indicators | Unlimited | Phase 2 |
| Financial news RSS | News feeds | N/A | Phase 2 |

### 7.3 Browser Requirements
- Modern browsers (Chrome, Firefox, Safari, Edge)
- IndexedDB support required
- JavaScript required (no SSR for data)

---

## 8. Data Import Specifications

### 8.1 Supported Banks (Initial)

#### Edward Jones
- Account statements (investments)
- Transaction history
- Expected columns: Settlement Date, Description, Amount, etc.

#### Capital One
- Credit card transactions
- Bank account transactions
- Expected columns: Transaction Date, Description, Debit, Credit, Card No.

#### USA Bank
- Checking/savings transactions
- Format TBD (need sample)

#### Generic Fallback
- Column mapping wizard for unknown formats
- Save mappings for reuse

### 8.2 Data Validation
- Date parsing with format detection
- Amount parsing (handle negatives, parentheses)
- Duplicate detection (same date, amount, description)

---

## 9. Calculation Specifications

### 9.1 Monte Carlo Simulation
- Minimum 1,000 simulation runs
- Variable return rates (normal distribution around expected return)
- Inflation variability
- Output: probability of success at various confidence levels

### 9.2 Guardrails Strategy
- Upper guardrail: Increase spending if portfolio exceeds target by X%
- Lower guardrail: Decrease spending if portfolio falls below target by X%
- Configurable thresholds

### 9.3 Withdrawal Sequencing
- Default order: Taxable → Tax-deferred → Roth
- Tax bracket optimization
- RMD integration when applicable

### 9.4 Social Security Optimization
- Break-even analysis for claiming ages
- Spousal benefit considerations (future)

---

## 10. Reporting & Export

### 10.1 Export Formats
- **CSV export** - transactions, portfolio, spending summaries
- **JSON backup** - full database export for backup/restore

### 10.2 Future Considerations
- PDF report generation (not MVP)
- Chart image export (not MVP)

---

## 11. Non-Functional Requirements

### 11.1 Performance
- Page load under 3 seconds
- Chart rendering under 1 second
- Import processing: 1000 transactions < 5 seconds

### 11.2 Reliability
- Graceful handling of API failures
- Offline capability for core features
- Data never lost on browser close

### 11.3 Maintainability
- Clean code architecture
- Component-based design
- Documented API integrations

---

## 12. Risk Assessment & Known Challenges

### Why Build vs Buy?
Existing tools (Empower, Boldin, Projection Lab) are mature and affordable ($0-120/year). This project is worth building for: learning, complete customization, privacy control, and the satisfaction of building something personal.

### Success Probability
- Basic transaction import: 90%
- Spending analysis dashboard: 85%
- Investment tracking with prices: 75%
- Monte Carlo projections: 70%
- Complete, polished MVP: **50%**

### Known Pain Points
| Challenge | Severity | Mitigation |
|-----------|----------|------------|
| CSV format variations | High | Build flexible parser with manual column mapping fallback |
| Free API rate limits | Medium | Cache aggressively, batch requests |
| Scope creep | High | Stick to MVP, resist "one more feature" |
| Motivation sustainability | High | Ship small wins frequently |
| Zillow API instability | Medium | Have manual home value fallback |

---

## 13. Deferred Features (Phase 2+)

The following are deferred to later phases:

- **Market Research Hub** - Economic indicators, prediction journal, news feeds
- Mobile app / responsive mobile design
- Multi-user / family sharing
- Plaid integration (automated bank sync)
- Social Security spousal optimization
- Estate planning / inheritance optimization
- Rental property tracking
- Cryptocurrency tracking
- PDF report generation
- Email notifications

---

## 14. Open Questions

1. **App Name**: What should we call this application?
2. **Color Scheme**: Any specific colors beyond dark mode?
3. **Sample Data**: Can you provide sample CSVs (anonymized) from your banks?
4. **Hosting**: Vercel free tier acceptable?
5. **Healthcare Costs**: What level of detail? (Medicare premiums, supplemental insurance, HSA, etc.)

---

## 15. Success Criteria

### MVP Success Criteria
The MVP will be considered successful when:

1. ✅ Can import transactions from all three banks (Edward Jones, Capital One, USA Bank)
2. ✅ Displays spending trends over any time period
3. ✅ Shows asset allocation across all accounts with current values
4. ✅ Runs Monte Carlo simulation showing retirement success probability
5. ✅ Implements guardrails strategy with configurable thresholds
6. ✅ Shows home value estimate from Zillow
7. ✅ Provides retirement countdown and milestone tracking
8. ✅ All data securely stored in Convex (encrypted, private to user)

### Phase 2 Success Criteria
9. ✅ Displays economic indicators dashboard
10. ✅ Tracks and scores prediction accuracy
11. ✅ Aggregates financial news from selected sources

---

## 16. Appendix: User Interview Summary

| Question | Answer |
|----------|--------|
| Primary goal | All: retirement readiness, spending, investments |
| Number of users | Single user |
| Retirement timeline | Under 5 years |
| Account types | 401k, Traditional IRA, Roth, Brokerage, Money Market, Bank accounts |
| Other assets | Social Security, Home equity |
| Debt | Other loans, Credit cards |
| Income sources | W-2, Self-employment, Dividends |
| Spending detail | Transaction-level |
| Key patterns | Trends over time |
| Investment features | Asset allocation, Rebalancing alerts |
| Projections | Monte Carlo, Inflation-adjusted, Guardrails |
| Scenarios | Market conditions, Major life events |
| Tax planning | Withdrawal sequencing |
| Research tracking | Economic indicators, Personal predictions, News *(Deferred)* |
| Research use | Passive monitoring *(Deferred)* |
| Database choice | Convex (cloud, real-time) |
| Usage frequency | Monthly deep-dive |
| Visual style | Dark mode |
| Data density | Balanced |
| Import flow | Guided wizard |
| Uncategorized handling | Best guess + flag |
| Export needs | CSV |
| Investment values | Auto-fetch prices |
| Alerts | Rebalancing, Milestones |
| Goals | Retirement countdown, Net worth milestones |
| Primary device | Desktop/laptop |
| Backup approach | Manual export |
| Additional features | Healthcare costs, Home value (Zillow) |
