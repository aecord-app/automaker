# AECORD Multi-Developer AutoMaker Setup

## Project Context

You're customizing [AutoMaker](https://github.com/AutoMaker-Org/automaker) for AECORD—a B2B construction industry marketplace migrating from WordPress to microservices (Node.js, React, PostgreSQL, Prisma). The team needs a coordinated AI-assisted development environment where multiple developers work in parallel without conflicts.

**Key Constraints:**

- All developers share one Claude/Anthropic account
- Code must remain protected (no full codebase sharing)
- Tasks flow through admin approval before AI execution
- Zero git merge conflicts from parallel development

---

## Implementation Requirements

### 1. User Authentication & Roles

Create JWT-based auth with 4 roles:

```typescript
type Role = 'admin' | 'backend-dev' | 'frontend-dev' | 'devops';

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  assignedServices: string[]; // e.g., ['auth-service', 'payment-service']
}
```

**Role Permissions:**
| Role | View Tasks | Create Tasks | Approve Tasks | Execute Tasks |
|------|-----------|--------------|---------------|---------------|
| admin | All | Yes | Yes | Yes |
| backend-dev | Own + backend | Yes | No | Own only |
| frontend-dev | Own + frontend | Yes | No | Own only |
| devops | Own + infra | Yes | No | Own only |

**Files to create:**

- `apps/server/middleware/auth.ts` - JWT validation
- `apps/server/services/user-service.ts` - User CRUD
- `apps/server/routes/auth-routes.ts` - Login/logout endpoints
- `apps/ui/stores/auth-store.ts` - Session state
- `data/users.json` - User storage

---

### 2. Task Classification System

Extend the Feature interface with classification:

```typescript
interface AecordTask extends Feature {
  type: 'feature' | 'bug' | 'enhancement' | 'issue';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTo: string;
  createdBy: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalNotes?: string;
  riskLevel: 'high' | 'medium' | 'low'; // auto-calculated
  targetService: string; // e.g., 'auth-service', 'payment-service'
}
```

**Auto-assign workflow by type:**

| Type        | Agent Profile               | Planning Mode | Auto-Verify         |
| ----------- | --------------------------- | ------------- | ------------------- |
| feature     | Backend/Frontend Specialist | spec          | No - manual review  |
| bug         | Debug Specialist            | lite          | Yes - if tests pass |
| enhancement | Optimization Specialist     | lite          | No - manual review  |
| issue       | Triage Specialist           | skip          | Yes - if low-risk   |

---

### 3. Kanban Workflow with Approval Gate

**Columns (in order):**

```
Backlog → Pending Approval → Approved → In Progress → Waiting Review → Verified → Done
```

**Rules:**

- Tasks created → auto-move to "Pending Approval"
- Only `admin` can move tasks: Pending Approval → Approved
- "Approved" tasks can be started by assigned user
- Developers see only their assigned tasks + tasks in their service area
- Admin sees all tasks across all services

**Files to modify:**

- `apps/ui/components/board/KanbanBoard.tsx` - Add approval column, role filtering
- `apps/server/services/approval-service.ts` - Approval logic
- `apps/server/routes/approval-routes.ts` - Approval endpoints

---

### 4. Specialized Agent Profiles

Add to `data/settings.json`:

```typescript
const AECORD_AGENTS = {
  'Backend Specialist': {
    model: 'sonnet-4.5',
    systemPrompt: `Expert in PostgreSQL, Prisma, Fastify/Hono. Follow AECORD conventions:
- Table prefix: aecord_
- UUID primary keys
- snake_case columns
- Include migration files
- Add comprehensive tests`,
    thinkingMode: 'medium',
    planningMode: 'spec',
  },
  'Frontend Specialist': {
    model: 'sonnet-4.5',
    systemPrompt: `Expert in React 18, TypeScript, Tailwind CSS. Follow AECORD patterns:
- Functional components with hooks
- Zustand for state management
- Responsive design (mobile-first)
- shadcn/ui components`,
    thinkingMode: 'medium',
    planningMode: 'spec',
  },
  'Debug Specialist': {
    model: 'haiku-4.5',
    systemPrompt: `Focus on root cause analysis. Approach:
1. Reproduce the issue
2. Identify minimal fix
3. Add regression test
4. Verify fix doesn't break related features`,
    thinkingMode: 'medium',
    planningMode: 'lite',
  },
  'DevOps Specialist': {
    model: 'sonnet-4.5',
    systemPrompt: `Expert in Docker, GitHub Actions, Railway, Cloudflare. Focus:
- Infrastructure as code
- Zero-downtime deployments
- Security best practices
- Cost optimization`,
    thinkingMode: 'medium',
    planningMode: 'spec',
  },
};
```

**Auto-assignment logic:**

```typescript
function assignAgent(task: AecordTask): string {
  if (task.type === 'bug') return 'Debug Specialist';
  if (task.type === 'enhancement') return 'Optimization Specialist';
  if (task.targetService.includes('infra') || task.type === 'issue') return 'DevOps Specialist';
  if (['api', 'service', 'database'].some((s) => task.targetService.includes(s)))
    return 'Backend Specialist';
  return 'Frontend Specialist';
}
```

---

### 5. Conflict-Free Git Workflow

**Branch Strategy:**

```
main (protected)
  └── develop (integration branch)
        ├── feature/auth-service/T-001-jwt-refresh
        ├── bug/payment-service/T-002-razorpay-timeout
        └── enhancement/frontend/T-003-dashboard-perf
```

**Naming Convention:** `{type}/{service}/{task-id}-{slug}`

**Worktree Isolation:**

```typescript
const GIT_WORKFLOW = {
  baseBranch: 'develop',

  preExecution: [
    'git fetch origin develop',
    'git worktree add -b {branch} .worktrees/{task-id} develop',
    'npm install',
    'npm run test -- --passWithNoTests', // baseline
  ],

  postExecution: [
    'npm run lint:fix',
    'npm run test',
    'git diff develop --stat', // show changes
  ],

  mergeRules: {
    bug: 'auto-merge if tests pass AND risk=low',
    issue: 'auto-merge if tests pass AND risk=low',
    feature: 'PR required - never auto-merge',
    enhancement: 'PR required - never auto-merge',
  },
};
```

**File Locking (Conflict Prevention):**

```typescript
interface FileLock {
  path: string;
  taskId: string;
  userId: string;
  lockedAt: Date;
}

// Before execution, check:
// 1. Which files will this task likely modify?
// 2. Are any locked by another running task?
// 3. If conflict → queue task, notify user
```

**Files to create:**

- `apps/server/services/conflict-service.ts` - Lock management
- `data/file-locks.json` - Active locks storage

---

### 6. Execution Plan Generation

Before Claude executes any approved task, generate a plan for admin review:

```typescript
interface ExecutionPlan {
  taskId: string;
  agent: string;

  phases: Array<{
    name: string;
    description: string;
    estimatedTokens: number;
    filesToModify: string[];
    filesToCreate: string[];
    testsToRun: string[];
  }>;

  acceptanceCriteria: string[];

  riskAssessment: {
    level: 'high' | 'medium' | 'low';
    factors: string[];
    mitigations: string[];
  };

  estimatedCost: number; // USD
  estimatedDuration: number; // minutes
}
```

**Risk Calculation:**

- High: Modifies >10 files, touches auth/payment, no existing tests
- Medium: Modifies 5-10 files, adds new dependencies
- Low: Modifies <5 files, has test coverage, isolated changes

**Files to create:**

- `apps/server/services/plan-service.ts` - Plan generation
- `apps/ui/components/PlanReview.tsx` - Plan approval UI
- `data/execution-plans.json` - Plan storage

---

### 7. API Endpoints Summary

```typescript
// Auth
POST   /api/auth/login          // → { token, user }
POST   /api/auth/logout
GET    /api/users/me            // → current user

// Tasks (extend existing)
GET    /api/tasks               // filtered by role
POST   /api/tasks               // auto-set createdBy, status=pending
PATCH  /api/tasks/:id/assign    // admin only

// Approvals
GET    /api/approvals/pending   // admin only
POST   /api/approvals/:id/approve  // admin only
POST   /api/approvals/:id/reject   // admin only

// Plans
POST   /api/tasks/:id/plan      // generate execution plan
GET    /api/tasks/:id/plan      // view plan
POST   /api/tasks/:id/plan/approve  // admin approves plan

// Conflicts
GET    /api/conflicts/check     // check file conflicts
POST   /api/tasks/:id/lock      // lock files for task
DELETE /api/tasks/:id/lock      // release locks
```

---

### 8. Environment Variables

```bash
# Add to .env
JWT_SECRET=<generate-secure-key>
SESSION_TIMEOUT=86400000
ADMIN_EMAILS=admin@aecord.com,paresh@aecord.com

# Feature flags
ENABLE_APPROVAL_WORKFLOW=true
ENABLE_CONFLICT_DETECTION=true
ENABLE_PLAN_GENERATION=true
MAX_CONCURRENT_TASKS_PER_USER=2
```

---

## Implementation Order

1. **User system** - Auth, roles, session management
2. **Task classification** - Extend Feature with type/priority/approval fields
3. **Kanban modification** - Add approval column, role-based filtering
4. **Agent profiles** - Add AECORD-specific agents
5. **Approval workflow** - Admin approval before execution
6. **Plan generation** - Pre-execution planning
7. **Git isolation** - Worktree-per-task strategy
8. **Conflict detection** - File locking system
9. **Team dashboard** - Real-time status view

---

## Testing Checklist

- [ ] Login with each role type works
- [ ] Backend-dev cannot see frontend-dev's tasks
- [ ] Admin can approve/reject tasks
- [ ] Approved task auto-assigns correct agent
- [ ] Execution plan generates before start
- [ ] Git worktree creates in isolation
- [ ] File conflicts detected and queued
- [ ] Concurrent tasks don't touch same files
- [ ] Merge to develop works after verification

---

## Constraints

- Do NOT modify core AutoMaker agent execution logic in `libs/`
- Maintain backward compatibility with existing AutoMaker features
- All changes must pass existing AutoMaker test suite
- Follow AutoMaker's established patterns (services, routes, stores)
