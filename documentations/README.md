# Documentation Index

## Overview

This folder contains comprehensive documentation for the Deepslate Dungeons RPG project, organized into three sections:

### 📋 Documentations/
How everything is connected and works together.

- **01-ARCHITECTURE.md** - System architecture, data flow diagrams, and component relationships
  - System Architecture Diagram
  - Component Overview (Frontend, Auth, API, Cache, Database layers)
  - Data Flow Patterns (Game Creation, Retrieval, Image Upload)
  - Connection Matrix between components
  - Database Schema and Relationships
  - Caching Strategy
  - Performance Characteristics
  - Scalability Considerations

- **02-AUTHENTICATION.md** - JWT validation and Clerk integration
  - JWT Validation Flow (Clerk `auth()` + `validateJWTMiddleware(request)`)
  - Middleware Integration
  - Token Payload Structure
  - Protected Routes List
  - Clerk Integration Details
  - Convex `requireAuth()`/`requireStaff()` RBAC
  - Error Response Examples (`tryApiRoute` + `classifyError`)
  - Testing Authentication
  - Troubleshooting Guide

- **03-DATA_FLOW.md** - Complete request/response flows
- **04-UI_DESIGN_SYSTEM.md** - Dark fantasy design system, tokens, styling architecture
  - Design Tokens (Stone/Slate + Torchlight palette, typography, effects)
  - CSS Modules + cn() hybrid pattern
  - Component architecture (cards grid, sidebar, primitives)
  - Gradient usage patterns and file locations
  - Game Lifecycle
  - API Request/Response Flows
  - Inter-Service Communication
  - Error Flow Handling
  - State Transitions

---

### 📚 Guides/
Step-by-step implementation guides and how-to documentation.

- **01-JWT_SETUP.md** - Setting up JWT validation
  - Step-by-step setup guide
  - Environment variable configuration
  - JWT validation implementation (`validateJWTMiddleware`)
  - Making authenticated requests from frontend
  - Testing JWT implementation
  - Token payload usage
  - Custom claims handling
  - Monitoring and debugging

- **02-API_IMPLEMENTATION.md** - Creating and maintaining API routes
  - Route structure template
  - Creating new routes (GET, POST, with parameters)
  - Response format standards
  - Caching implementation
  - Idempotency implementation
  - Error handling patterns
  - Database operation safety
  - Logging and monitoring
  - Security best practices
  - Testing API routes

---

### 🔒 Problems/
Security vulnerabilities, performance, and architecture/code-quality known issues (10 reports, `01`–`10`). Status fields reflect the current codebase (2026-08-17) and are refreshed periodically.

- **01-SECURITY_VULNERABILITIES.md** - Security assessment (critical/high/medium/low matrix, risk summary, action items)
- **02-KNOWN_ISSUES.md** - Performance + data-integrity issues (N+1, cache stampede, dual-DB sync, race conditions)
- **03-SECURITY_AUTH_ISSUES.md** - Auth-layer security gaps
- **04-PERFORMANCE_SCALABILITY_ISSUES.md** - Scalability limits + benchmarks
- **05-UI_UX_DESIGN_ISSUES.md** - UI/UX gaps
- **06-DATA_LAYER_DATABASE_ISSUES.md** - Data-layer/DB issues
- **07-ARCHITECTURE_CODE_QUALITY_ISSUES.md** - Architecture + code-quality issues
- **08-INFRASTRUCTURE_DEPLOYMENT_ISSUES.md** - Infra/deployment issues
- **09-MONITORING_OBSERVABILITY_ISSUES.md** - Monitoring/observability gaps
- **10-DEVELOPER_EXPERIENCE_DOCS_ISSUES.md** - DX + docs issues

---

## Quick Navigation

### "How does X work?"
→ Look in **Documentations/** folder

Example:
- "How does caching work?" → 01-ARCHITECTURE.md (Caching Strategy section)
- "How do users authenticate?" → 02-AUTHENTICATION.md
- "What happens when I create a game?" → 03-DATA_FLOW.md (Game Creation Flow)
- "How is the UI styled?" → 04-UI_DESIGN_SYSTEM.md
- "What gradients are available?" → 04-UI_DESIGN_SYSTEM.md (Gradient Usage Patterns)
- "Where are error pages?" → 04-UI_DESIGN_SYSTEM.md (Error & Notification System)

### "How do I do X?"
→ Look in **Guides/** folder

Example:
- "How do I set up JWT?" → 01-JWT_SETUP.md
- "How do I create an API route?" → 02-API_IMPLEMENTATION.md
- "How do I handle errors?" → 02-API_IMPLEMENTATION.md (Error Handling section)
- "How do I use the hybrid CSS Modules + Tailwind pattern?" → 04-UI_DESIGN_SYSTEM.md (CSS Modules + cn() Pattern)
- "How do I add a new toast notification?" → 04-UI_DESIGN_SYSTEM.md (Toast System)
- "How do I create a new card component?" → 04-UI_DESIGN_SYSTEM.md (Cards Grid)

### "What could go wrong?"
→ Look in **Problems/** folder

Example:
- "What security issues exist?" → 01-SECURITY_VULNERABILITIES.md
- "What performance problems exist?" → 02-KNOWN_ISSUES.md
- "What are the risks?" → 01-SECURITY_VULNERABILITIES.md (Risk Summary)

---

## Key Concepts

### Architecture
```
Frontend (Next.js 16) 
  ↓ (HTTP REST + JWT)
API Routes (Express-like)
  ↓
Database Layer:
  ├─ PostgreSQL (Neon) - Primary data
  ├─ MongoDB - Extended data
  ├─ Redis - Cache + Queue
  └─ Convex - Real-time
```

### Authentication
```
JWT Token (from Clerk) 
  → Authorization header 
  → Validated by middleware 
  → Payload with userId
```

### Data Storage Strategy
```
PostgreSQL: Game metadata (name, likes, tags)
MongoDB: Game details (characters, maps, items)
Redis: Cache + job queue
Convex: Real-time subscriptions
```

### Request Flow
```
1. Client sends request with JWT
2. Middleware validates JWT
3. API checks cache (Redis)
4. If miss, query databases
5. Return response + backfill cache
6. Background worker processes queue
```

---

## Common Tasks

### Add a new API route
1. Read: 02-API_IMPLEMENTATION.md
2. Follow the Route Structure template
3. Test with: Testing API Routes section

### Fix a security vulnerability
1. Read: 01-SECURITY_VULNERABILITIES.md
2. Find the vulnerability section
3. Follow the Mitigation steps

### Debug a performance issue
1. Read: 02-KNOWN_ISSUES.md
2. Find the matching issue
3. Apply the Solution

### Setup authentication
1. Read: 01-JWT_SETUP.md
2. Follow steps 1-4
3. Test with steps 5-7

---

## File Locations in Project

```
documentations/
├── documentations/
│   ├── 01-ARCHITECTURE.md
│   ├── 02-AUTHENTICATION.md
│   ├── 03-DATA_FLOW.md
│   └── 04-UI_DESIGN_SYSTEM.md
├── guides/
│   ├── 01-JWT_SETUP.md
│   └── 02-API_IMPLEMENTATION.md
├── problems/
│   ├── 01-SECURITY_VULNERABILITIES.md
│   └── 02-KNOWN_ISSUES.md
├── features/
│   └── GamePage/
└── issues/
    └── (numbered issue reports)
```

---

## Related Files in Project Root

- **README.md** - Top-level project readme (fresh knowledge-graph metrics, architecture, data flow)
- **CLAUDE.md** - Agent instructions with anchored project summary
- **posthog-setup-report.md** - PostHog analytics setup report (legacy)
- **AiServerArchitecture.md** - AI server architecture notes (legacy)
- **LOOPS.md** - Development loop notes (legacy)
- **graphify-out/GRAPH_REPORT.md** - Auto-extracted knowledge graph (1,297 nodes / 2,238 edges / 108 communities, 2026-08-17)
- **.agents/skills/project-reference/Skill.md** - Project reference index (this file)

---

## Last Updated

Created: 2026-05-30
Last Review: 2026-08-17

---

## Contributing to Documentation

When adding new documentation:

1. **Documentations/** - Use for explaining how components/systems work together
2. **Guides/** - Use for step-by-step instructions on how to do something
3. **Problems/** - Use for listing issues, vulnerabilities, and fixes

Keep files focused and well-organized with:
- Clear headings (# ## ###)
- Code examples where relevant
- Cross-references to related sections
- Action items / TODOs
