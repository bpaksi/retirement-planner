# Architecture Documentation

Technical design and system architecture for the Retirement Planner app.

## Contents

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Complete technical architecture including:
  - System architecture diagram
  - Convex database schema (15 tables)
  - Convex function structure
  - Frontend component hierarchy
  - State management (Zustand)
  - CSV parsing architecture
  - Key algorithms
  - External API integrations
  - Security considerations

## Feature Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER'S QUESTION                                 │
│        "Can I retire? What's the most I can withdraw?"                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: DATA IMPORT                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Transaction │  │ Investment  │  │ Liabilities │  │  Accounts   │    │
│  │   Import    │  │  Holdings   │  │             │  │             │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          ▼                │                │                │
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: SPENDING ANALYSIS                                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Spending Baseline Calculator                                      │  │
│  │ • Recurring detection (subscriptions, bills)                      │  │
│  │ • Vampire account alerts                                          │  │
│  │ • 12-month average for variable spending                          │  │
│  │ • Annual expenses spread across months                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              ▼                                          │
│                    "Your baseline: $5,500/mo"                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: ESSENTIAL vs DISCRETIONARY                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ User marks each recurring item as essential or cuttable           │  │
│  │ • Essential (floor): $2,500/mo - mortgage, utilities, insurance   │  │
│  │ • Discretionary: $3,000/mo - dining, entertainment, travel        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────────────┐
│  LAYER 4: PROJECTIONS       │   │  LAYER 4: SOLVER                    │
│  ┌─────────────────────┐    │   │  ┌─────────────────────────────┐    │
│  │ Monte Carlo         │    │   │  │ Max Withdrawal Calculator   │    │
│  │ + Guardrails        │    │   │  │ • 100% full success         │    │
│  │                     │    │   │  │ • 100% combined success     │    │
│  │ "85% success rate"  │    │   │  │ • Custom % target           │    │
│  └─────────────────────┘    │   │  └─────────────────────────────┘    │
└─────────────────────────────┘   └─────────────────────────────────────┘
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | Convex | Real-time, serverless, TypeScript-first |
| State | Zustand | Lightweight, works with local storage |
| Charts | Recharts | Easy React integration |
| Styling | Tailwind (dark mode) | Rapid development |
