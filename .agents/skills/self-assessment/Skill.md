---
name: self-assessment
description: Entry point for full self-assessment. Orchestrates personality profiling (personality-references), technical architecture review (technical-architecture-reference), UI architecture review (UI-architecture-analysis), and cross-references them into a combined growth report.
---

# Self Assessments

Orchestrates a complete self-assessment by running the sub-skills in sequence and producing a unified report. This is the entry point — use it when a user wants a full personality + project architecture analysis.

## How It Works

The assessment runs four phases:

```
Phase 1: Personality Profile   ← personality-refrences skill
Phase 2: Architecture Review   ← technical-architecture-reference skill
Phase 3: UI Review             ← UI-architecture-analysis skill
Phase 4: Cross-Reference       ← assesments skill (combines all)
```

## Usage

```yaml
# Run a full self-assessment:
skill: self-assesments
action: assess
user:
  mbti: <type>
  enneagram: <type> # optional
  wing: <w>         # optional
project_path: <path>
```

The assessment will:

1. **Analyze your personality** — determines MBTI cognitive stack, Enneagram core motivation, grip states, shadow functions, and dark side expression
2. **Derive strengths & weaknesses** — from dominant/auxiliary functions (strengths) and inferior/shadow functions (weaknesses)
3. **Review technical architecture** — routes, data flow, caching, queue strategy, code organization, module boundaries, scaling readiness at 100/1k/10k users
4. **Review UI architecture** — layout system, component architecture, state management, design system maturity, rendering strategy, accessibility
5. **Cross-reference findings** — maps personality patterns to architectural patterns to reveal blind spots, growth opportunities, and stress indicators
6. **Output a full report** — structured YAML with personality profile, architecture analysis, scaling projections, and a growth verdict

## Sub-Skills

| Skill | Location | Phase |
|-------|----------|-------|
| personality-references | `personality-refrences/Skill.md` | Personality profiling (5 lenses) |
| technical-architecture-reference | `Architicture-refrences/technical-architecture-reference/Skill.md` | Backend architecture analysis |
| UI-architecture-analysis | `Architicture-refrences/UI-architecture-analysis/Skill.md` | Frontend/UI architecture analysis |
| full-assessment | `Assesments/Skill.md` | Orchestrates + cross-references all phases |

## When to Use

- When a user wants a complete self-assessment combining who they are with what they build
- When onboarding a new team member to understand their natural strengths and blind spots
- When reviewing a project's architecture and wanting to understand why certain patterns exist
- When planning personal growth goals tied to concrete project improvements

## When Not to Use

- Do not use when only a personality profile is needed (use `personality-refrences` directly)
- Do not use when only a technical architecture review is needed (use `technical-architecture-reference` directly)
- Do not use when only a UI review is needed (use `UI-architecture-analysis` directly)
- Do not use the personality analysis for clinical or hiring decisions
