---
name: project-reference
description: Central index skill for locating project files, documentation, and routing requests to the right project-specific skills.
---

# Project Reference

Use this skill to locate files, documentation, and relevant skills within this repository. Acts as the project-level router: if a user asks "where is X" or "how is Y implemented", return exact paths and recommended next steps or delegate to a more specific skill.

## Start Here
- When the user asks for code locations, docs, or project-specific references.
- When onboarding new contributors who need a guide to the repository layout.

## Capabilities
- Map conceptual queries to files and skills. Examples:
  - "Where is the JWT validation code?" → `lib/jwt-validate.ts`
  - "How are API routes organized?" → `app/api/*`
  - "Where's the Convex schema?" → `convex/schema.ts` and `.agents/skills/convex/` guidance
  - "Where is authentication configured?" → `lib/auth.ts`, `convex/auth.config.ts`, `.agents/skills/convex-setup-auth/`
- Suggest best next skill to run (e.g., `assessment`, `convex-performance-audit`, `neon-postgres`).

## Local Index (useful paths)
- documentations/README.md
- documentations/documentations/01-ARCHITECTURE.md
- documentations/guides/01-JWT_SETUP.md
- lib/jwt-validate.ts
- lib/auth.ts
- convex/schema.ts
- app/api/
- models/games/mongodb/
- .agents/skills/

## Usage
```yaml
skill: project-reference
action: locate
query: "jwt validation"
repoPath: "."
```

## Outputs
- filePaths: list of relevant file paths
- delegateSkill: recommended skill name (optional)
- short rationale

## When Not to Use
- For external dependency lookups (use `references` skill)
- For deep code changes — delegate to an implementation skill or open a PR

## Implementation Notes
- Prefer exact paths over loose descriptions.
- When in doubt, return multiple candidate paths and recommend the most likely one.
