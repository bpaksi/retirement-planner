# Feature Documentation

Each feature has its own folder with specification and implementation tasks.

## The Feature Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  1. SPENDING BASELINE                    ← FOUNDATION       │
│     "What do I actually spend?"                             │
│     Answers: Your baseline is $5,500/mo                     │
│                                                             │
│  2. ESSENTIAL vs DISCRETIONARY           ← FLEXIBILITY      │
│     "What MUST I spend vs COULD cut?"                       │
│     Answers: $2,500 essential + $3,000 discretionary        │
│                                                             │
│  3. PREPAREDNESS SCORE                   ← THE HEADLINE     │
│     "How ready am I?" (synthesizes everything)              │
│     Answers: Score of 78/100 - "Well Prepared"              │
│     Factors: Tax-equivalent portfolio + income sources      │
│                                                             │
│  4. MONTE CARLO + SOLVER                 ← THE DETAILS      │
│     "Show me the math"                                      │
│     Answers: 85% success, max withdrawal $67k/yr            │
└─────────────────────────────────────────────────────────────┘
```

## Feature Index

### Foundation Layer (Data In)

| Feature | Status | Description |
|---------|--------|-------------|
| Transaction Import | ✅ Complete | CSV import from banks |
| Spending Analysis | ✅ Complete | Monthly spending tracking and trends |
| Investment Holdings | ✅ Complete | Portfolio tracking with prices |
| Liabilities | ✅ Complete | Debt tracking |

### Analysis Layer (Insights)

| Feature | Status | Description |
|---------|--------|-------------|
| [Spending Baseline](./spending-baseline/) | 🚧 Planning | Recurring detection, vampire alerts, baseline calculation |
| [Preparedness Score](./preparedness-score/) | 🚧 Planning | Single 0-100 score synthesizing portfolio, taxes, income, spending |

### Projection Layer (Validation)

| Feature | Status | Description |
|---------|--------|-------------|
| [Projections v2](./projections-v2/) | 🚧 Planning | Monte Carlo + Recovery-First Guardrails + Solver |
| [Monte Carlo (v1 spec)](./monte-carlo-projections/) | 📄 Reference | Original spec, superseded by Projections v2 |

## Planned Features (Phase 2+)

| Feature | Priority | Notes |
|---------|----------|-------|
| Market Research Hub | P2 | Economic indicators, predictions journal |
| Tax Optimization | P2 | Withdrawal sequencing, Roth conversions |
| Mobile Support | P3 | Responsive design |
| Plaid Integration | P3 | Automated bank sync |

## Feature Folder Structure

Each feature folder should contain:

```
feature-name/
├── FEATURE-SPEC.md    # Requirements and design
├── TASKS.md           # Implementation breakdown
└── README.md          # Quick overview (optional)
```
