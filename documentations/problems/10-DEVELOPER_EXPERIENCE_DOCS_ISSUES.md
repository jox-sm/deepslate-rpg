# Developer Experience & Documentation Issues

### Missing `AGENTS.md` at Project Root (Broken AI Agent Reference)
**Severity:** HIGH
**Category:** Config
**Location:** `CLAUDE.md:1`
**Description:** CLAUDE.md references `@AGENTS.md` on line 1 as a standard AI-agent include directive, but `AGENTS.md` does not exist at the project root. There is an `AGENTS.md` at `.agents/skills/AGENTS.md`, but the root-level reference resolves to a missing file. Any AI agent loading this project will fail to find the referenced instructions.
**Impact:** Blocks AI tooling from loading agent instructions; causes silent fallback or errors depending on the tool. New AI agents working on the project miss critical context.
**Suggested Fix:** Create `AGENTS.md` at the project root with the content from `.agents/skills/AGENTS.md`, or update `CLAUDE.md:1` to reference the correct path: `@.agents/skills/AGENTS.md`.

---

### Missing `.env.example` Blocks Onboarding
**Severity:** HIGH
**Category:** Onboarding
**Location:** `README.md:62`
**Description:** The README quick-start instructs `cp .env.example .env.local`, but no `.env.example` file exists in the project. Furthermore, the `.gitignore` uses the pattern `.env*` (line 14), which would ignore `.env.example` even if it were created, because the glob matches any file starting with `.env`.
**Impact:** New developers cannot set up the project without manually reverse-engineering required env vars from the README table (lines 430-456) or source code. This is the first action in the quick start — a blocking failure.
**Suggested Fix:** Create `.env.example` with documented placeholder values. Change `.gitignore` pattern from `.env*` to `/.env` and `/.env.local` to allow `.env.example` to be tracked in git.

---

### Zero Project-Level Tests & No Test Framework Config
**Severity:** HIGH
**Category:** Tooling
**Location:** `package.json:5-10` (scripts) / project root
**Description:** The project has no test configuration files (no `vitest.config.ts`, `jest.config.ts`), no test script in `package.json`, and zero test files outside `node_modules`. Despite having a `deploymentChecks` skill and Convex testing guidelines (referencing `convex-test` + `vitest`), no testing infrastructure has been set up. The `package.json` `scripts` block has only `dev`, `build`, `start`, and `lint` — no `test` entry.
**Impact:** No regression safety net. Each of the 45 documented issues lacks automated verification. Manual testing is the only option, which doesn't scale. New contributors have no confidence their changes don't break existing functionality.
**Suggested Fix:** Set up vitest + `convex-test` (as recommended by `convex/_generated/ai/guidelines.md:313`). Add `"test": "vitest"` to `package.json` scripts. Create test files for core utilities (`lib/retry.ts`, `lib/jwt-validate.ts`, `utilities/errorHandler.ts`). Add test infrastructure to CI.

---

### Broken Documentation Link to `architicture/architecture.md`
**Severity:** MEDIUM
**Category:** Documentation
**Location:** `README.md:523`
**Description:** The README's reference section links to `architicture/architecture.md` as an "Architecture overview" reference. However, the `architicture/` directory does not exist and the file does not exist. A glob search for `**/architicture/**` returns no results. This path is also listed in the `documentations/README.md:225` as a related file.
**Impact:** Developers clicking the link get a 404, eroding trust in the documentation. The architecture overview — a critical reference for onboarding — is unreachable.
**Suggested Fix:** Either create the file at the referenced path with actual architecture documentation, or remove/update the link in both `README.md:523` and `documentations/README.md:225` to point to the existing `documentations/documentations/01-ARCHITECTURE.md`.

---

### AGENTS.md Skills Inventory Omits 8+ Installed Skills
**Severity:** MEDIUM
**Category:** Documentation
**Location:** `.agents/skills/AGENTS.md:25-34`
**Description:** The AGENTS.md skills inventory lists 9 skills but is missing at least 8 skills that exist in the `.agents/skills/` directory: `project-reference`, `references`, `documentation`, `self-assessment`, `ui-design`, `ui-ux-pro-max`, `web-design-guidelines`, and `deploymentChecks`. AI agents use this list to discover available capabilities — missing entries means agents won't know to load these skills.
**Impact:** Reduced AI agent effectiveness. Skills like `self-assessment` (full project audit), `documentation` (technical writing), and `deploymentChecks` (pre-deploy verification) will never be invoked automatically because the agent doesn't know they exist.
**Suggested Fix:** Update the skills inventory list in `.agents/skills/AGENTS.md:25-34` to include all installed skills. Consider auto-generating this list from the directory structure.

---

### Duplicate/Conflicting `assessment` vs `assesment` Skill Directories
**Severity:** LOW
**Category:** Config
**Location:** `.agents/skills/self-assessment/assesment/Skill.md` and `.agents/skills/assessment/Skill.md`
**Description:** There are two typos affecting personality assessment skills: (1) A deprecated `assessment` skill at `.agents/skills/assessment/Skill.md` that delegates to `self-assessment`, but the directory is misspelled ("assessment" instead of "assessment" — actually it's spelled correctly) — wait, the real issue is `.agents/skills/self-assessment/assesment/` has a typo (`assesment` missing an `s`). Combined with the deprecated `assessment` alias, there are now 3 paths related to assessment: `self-assessment`, `self-assessment/assesment` (typo), and `assessment` (deprecated). This is confusing for both humans and agent routing.
**Impact:** Agent skill routing may match the wrong skill or fall through entirely. Developers looking for assessment-related skills find multiple entries with unclear distinction.
**Suggested Fix:** Remove the typo directory `self-assessment/assesment/`. Keep only `self-assessment/` (canonical) and `assessment/` (deprecated alias that delegates). Update the `self-assessment` skill's entry points accordingly.

---

### Root-Level `.env` and `.env.local` Files Present On Disk (Leak Risk)
**Severity:** MEDIUM
**Category:** Process
**Location:** Project root
**Description:** `.env` and `.env.local` files exist on disk at the project root. While `.gitignore` uses `.env*` to prevent accidental commits, the files are plainly visible to anyone with filesystem access. The `.gitignore` pattern `.env*` is overly broad — it would also silently exclude `.env.example`, `.env.production`, etc. from ever being tracked.
**Impact:** Risk of secret leakage through screenshots, backups, or tooling that reads files outside git. The overly broad `.gitignore` pattern prevents legitimate env template files from being committed.
**Suggested Fix:** Replace `.env*` in `.gitignore` with specific entries: `/.env`, `/.env.local`, `/.env.production`, etc. Create a committed `.env.example` (see finding #2). Consider using a `.env-template` or `.env.sample` approach if the broad ignore pattern is intentional for other reasons.

---

### GamePage Feature Documentation Has 5+ Duplicate Entry Points
**Severity:** LOW
**Category:** Documentation
**Location:** `documentations/features/GamePage/`
**Description:** The GamePage feature has 5 documentation files at the root AND inside `documentations/features/GamePage/`: `GamePage.md`, `GamePage_Integration_Guide.md`, `GamePage_Progress.md`, `GAMEPAGE_QUICKSTART.md`, `GAMEPAGE_README.md`, `GAMEPAGE_SUMMARY.md` — plus root-level `GamePage_Integration_Guide.md`, `GamePage_Progress.md`, `GAMEPAGE_QUICKSTART.md`, `GAMEPAGE_README.md`, `GAMEPAGE_SUMMARY.md`. This is 6+ files in the feature directory and 5 more at the project root, creating massive fragmentation and confusion about which is the authoritative source.
**Impact:** Developers waste time figuring out which doc to read. Information is duplicated and may diverge. New team members get inconsistent onboarding depending on which file they open first.
**Suggested Fix:** Consolidate GamePage documentation into a single authoritative file (keep `GamePage.md`). Remove or archive duplicate files. Ensure the project root doesn't have scattered GamePage docs — everything should live under `documentations/features/GamePage/`.

---

### No Type Check Script in package.json
**Severity:** MEDIUM
**Category:** Tooling
**Location:** `package.json:5-10`
**Description:** The `package.json` scripts block has `dev`, `build`, `start`, and `lint` but no `typecheck` script. There is no way for developers to run TypeScript type-checking alone without triggering a full build (`next build` also bundles). The `tsconfig.json` likely has `strict: true`, but there's no fast feedback loop for type errors.
**Impact:** Developers only discover type errors during build or in their editor. CI pipelines can't do a quick type-check pass. Missed type errors leak into commits.
**Suggested Fix:** Add `"typecheck": "tsc --noEmit"` to `package.json` scripts. Add to CLAUDE.md as a required pre-commit step. Consider adding to CI before the full build step.
