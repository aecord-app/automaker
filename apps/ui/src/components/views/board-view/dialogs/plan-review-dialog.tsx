// @ts-nocheck
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  FileText,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  DollarSign,
  Cpu,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import {
  useFeatureExecutionPlan,
  useGeneratePlan,
  useApprovePlan,
  useRejectPlan,
  formatCost,
  formatTokens,
} from '@/hooks/use-execution-plans';
import type { Feature } from '@/store/app-store';

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-500 bg-green-500/10 border-green-500/20',
  medium: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  high: 'text-red-500 bg-red-500/10 border-red-500/20',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-gray-500 bg-gray-500/10',
  pending_approval: 'text-amber-500 bg-amber-500/10',
  approved: 'text-green-500 bg-green-500/10',
  rejected: 'text-red-500 bg-red-500/10',
};

interface PlanReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: Feature | null;
  projectPath: string;
}

export function PlanReviewDialog({
  open,
  onOpenChange,
  feature,
  projectPath,
}: PlanReviewDialogProps) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const { data: plan, isLoading } = useFeatureExecutionPlan(
    open ? projectPath : null,
    open ? feature?.id || null : null
  );

  const generateMutation = useGeneratePlan();
  const approveMutation = useApprovePlan();
  const rejectMutation = useRejectPlan();

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleGenerate = async () => {
    if (!feature) return;
    try {
      await generateMutation.mutateAsync({ projectPath, featureId: feature.id });
      toast.success('Plan generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate plan');
    }
  };

  const handleApprove = async () => {
    if (!plan) return;
    try {
      await approveMutation.mutateAsync({ planId: plan.id });
      toast.success('Plan approved');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve plan');
    }
  };

  const handleReject = async () => {
    if (!plan || !rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      await rejectMutation.mutateAsync({ planId: plan.id, reason: rejectReason });
      toast.success('Plan rejected');
      setShowRejectInput(false);
      setRejectReason('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject plan');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Execution Plan
            {feature && (
              <span className="text-sm text-muted-foreground font-normal">— {feature.title}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading plan...</p>}

          {!plan && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="w-10 h-10 mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-4">
                No execution plan exists for this feature.
              </p>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? 'Generating...' : 'Generate Plan'}
              </Button>
            </div>
          )}

          {plan && (
            <>
              {/* Status & Risk */}
              <div className="flex items-center gap-3">
                <span className={cn('text-xs px-2.5 py-1 rounded-lg', STATUS_COLORS[plan.status])}>
                  {plan.status.replace('_', ' ')}
                </span>
                {plan.riskLevel && (
                  <span
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1',
                      RISK_COLORS[plan.riskLevel]
                    )}
                  >
                    <Shield className="w-3 h-3" />
                    {plan.riskLevel} risk
                  </span>
                )}
              </div>

              {/* Cost & Tokens summary */}
              <div className="flex gap-3">
                {plan.estimatedCostUSD != null && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Est. Cost</p>
                      <p className="text-sm font-medium">{formatCost(plan.estimatedCostUSD)}</p>
                    </div>
                  </div>
                )}
                {plan.estimatedTokens != null && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Est. Tokens</p>
                      <p className="text-sm font-medium">{formatTokens(plan.estimatedTokens)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Phases */}
              {plan.phases && plan.phases.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Phases</h3>
                  {plan.phases.map((phase: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/30">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{phase.name || `Phase ${i + 1}`}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {phase.estimatedTokens && (
                            <span>{formatTokens(phase.estimatedTokens)} tokens</span>
                          )}
                        </div>
                      </div>
                      {phase.description && (
                        <p className="text-xs text-muted-foreground mt-1">{phase.description}</p>
                      )}
                      {phase.files && phase.files.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {phase.files.map((file: string, j: number) => (
                            <span
                              key={j}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono"
                            >
                              {file}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Risk Factors */}
              {plan.riskFactors && plan.riskFactors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Risk Factors
                  </h3>
                  <ul className="space-y-1">
                    {plan.riskFactors.map((factor: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Acceptance Criteria */}
              {plan.acceptanceCriteria && plan.acceptanceCriteria.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Acceptance Criteria</h3>
                  <ul className="space-y-1">
                    {plan.acceptanceCriteria.map((criterion: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" />
                        {criterion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reject input */}
              {showRejectInput && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <Input
                    placeholder="Reason for rejection..."
                    className="h-8 text-xs flex-1"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={handleReject}
                    disabled={rejectMutation.isPending}
                  >
                    Confirm Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => setShowRejectInput(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {plan && isAdmin && plan.status !== 'approved' && (
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Regenerate
            </Button>
            <Button
              variant="outline"
              className="text-red-500 hover:text-red-600"
              onClick={() => setShowRejectInput(true)}
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {approveMutation.isPending ? 'Approving...' : 'Approve Plan'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
