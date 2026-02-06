# Documentation Index

## Structure

```
docs/
├── architecture/          # System architecture & technical design
│   └── ARCHITECTURE.md    # Database schema, components, data flow
│
├── planning/              # Requirements & research
│   ├── REQUIREMENTS.md    # Full requirements specification
│   └── PLANNING.md        # Competitor research & initial planning
│
└── features/              # Feature-specific documentation
    └── monte-carlo-projections/
        ├── FEATURE-SPEC.md    # Feature specification
        └── TASKS.md           # Implementation tasks (v2)
```

## Quick Links

### Getting Started
- [CLAUDE.md](../CLAUDE.md) - Project context for Claude Code (root)
- [README.md](../README.md) - Project overview (root)

### Planning & Requirements
- [Requirements](./planning/REQUIREMENTS.md) - What to build
- [Planning Notes](./planning/PLANNING.md) - Research & competitor analysis

### Architecture
- [Architecture](./architecture/ARCHITECTURE.md) - How it's built (schema, components)

### Features

| Feature | Status | Docs |
|---------|--------|------|
| Monte Carlo Projections | 🚧 In Progress | [Spec](./features/monte-carlo-projections/FEATURE-SPEC.md) · [Tasks](./features/monte-carlo-projections/TASKS.md) |
| Transaction Import | ✅ Done | — |
| Spending Analysis | ✅ Done | — |
| Investment Holdings | ✅ Done | — |
| Liabilities | ✅ Done | — |

## Adding New Features

When adding a new feature:

1. Create folder: `docs/features/{feature-name}/`
2. Add `FEATURE-SPEC.md` with requirements from interview
3. Add `TASKS.md` with implementation breakdown
4. Update this index
