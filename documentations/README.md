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
  - JWT Validation Flow
  - Middleware Integration
  - Token Payload Structure
  - Protected Routes List
  - Clerk Integration Details
  - Multi-Template Support
  - Error Response Examples
  - Testing Authentication
  - Troubleshooting Guide

- **03-DATA_FLOW.md** - Complete request/response flows
- **04-UI_DESIGN_SYSTEM.md** - Dark fantasy design system, tokens, styling architecture
  - Design Tokens (abyss/ember palette, typography, effects)
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
  - JWT validation implementation
  - Making authenticated requests from frontend
  - Testing JWT implementation
  - Switching between auth templates
  - Token payload usage
  - Custom claims handling
  - Token refresh strategies
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
Security vulnerabilities and known issues.

- **01-SECURITY_VULNERABILITIES.md** - Security assessment
  - Critical Issues (JWT secret exposure, token validation, rate limiting)
  - High Priority Issues (Input validation, cache poisoning, size limits, CORS, privilege escalation)
  - Medium Priority Issues (Error disclosure, audit logging)
  - Low Priority Issues (HTTPS enforcement, security headers, API versioning)
  - Risk Summary Matrix
  - Action Items (Immediate, Short Term, Long Term)

- **02-KNOWN_ISSUES.md** - Performance and data integrity issues
  - Performance Issues (N+1 queries, cache stampede, memory exhaustion, slow queries)
  - Data Consistency Issues (Dual database sync, cache divergence)
  - Concurrency Issues (Race conditions, worker crashes)
  - Data Integrity Issues (Orphaned records, null references)
  - Monitoring & Observability Issues
  - Deployment Issues
  - Scalability Issues
  - Recommended Fixes Priority Matrix

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

- **JWT_IMPLEMENTATION_SUMMARY.md** - Quick summary of JWT changes
- **JWT_VALIDATION_GUIDE.md** - Detailed JWT validation documentation
- **PLAN.md** - Development plan
- **architicture/architecture.md** - Architecture overview
- **CLAUDE.md** - Agent instructions with anchored project summary
- **.agents/skills/project-reference/Skill.md** - Project reference index (this file)

---

## Last Updated

Created: 2026-05-30
Last Review: 2026-06-04

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
