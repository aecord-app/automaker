# CLAUDE.md - AECORD Team AutoMaker Customization

## Project Overview

Customize AutoMaker for AECORD's multi-developer team. AECORD is a B2B construction marketplace migrating from WordPress to microservices (Node.js, React, PostgreSQL, Prisma).

**Goal:** Enable 6+ developers to work in parallel with AI-assisted coding without code conflicts or wasted AI executions.

---

## Core Features to Implement

### 1. JWT Authentication with Role-Based Access

```
Roles: admin | backend-dev | frontend-dev | devops
- Admin sees all tasks, can approve/reject
- Developers see only their assigned tasks + service area
- Shared Claude API auth (one Anthropic account)
```

Create: `auth.ts`, `user-service.ts`, `auth-routes.ts`, `auth-store.ts`, `data/users.json`

### 2. Task Classification

```typescript
type: 'feature' | 'bug' | 'enhancement' | 'issue';
priority: 'critical' | 'high' | 'medium' | 'low';
approvalStatus: 'pending' | 'approved' | 'rejected';
```

Each type → different agent + planning mode:

- `feature` → Backend/Frontend Specialist, spec planning, manual review
- `bug` → Debug Specialist (haiku-4.5), lite planning, auto-verify if tests pass
- `enhancement` → Optimization Specialist, lite planning, manual review
- `issue` → Triage Specialist, skip planning, auto-verify if low-risk

### 3. Kanban with Approval Gate

Columns: `Backlog → Pending Approval → Approved → In Progress → Waiting Review → Verified → Done`

Rules:

- Only admin moves: Pending Approval → Approved
- Approved tasks auto-start when assigned user triggers
- Generate execution plan before start (admin reviews)

### 4. Agent Profiles (add to settings.json)

```json
{
  "Backend Specialist": { "model": "sonnet-4.5", "planningMode": "spec" },
  "Frontend Specialist": { "model": "sonnet-4.5", "planningMode": "spec" },
  "Debug Specialist": { "model": "haiku-4.5", "planningMode": "lite" },
  "DevOps Specialist": { "model": "sonnet-4.5", "planningMode": "spec" }
}
```

System prompts should reference AECORD conventions: `aecord_` table prefix, UUID keys, Prisma, shadcn/ui.

### 5. Git Workflow

```
Branch: {type}/{service}/{task-id}-{slug}
Base: develop (not main)
Isolation: git worktree per task
```

Pre-execution: sync develop, create worktree, baseline tests
Post-execution: lint, test, diff against develop

File locking: Track which files each task modifies. Queue conflicting tasks.

### 6. Execution Plan

Before any AI execution, generate:

- Phases with estimated tokens/files
- Risk assessment (high/medium/low)
- Acceptance criteria
- Estimated cost

Admin approves plan before execution starts.

---

## API Endpoints

```
POST /api/auth/login
GET  /api/users/me
GET  /api/approvals/pending (admin)
POST /api/approvals/:id/approve (admin)
POST /api/tasks/:id/plan
GET  /api/conflicts/check
```

---

## File Structure

```
apps/server/
├── middleware/auth.ts
├── services/
│   ├── user-service.ts
│   ├── approval-service.ts
│   ├── conflict-service.ts
│   └── plan-service.ts
└── routes/
    ├── auth-routes.ts
    └── approval-routes.ts

apps/ui/
├── components/
│   ├── ApprovalQueue.tsx
│   └── PlanReview.tsx
└── stores/auth-store.ts

data/
├── users.json
├── file-locks.json
└── execution-plans.json
```

---

## How to Run

### Server only

```bash
cd apps/server && npm run dev    # Starts on port 3008
```

### Electron (desktop app) — RECOMMENDED

```bash
# Starts Vite dev server + Electron together (hot reload works)
cd apps/ui && npm run dev:electron
```

> **DO NOT** run `npx electron .` directly — it loads static build and shows a black screen.

### Full stack (interactive launcher)

```bash
# From repo root — presents interactive menu (Web / Electron / Docker)
npm run dev
```

### Data directories — CRITICAL

There are TWO separate data directories. They are NOT the same:

- **Electron app** reads from: `aecord-automaker/data/` (root)
- **Standalone server** (`npm run dev` in `apps/server/`) reads from: `apps/server/data/`
- **Both must be kept in sync** when editing files manually (users.json, team-projects.json, etc.)

Key data files:

- `users.json` — user accounts and password hashes
- `team-projects.json` — team project configuration
- `role-permissions.json` — role-based feature permissions
- `.api-key` — API key for web mode auth (regenerated each server start)

### Current credentials

- admin: `Z@qzse321!@#`
- sujith: `Admin123#`

---

## Constraints

- Do NOT modify `libs/` core agent logic
- Follow AutoMaker patterns (services, routes, Zustand stores)
- All changes must pass existing tests
- Keep UI responsive (<100ms interactions)
- Do NOT add "Co-Authored-By" lines to git commit messages

---

## Implementation Priority

1. Auth + roles
2. Task classification schema
3. Kanban approval column
4. Agent profiles
5. Plan generation
6. Git worktree isolation
7. Conflict detection
