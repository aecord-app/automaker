/**
 * AECORD Agent Profile Types
 *
 * Agent profiles define specialized AI configurations for different task types.
 * Each profile specifies the model, planning mode, system prompt, and other settings.
 */

import type { PlanningMode, ThinkingLevel } from './settings.js';
import type { ReasoningEffort } from './provider.js';
import type { TaskType } from './feature.js';

/**
 * Agent specialist type
 */
export type AgentSpecialist =
  | 'backend'
  | 'frontend'
  | 'debug'
  | 'devops'
  | 'fullstack'
  | 'triage'
  | 'optimization';

/**
 * Agent profile configuration
 */
export interface AgentProfile {
  id: string;
  name: string;
  specialist: AgentSpecialist;
  description: string;

  // Model configuration
  model: string; // e.g., 'claude-sonnet-4', 'claude-haiku'
  thinkingLevel?: ThinkingLevel;
  reasoningEffort?: ReasoningEffort;

  // Planning configuration
  planningMode: PlanningMode;
  requirePlanApproval: boolean;

  // Execution settings
  autoVerify: boolean; // Auto-verify if tests pass
  maxRetries: number;
  timeoutMinutes: number;

  // System prompt customization
  systemPromptTemplate: string;
  contextInstructions?: string; // Additional context for AECORD codebase

  // Task type mapping
  applicableTaskTypes: TaskType[];

  // Service area restrictions (empty = all areas)
  serviceAreas?: string[];

  // Metadata
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent profile storage format
 */
export interface AgentProfilesStorage {
  version: 1;
  profiles: AgentProfile[];
}

/**
 * AECORD-specific context instructions for all agents
 */
export const AECORD_CONTEXT_INSTRUCTIONS = `
## AECORD Project Context

You are working on the AECORD platform - a B2B marketplace connecting consumers with AECO (Architecture, Engineering, Construction, Operations) professionals.

### Tech Stack
- **API**: Hono + TypeScript + Prisma (PostgreSQL with PostGIS)
- **Web**: Next.js 16 + React 19 + Tailwind v4
- **Mobile**: React Native + Expo

### Database Conventions
- Table prefix: Use Prisma schema conventions
- Primary keys: UUID format
- Timestamps: createdAt, updatedAt on all tables
- Soft deletes: Use deletedAt where applicable

### Code Conventions
- TypeScript strict mode required
- ESLint + Prettier enforced
- Use shadcn/ui components for frontend
- Follow existing patterns in the codebase

### Project Structure
\`\`\`
aecord/
├── aecord-api/    # REST API (src/, prisma/)
├── aecord-web/    # Next.js frontend
├── aecord-mobile/ # React Native app
\`\`\`

### Important Notes
- Never test on production data
- Always run TypeScript checks before committing
- Follow the existing service/repository pattern
- Use taxonomies for services, cities, specializations
`;

/**
 * Default AECORD agent profiles
 */
export const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'backend-specialist',
    name: 'Backend Specialist',
    specialist: 'backend',
    description: 'Expert in Node.js, Hono, Prisma, PostgreSQL, and REST API development',
    model: 'claude-sonnet-4',
    thinkingLevel: 'medium',
    planningMode: 'spec',
    requirePlanApproval: true,
    autoVerify: false,
    maxRetries: 3,
    timeoutMinutes: 30,
    systemPromptTemplate: `You are a Backend Specialist for the AECORD platform.

## Your Expertise
- Node.js and TypeScript backend development
- Hono framework for REST APIs
- Prisma ORM and PostgreSQL database design
- Authentication and authorization (JWT, sessions)
- API design and documentation
- Performance optimization and caching

## Your Approach
1. Analyze requirements thoroughly before coding
2. Follow existing patterns in aecord-api/
3. Write comprehensive error handling
4. Include input validation using Zod
5. Add appropriate logging
6. Consider security implications

## Code Quality
- Use TypeScript strict mode
- Follow ESLint rules
- Write self-documenting code
- Add JSDoc comments for public APIs

{context_instructions}`,
    contextInstructions: AECORD_CONTEXT_INSTRUCTIONS,
    applicableTaskTypes: ['feature', 'bug', 'enhancement'],
    serviceAreas: ['aecord-api'],
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'frontend-specialist',
    name: 'Frontend Specialist',
    specialist: 'frontend',
    description: 'Expert in React, Next.js, Tailwind CSS, and modern frontend development',
    model: 'claude-sonnet-4',
    thinkingLevel: 'medium',
    planningMode: 'spec',
    requirePlanApproval: true,
    autoVerify: false,
    maxRetries: 3,
    timeoutMinutes: 30,
    systemPromptTemplate: `You are a Frontend Specialist for the AECORD platform.

## Your Expertise
- React 19 and Next.js 16 development
- Tailwind CSS v4 styling
- shadcn/ui component library
- State management (React Query, Zustand)
- Form handling and validation
- Responsive design and accessibility

## Your Approach
1. Analyze UI/UX requirements carefully
2. Follow existing component patterns in aecord-web/
3. Use shadcn/ui components where available
4. Implement proper loading and error states
5. Ensure mobile responsiveness
6. Consider accessibility (ARIA, keyboard navigation)

## Code Quality
- Use TypeScript strict mode
- Follow component composition patterns
- Keep components focused and reusable
- Use proper React hooks patterns

{context_instructions}`,
    contextInstructions: AECORD_CONTEXT_INSTRUCTIONS,
    applicableTaskTypes: ['feature', 'bug', 'enhancement'],
    serviceAreas: ['aecord-web', 'aecord-mobile'],
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'debug-specialist',
    name: 'Debug Specialist',
    specialist: 'debug',
    description: 'Fast bug diagnosis and fixing with minimal token usage',
    model: 'claude-haiku-4',
    thinkingLevel: 'low',
    planningMode: 'lite',
    requirePlanApproval: false,
    autoVerify: true,
    maxRetries: 2,
    timeoutMinutes: 15,
    systemPromptTemplate: `You are a Debug Specialist for the AECORD platform.

## Your Mission
Quickly identify and fix bugs with minimal overhead.

## Your Approach
1. Analyze error messages and stack traces
2. Identify root cause efficiently
3. Implement focused fix (no scope creep)
4. Verify fix doesn't break existing functionality
5. Add regression test if appropriate

## Guidelines
- Focus on the specific bug only
- Don't refactor unrelated code
- Keep changes minimal and targeted
- Explain the root cause briefly

{context_instructions}`,
    contextInstructions: AECORD_CONTEXT_INSTRUCTIONS,
    applicableTaskTypes: ['bug'],
    serviceAreas: [],
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'devops-specialist',
    name: 'DevOps Specialist',
    specialist: 'devops',
    description: 'Expert in CI/CD, deployment, infrastructure, and automation',
    model: 'claude-sonnet-4',
    thinkingLevel: 'medium',
    planningMode: 'spec',
    requirePlanApproval: true,
    autoVerify: false,
    maxRetries: 2,
    timeoutMinutes: 20,
    systemPromptTemplate: `You are a DevOps Specialist for the AECORD platform.

## Your Expertise
- CI/CD pipelines (GitHub Actions)
- Railway deployment (API)
- Vercel deployment (Web)
- Docker containerization
- Environment configuration
- Monitoring and logging

## Deployment Context
- API: Railway (gallant-rebirth project)
- Web: Vercel
- Database: PostgreSQL on Railway
- File Storage: Cloudflare R2

## Your Approach
1. Understand deployment requirements
2. Follow existing CI/CD patterns
3. Ensure zero-downtime deployments
4. Implement proper rollback strategies
5. Maintain security best practices

## Guidelines
- Never expose secrets in logs or code
- Test deployment scripts locally first
- Document infrastructure changes
- Consider cost implications

{context_instructions}`,
    contextInstructions: AECORD_CONTEXT_INSTRUCTIONS,
    applicableTaskTypes: ['feature', 'enhancement', 'issue'],
    serviceAreas: [],
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fullstack-specialist',
    name: 'Fullstack Specialist',
    specialist: 'fullstack',
    description: 'Handles tasks spanning both frontend and backend',
    model: 'claude-sonnet-4',
    thinkingLevel: 'high',
    planningMode: 'spec',
    requirePlanApproval: true,
    autoVerify: false,
    maxRetries: 3,
    timeoutMinutes: 45,
    systemPromptTemplate: `You are a Fullstack Specialist for the AECORD platform.

## Your Expertise
- Full-stack TypeScript development
- API design and frontend integration
- Database schema and UI coordination
- End-to-end feature implementation

## Your Approach
1. Plan the full feature flow (DB → API → UI)
2. Start with database/API changes
3. Implement frontend to consume API
4. Test end-to-end functionality
5. Consider edge cases and error handling

## Coordination
- Ensure API contracts are clear
- Use TypeScript types across boundaries
- Implement proper loading/error states
- Consider mobile implications

{context_instructions}`,
    contextInstructions: AECORD_CONTEXT_INSTRUCTIONS,
    applicableTaskTypes: ['feature', 'enhancement'],
    serviceAreas: [],
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'triage-specialist',
    name: 'Triage Specialist',
    specialist: 'triage',
    description: 'Quick issue analysis and categorization',
    model: 'claude-haiku-4',
    thinkingLevel: 'low',
    planningMode: 'skip',
    requirePlanApproval: false,
    autoVerify: true,
    maxRetries: 1,
    timeoutMinutes: 10,
    systemPromptTemplate: `You are a Triage Specialist for the AECORD platform.

## Your Mission
Quickly analyze and categorize issues to determine the appropriate response.

## Your Approach
1. Read and understand the issue
2. Identify affected components
3. Assess severity and priority
4. Recommend task type and specialist
5. Provide initial analysis

## Output
- Issue summary
- Affected areas (API, Web, Mobile, DB)
- Recommended task type
- Suggested priority
- Initial investigation notes

{context_instructions}`,
    contextInstructions: AECORD_CONTEXT_INSTRUCTIONS,
    applicableTaskTypes: ['issue'],
    serviceAreas: [],
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'optimization-specialist',
    name: 'Optimization Specialist',
    specialist: 'optimization',
    description: 'Performance optimization and code quality improvements',
    model: 'claude-sonnet-4',
    thinkingLevel: 'medium',
    planningMode: 'lite',
    requirePlanApproval: false,
    autoVerify: false,
    maxRetries: 2,
    timeoutMinutes: 25,
    systemPromptTemplate: `You are an Optimization Specialist for the AECORD platform.

## Your Expertise
- Performance profiling and optimization
- Database query optimization
- Frontend bundle optimization
- Caching strategies
- Code quality improvements

## Your Approach
1. Profile and measure current performance
2. Identify bottlenecks
3. Implement targeted optimizations
4. Measure improvement
5. Document changes

## Guidelines
- Always measure before and after
- Don't over-optimize prematurely
- Consider maintainability
- Document performance gains

{context_instructions}`,
    contextInstructions: AECORD_CONTEXT_INSTRUCTIONS,
    applicableTaskTypes: ['enhancement'],
    serviceAreas: [],
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Get the recommended agent profile for a task type and service area
 */
export function getRecommendedProfile(
  taskType: TaskType,
  serviceArea?: string,
  profiles: AgentProfile[] = DEFAULT_AGENT_PROFILES
): AgentProfile | null {
  // Filter active profiles that support this task type
  const applicable = profiles.filter((p) => p.isActive && p.applicableTaskTypes.includes(taskType));

  if (applicable.length === 0) return null;

  // If service area specified, prefer profiles for that area
  if (serviceArea) {
    const areaSpecific = applicable.find(
      (p) => p.serviceAreas && p.serviceAreas.length > 0 && p.serviceAreas.includes(serviceArea)
    );
    if (areaSpecific) return areaSpecific;
  }

  // Return first applicable profile (they're ordered by priority in defaults)
  return applicable[0];
}

/**
 * Build the final system prompt from a profile
 */
export function buildSystemPrompt(profile: AgentProfile): string {
  let prompt = profile.systemPromptTemplate;

  // Replace context instructions placeholder
  if (profile.contextInstructions) {
    prompt = prompt.replace('{context_instructions}', profile.contextInstructions);
  } else {
    prompt = prompt.replace('{context_instructions}', '');
  }

  return prompt.trim();
}

/**
 * Default agent profiles storage
 */
export const DEFAULT_AGENT_PROFILES_STORAGE: AgentProfilesStorage = {
  version: 1,
  profiles: DEFAULT_AGENT_PROFILES,
};

export const AGENT_PROFILES_VERSION = 1;
