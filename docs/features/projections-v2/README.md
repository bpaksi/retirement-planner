# Projections v2

A refined approach to Monte Carlo retirement projections with "Recovery-First Guardrails."

## Status: 💬 Discussion / Conceptual

## Documents

- [DISCUSSION.md](./DISCUSSION.md) - Full exploration of the mental model

## Key Concepts

### Monte Carlo Basics
- 1000+ simulations with random returns
- Returns from normal distribution (e.g., 7% mean, 15% std dev)
- Each simulation: apply returns, subtract spending, check if money lasts
- Success rate = % of simulations that don't run out

### Dynamic Spending Model
Spending = Non-Discretionary (essentials) + Discretionary (buffer)

- **Liabilities auto-reduce over time**: Mortgage paid off = lower base spending
- **Goals add to specific years**: One-time, recurring, or N-year goals
- **Guardrail floor = essentials**: Can never cut below non-discretionary

### Three-Tier Success Categories
| Outcome | Definition |
|---------|------------|
| **Full Success** | Never had to cut spending |
| **Soft Success** | Cut discretionary, but never essentials |
| **Hard Failure** | Couldn't afford essentials |

### Max Withdrawal Solver
Binary search algorithm to find maximum withdrawal for:
- **100% Full Success**: Max where you never cut spending
- **100% Combined Success**: Max where you never run out
- **Custom %**: Max at user-specified success rate (e.g., 85%)

Shows warning + gap when essential spending exceeds max sustainable.

### Recovery-First Guardrails (Your Innovation)

Unlike simple guardrails that symmetrically cut/increase spending:

```
Standard Guardrails:
  Below floor → Cut 10%
  Above ceiling → Increase 10%

Recovery-First Guardrails:
  Below floor → Cut proportionally (deeper shortfall = bigger cut)
  Above ceiling AFTER lean years → BANK IT (don't increase yet)
  Above ceiling AND healthy → Increase (capped)
```

**Key insight**: After bad years, rebuild the cushion before increasing lifestyle.

### Baseline Definition

Compare portfolio to **expected path**, not starting value:

```
Expected = Starting × (1 + return)^years - cumulative_withdrawals
```

This accounts for planned drawdown and avoids false alarms.

## Comparison to v1

| Aspect | v1 (Original) | v2 (This Discussion) |
|--------|---------------|----------------------|
| Guardrail symmetry | Symmetric (cut = increase) | Asymmetric (recovery-first) |
| Spending cuts | Fixed percentage | Proportional to shortfall |
| Spending increases | Immediate when ceiling hit | Only after recovery complete |
| Baseline | Starting balance | Expected path with planned decline |
| Essential floor | Mentioned | Explicit hard minimum |

## Next Steps

1. Update algorithm in `TASKS.md` to reflect v2 model
2. Decide on open questions (recovery buffer, inflation variability)
3. Implement and test
