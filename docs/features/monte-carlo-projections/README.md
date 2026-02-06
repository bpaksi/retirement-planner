# Monte Carlo Projections with Guardrails

Retirement success prediction that answers: **"What's the maximum I can withdraw on day 1 of retirement?"**

## Status: 🚧 Planning Complete, Ready to Build

## Documents

- [FEATURE-SPEC.md](./FEATURE-SPEC.md) - Full feature specification
  - Goal Set model
  - Monte Carlo + Guardrails algorithm
  - Success curve visualization
  - Max withdrawal solver

- [TASKS.md](./TASKS.md) - Implementation tasks (v2, revised)
  - Phase 0: Validation (performance + correctness)
  - Phase 1: Data foundation
  - Phase 2: Core engine
  - Phase 3: Visualization & UX
  - Phase 4: Polish

## Key Concepts

### Success Definition
- Money lasts until end of time horizon
- User targets **70% success** (not industry-standard 90-95%)
- Rationale: Higher success = dying with too much money

### Guardrails Strategy
- **Ceiling**: If portfolio > 125% of target → increase spending 10%
- **Floor**: If portfolio < 75% of target → decrease spending 10%
- **Essential Floor**: Never go below minimum living expenses

### Core Deliverables
1. **Success Curve** - Visualization of withdrawal vs success rate
2. **Max Withdrawal Solver** - Binary search for optimal withdrawal
3. **What-If Calculator** - Test different assumptions
4. **Failure Analysis** - Show what 30% failure looks like
5. **Sensitivity Analysis** - Which inputs matter most

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 0: Validation | 4-7 hrs |
| Phase 1: Data Foundation | 9-12 hrs |
| Phase 2: Core Engine | 11-16 hrs |
| Phase 3: Visualization | 13-17 hrs |
| Phase 4: Polish | 5 hrs |
| **Total** | **42-57 hrs** |
