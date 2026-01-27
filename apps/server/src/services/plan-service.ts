/**
 * AECORD Execution Plan Service
 *
 * Generates and manages execution plans for tasks before AI execution.
 * Plans include phases, token estimates, risk assessment, and cost estimation.
 */

import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import type {
  ExecutionPlan,
  ExecutionPhase,
  RiskLevel,
  Feature,
  TaskType,
  AgentProfile,
} from '@automaker/types';
import { TASK_TYPE_CONFIGS } from '@automaker/types';
import { createLogger, atomicWriteJson, DEFAULT_BACKUP_COUNT } from '@automaker/utils';
import * as secureFs from '../lib/secure-fs.js';
import type { FeatureLoader } from './feature-loader.js';
import type { AgentProfileService } from './agent-profile-service.js';

const logger = createLogger('PlanService');

// Cost per 1M tokens (approximate, based on Claude pricing)
const COST_PER_MILLION_TOKENS = {
  'claude-sonnet-4': { input: 3.0, output: 15.0 },
  'claude-haiku-4': { input: 0.25, output: 1.25 },
  'claude-opus-4': { input: 15.0, output: 75.0 },
  default: { input: 3.0, output: 15.0 },
};

// Risk factors and their weights
const RISK_FACTORS = {
  highFileCount: { threshold: 10, weight: 2, description: 'Modifies many files' },
  criticalFiles: {
    patterns: [/config/, /\.env/, /auth/, /security/, /migration/, /schema/],
    weight: 3,
    description: 'Touches critical system files',
  },
  highTokenCount: { threshold: 50000, weight: 2, description: 'High token usage' },
  noTests: { weight: 2, description: 'No test coverage specified' },
  databaseChanges: {
    patterns: [/prisma/, /migration/, /schema/, /\.sql/],
    weight: 3,
    description: 'Includes database changes',
  },
  apiChanges: {
    patterns: [/routes/, /api/, /endpoint/, /controller/],
    weight: 2,
    description: 'Modifies API endpoints',
  },
};

interface PlanStorage {
  version: 1;
  plans: Record<string, ExecutionPlan>; // keyed by plan ID
}

/**
 * Read JSON file with fallback to default value
 */
async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = (await secureFs.readFile(filePath, 'utf-8')) as string;
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultValue;
    }
    logger.error(`Error reading ${filePath}:`, error);
    return defaultValue;
  }
}

/**
 * Write JSON file atomically with backup support
 */
async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await atomicWriteJson(filePath, data, { backupCount: DEFAULT_BACKUP_COUNT });
}

export class PlanService extends EventEmitter {
  private dataDir: string;
  private featureLoader: FeatureLoader;
  private agentProfileService: AgentProfileService;
  private plans: Map<string, ExecutionPlan> = new Map();
  private initialized = false;

  constructor(
    dataDir: string,
    featureLoader: FeatureLoader,
    agentProfileService: AgentProfileService
  ) {
    super();
    this.dataDir = dataDir;
    this.featureLoader = featureLoader;
    this.agentProfileService = agentProfileService;
  }

  /**
   * Initialize the service - load plans from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const filePath = this.getPlansFilePath();
    const stored = await readJsonFile<PlanStorage>(filePath, { version: 1, plans: {} });

    for (const [id, plan] of Object.entries(stored.plans)) {
      this.plans.set(id, plan);
    }

    logger.info(`Loaded ${this.plans.size} execution plans`);
    this.initialized = true;
  }

  /**
   * Generate an execution plan for a feature
   */
  async generatePlan(
    projectPath: string,
    featureId: string,
    createdBy: string
  ): Promise<ExecutionPlan> {
    const feature = await this.featureLoader.get(projectPath, featureId);
    if (!feature) {
      throw new Error(`Feature not found: ${featureId}`);
    }

    // Get recommended agent profile
    const taskType = (feature.taskType || 'feature') as TaskType;
    const profile = this.agentProfileService.getRecommended(
      taskType,
      feature.serviceArea as string | undefined
    );

    // Analyze the feature to generate phases
    const phases = this.generatePhases(feature, profile);

    // Calculate totals
    const totalEstimatedTokens = phases.reduce((sum, p) => sum + p.estimatedTokens, 0);
    const totalEstimatedFiles = phases.reduce((sum, p) => sum + p.estimatedFilesModified, 0);

    // Assess risk
    const { riskLevel, riskFactors } = this.assessRisk(feature, phases, totalEstimatedTokens);

    // Estimate cost
    const estimatedCostUSD = this.estimateCost(
      totalEstimatedTokens,
      profile?.model || 'claude-sonnet-4'
    );

    // Generate acceptance criteria
    const acceptanceCriteria = this.generateAcceptanceCriteria(feature, taskType);

    const now = new Date().toISOString();
    const plan: ExecutionPlan = {
      id: `plan-${crypto.randomUUID()}`,
      featureId,
      createdAt: now,
      createdBy,
      phases,
      totalEstimatedTokens,
      totalEstimatedFiles,
      estimatedCostUSD,
      riskLevel,
      riskFactors,
      acceptanceCriteria,
      status: 'draft',
    };

    // Save plan
    this.plans.set(plan.id, plan);
    await this.savePlans();

    // Update feature with plan reference
    await this.featureLoader.update(projectPath, featureId, {
      executionPlan: plan,
    });

    logger.info(`Generated execution plan ${plan.id} for feature ${featureId}`);
    this.emit('plan:generated', { plan, featureId, projectPath });

    return plan;
  }

  /**
   * Get a plan by ID
   */
  getPlan(planId: string): ExecutionPlan | null {
    return this.plans.get(planId) || null;
  }

  /**
   * Get plan for a feature
   */
  async getPlanForFeature(projectPath: string, featureId: string): Promise<ExecutionPlan | null> {
    const feature = await this.featureLoader.get(projectPath, featureId);
    if (!feature?.executionPlan) return null;
    return feature.executionPlan;
  }

  /**
   * Submit plan for approval
   */
  async submitForApproval(planId: string): Promise<ExecutionPlan> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    if (plan.status !== 'draft') {
      throw new Error(`Plan is not in draft status: ${plan.status}`);
    }

    plan.status = 'pending_approval';
    await this.savePlans();

    logger.info(`Plan ${planId} submitted for approval`);
    this.emit('plan:submitted', { plan });

    return plan;
  }

  /**
   * Approve a plan (admin only)
   */
  async approvePlan(
    planId: string,
    approvedBy: string,
    editedPlan?: string
  ): Promise<ExecutionPlan> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    if (plan.status !== 'pending_approval' && plan.status !== 'draft') {
      throw new Error(`Plan cannot be approved in status: ${plan.status}`);
    }

    plan.status = 'approved';
    plan.approvedBy = approvedBy;
    plan.approvedAt = new Date().toISOString();
    if (editedPlan) {
      plan.editedPlan = editedPlan;
    }

    await this.savePlans();

    logger.info(`Plan ${planId} approved by ${approvedBy}`);
    this.emit('plan:approved', { plan, approvedBy });

    return plan;
  }

  /**
   * Reject a plan (admin only)
   */
  async rejectPlan(planId: string, rejectedBy: string, reason: string): Promise<ExecutionPlan> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    if (plan.status !== 'pending_approval' && plan.status !== 'draft') {
      throw new Error(`Plan cannot be rejected in status: ${plan.status}`);
    }

    plan.status = 'rejected';
    plan.rejectionReason = reason;

    await this.savePlans();

    logger.info(`Plan ${planId} rejected by ${rejectedBy}: ${reason}`);
    this.emit('plan:rejected', { plan, rejectedBy, reason });

    return plan;
  }

  /**
   * Get all pending plans
   */
  getPendingPlans(): ExecutionPlan[] {
    return Array.from(this.plans.values()).filter((p) => p.status === 'pending_approval');
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    const deleted = this.plans.delete(planId);
    if (deleted) {
      await this.savePlans();
      logger.info(`Deleted plan ${planId}`);
    }
    return deleted;
  }

  /**
   * Generate phases for a feature
   */
  private generatePhases(feature: Feature, profile: AgentProfile | null): ExecutionPhase[] {
    const phases: ExecutionPhase[] = [];
    const taskType = (feature.taskType || 'feature') as TaskType;
    const config = TASK_TYPE_CONFIGS[taskType];

    // Analyze feature description to estimate complexity
    const description = feature.description || '';
    const hasUIWork = /ui|component|page|screen|form|button|modal/i.test(description);
    const hasAPIWork = /api|endpoint|route|controller|service/i.test(description);
    const hasDBWork = /database|schema|migration|model|prisma/i.test(description);
    const hasTestWork = /test|spec|coverage/i.test(description);

    let phaseOrder = 0;

    // Phase 1: Analysis (always included)
    phases.push({
      id: `phase-${++phaseOrder}`,
      name: 'Analysis & Planning',
      description: 'Analyze requirements, review existing code, identify dependencies',
      estimatedTokens: this.estimatePhaseTokens('analysis', taskType),
      estimatedFilesModified: 0,
      filesToModify: [],
      dependencies: [],
    });

    // Phase 2: Database/Schema changes (if needed)
    if (hasDBWork) {
      phases.push({
        id: `phase-${++phaseOrder}`,
        name: 'Database Schema',
        description: 'Create or modify database schema, migrations, and models',
        estimatedTokens: this.estimatePhaseTokens('database', taskType),
        estimatedFilesModified: 3,
        filesToModify: ['prisma/schema.prisma', 'src/models/*'],
        dependencies: [`phase-${phaseOrder - 1}`],
      });
    }

    // Phase 3: API/Backend implementation (if needed)
    if (hasAPIWork || config.type === 'feature') {
      phases.push({
        id: `phase-${++phaseOrder}`,
        name: 'Backend Implementation',
        description: 'Implement API endpoints, services, and business logic',
        estimatedTokens: this.estimatePhaseTokens('backend', taskType),
        estimatedFilesModified: hasDBWork ? 5 : 4,
        filesToModify: ['src/routes/*', 'src/services/*', 'src/controllers/*'],
        dependencies: hasDBWork ? [`phase-${phaseOrder - 1}`] : [`phase-1`],
      });
    }

    // Phase 4: Frontend implementation (if needed)
    if (hasUIWork) {
      phases.push({
        id: `phase-${++phaseOrder}`,
        name: 'Frontend Implementation',
        description: 'Implement UI components, pages, and user interactions',
        estimatedTokens: this.estimatePhaseTokens('frontend', taskType),
        estimatedFilesModified: 6,
        filesToModify: ['src/components/*', 'src/pages/*', 'src/hooks/*'],
        dependencies: hasAPIWork ? [`phase-${phaseOrder - 1}`] : [`phase-1`],
      });
    }

    // Phase 5: Testing (if not auto-verify)
    if (!config.autoVerify || hasTestWork) {
      phases.push({
        id: `phase-${++phaseOrder}`,
        name: 'Testing',
        description: 'Write and run tests to verify implementation',
        estimatedTokens: this.estimatePhaseTokens('testing', taskType),
        estimatedFilesModified: 3,
        filesToModify: ['src/__tests__/*', 'tests/*'],
        dependencies: [`phase-${phaseOrder - 1}`],
      });
    }

    // Phase 6: Integration & Cleanup
    phases.push({
      id: `phase-${++phaseOrder}`,
      name: 'Integration & Cleanup',
      description: 'Final integration, code cleanup, and documentation',
      estimatedTokens: this.estimatePhaseTokens('integration', taskType),
      estimatedFilesModified: 2,
      filesToModify: [],
      dependencies: [`phase-${phaseOrder - 1}`],
    });

    return phases;
  }

  /**
   * Estimate tokens for a phase
   */
  private estimatePhaseTokens(phaseType: string, taskType: TaskType): number {
    const baseTokens: Record<string, number> = {
      analysis: 5000,
      database: 8000,
      backend: 15000,
      frontend: 20000,
      testing: 10000,
      integration: 5000,
    };

    const taskMultiplier: Record<TaskType, number> = {
      feature: 1.5,
      bug: 0.5,
      enhancement: 0.8,
      issue: 0.3,
    };

    const base = baseTokens[phaseType] || 10000;
    const multiplier = taskMultiplier[taskType] || 1;

    return Math.round(base * multiplier);
  }

  /**
   * Assess risk level for a plan
   */
  private assessRisk(
    feature: Feature,
    phases: ExecutionPhase[],
    totalTokens: number
  ): { riskLevel: RiskLevel; riskFactors: string[] } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Check file count
    const totalFiles = phases.reduce((sum, p) => sum + p.estimatedFilesModified, 0);
    if (totalFiles >= RISK_FACTORS.highFileCount.threshold) {
      riskFactors.push(RISK_FACTORS.highFileCount.description);
      riskScore += RISK_FACTORS.highFileCount.weight;
    }

    // Check for critical files
    const allFiles = phases.flatMap((p) => p.filesToModify);
    for (const file of allFiles) {
      for (const pattern of RISK_FACTORS.criticalFiles.patterns) {
        if (pattern.test(file)) {
          if (!riskFactors.includes(RISK_FACTORS.criticalFiles.description)) {
            riskFactors.push(RISK_FACTORS.criticalFiles.description);
            riskScore += RISK_FACTORS.criticalFiles.weight;
          }
          break;
        }
      }
    }

    // Check token count
    if (totalTokens >= RISK_FACTORS.highTokenCount.threshold) {
      riskFactors.push(RISK_FACTORS.highTokenCount.description);
      riskScore += RISK_FACTORS.highTokenCount.weight;
    }

    // Check for no tests
    if (feature.skipTests) {
      riskFactors.push(RISK_FACTORS.noTests.description);
      riskScore += RISK_FACTORS.noTests.weight;
    }

    // Check for database changes
    const description = feature.description || '';
    for (const pattern of RISK_FACTORS.databaseChanges.patterns) {
      if (pattern.test(description)) {
        if (!riskFactors.includes(RISK_FACTORS.databaseChanges.description)) {
          riskFactors.push(RISK_FACTORS.databaseChanges.description);
          riskScore += RISK_FACTORS.databaseChanges.weight;
        }
        break;
      }
    }

    // Determine risk level
    let riskLevel: RiskLevel;
    if (riskScore >= 6) {
      riskLevel = 'high';
    } else if (riskScore >= 3) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return { riskLevel, riskFactors };
  }

  /**
   * Estimate cost in USD
   */
  private estimateCost(totalTokens: number, model: string): number {
    const pricing =
      COST_PER_MILLION_TOKENS[model as keyof typeof COST_PER_MILLION_TOKENS] ||
      COST_PER_MILLION_TOKENS.default;

    // Assume 60% input, 40% output ratio
    const inputTokens = totalTokens * 0.6;
    const outputTokens = totalTokens * 0.4;

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    // Round to 2 decimal places
    return Math.round((inputCost + outputCost) * 100) / 100;
  }

  /**
   * Generate acceptance criteria for a feature
   */
  private generateAcceptanceCriteria(feature: Feature, taskType: TaskType): string[] {
    const criteria: string[] = [];

    // Base criteria for all tasks
    criteria.push('Code compiles without errors');
    criteria.push('No new linting warnings');

    // Task-type specific criteria
    switch (taskType) {
      case 'feature':
        criteria.push('Feature works as described in requirements');
        criteria.push('All edge cases are handled');
        criteria.push('Documentation is updated if needed');
        break;
      case 'bug':
        criteria.push('Bug is fixed and no longer reproducible');
        criteria.push('Regression test is added');
        criteria.push('Related functionality still works');
        break;
      case 'enhancement':
        criteria.push('Enhancement improves the specified area');
        criteria.push('Performance impact is measured');
        criteria.push('Backward compatibility is maintained');
        break;
      case 'issue':
        criteria.push('Issue is resolved or triaged appropriately');
        break;
    }

    // Add test criteria if not skipped
    if (!feature.skipTests) {
      criteria.push('All existing tests pass');
      criteria.push('New tests are added for new functionality');
    }

    return criteria;
  }

  /**
   * Save plans to disk
   */
  private async savePlans(): Promise<void> {
    const storage: PlanStorage = {
      version: 1,
      plans: Object.fromEntries(this.plans),
    };

    await writeJsonFile(this.getPlansFilePath(), storage);
  }

  /**
   * Get the plans file path
   */
  private getPlansFilePath(): string {
    return path.join(this.dataDir, 'execution-plans.json');
  }
}
