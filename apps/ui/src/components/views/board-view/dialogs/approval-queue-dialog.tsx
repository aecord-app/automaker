// @ts-nocheck
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowUpCircle,
  Bug,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useApprovalQueue,
  useApproveFeature,
  useRejectFeature,
  useBatchApprove,
  useBatchReject,
} from '@/hooks/use-approvals';

const TYPE_ICONS: Record<string, any> = {
  feature: ArrowUpCircle,
  bug: Bug,
  enhancement: Lightbulb,
  issue: HelpCircle,
};

const TYPE_COLORS: Record<string, string> = {
  feature: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  bug: 'bg-red-500/10 text-red-600 border-red-500/20',
  enhancement: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  issue: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-600 border-green-500/20',
};

interface ApprovalQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
}

export function ApprovalQueueDialog({ open, onOpenChange, projectPath }: ApprovalQueueDialogProps) {
  const { data, isLoading } = useApprovalQueue(projectPath);
  const approveMutation = useApproveFeature();
  const rejectMutation = useRejectFeature();
  const batchApproveMutation = useBatchApprove();
  const batchRejectMutation = useBatchReject();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

  const features = data?.features || [];
  const stats = data?.stats;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === features.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(features.map((f: any) => f.id)));
    }
  };

  const handleApprove = async (featureId: string) => {
    try {
      await approveMutation.mutateAsync({ projectPath, featureId });
      toast.success('Feature approved');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReject = async (featureId: string) => {
    const reason = rejectReasonMap[featureId];
    if (!reason?.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      await rejectMutation.mutateAsync({ projectPath, featureId, reason });
      toast.success('Feature rejected');
      setShowRejectInput(null);
      setRejectReasonMap((prev) => {
        const next = { ...prev };
        delete next[featureId];
        return next;
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    try {
      await batchApproveMutation.mutateAsync({
        projectPath,
        featureIds: Array.from(selectedIds),
      });
      toast.success(`Approved ${selectedIds.size} features`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBatchReject = async () => {
    if (selectedIds.size === 0) return;
    const reason = rejectReasonMap['__batch'] || '';
    if (!reason.trim()) {
      toast.error('Rejection reason is required for batch reject');
      return;
    }
    try {
      await batchRejectMutation.mutateAsync({
        projectPath,
        featureIds: Array.from(selectedIds),
        reason,
      });
      toast.success(`Rejected ${selectedIds.size} features`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Approval Queue
          </DialogTitle>
        </DialogHeader>

        {/* Stats header */}
        {stats && (
          <div className="flex gap-3 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-muted/50 border border-border/30">
              Total: {stats.total || features.length}
            </span>
            {stats.byType &&
              Object.entries(stats.byType).map(([type, count]) => (
                <span
                  key={type}
                  className={cn(
                    'px-2.5 py-1 rounded-lg border',
                    TYPE_COLORS[type] || 'bg-muted/50'
                  )}
                >
                  {type}: {count as number}
                </span>
              ))}
            {stats.byPriority &&
              Object.entries(stats.byPriority).map(([priority, count]) => (
                <span
                  key={priority}
                  className={cn(
                    'px-2.5 py-1 rounded-lg border',
                    PRIORITY_COLORS[priority] || 'bg-muted/50'
                  )}
                >
                  {priority}: {count as number}
                </span>
              ))}
          </div>
        )}

        {/* Batch actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/30">
            <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={handleBatchApprove}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Approve All
            </Button>
            <Input
              placeholder="Rejection reason..."
              className="h-7 text-xs flex-1"
              value={rejectReasonMap['__batch'] || ''}
              onChange={(e) => setRejectReasonMap((prev) => ({ ...prev, __batch: e.target.value }))}
            />
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={handleBatchReject}
            >
              <XCircle className="w-3 h-3 mr-1" /> Reject All
            </Button>
          </div>
        )}

        {/* Feature list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground p-4">Loading...</p>}

          {features.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No pending approvals</p>
            </div>
          )}

          {features.length > 0 && (
            <div className="flex items-center gap-2 px-1 py-1">
              <Checkbox
                checked={selectedIds.size === features.length && features.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground">Select all</span>
            </div>
          )}

          {features.map((feature: any) => {
            const TypeIcon = TYPE_ICONS[feature.taskType] || HelpCircle;
            return (
              <div
                key={feature.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors"
              >
                <Checkbox
                  checked={selectedIds.has(feature.id)}
                  onCheckedChange={() => toggleSelect(feature.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{feature.title || 'Untitled'}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {feature.taskType && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1',
                          TYPE_COLORS[feature.taskType]
                        )}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {feature.taskType}
                      </span>
                    )}
                    {feature.taskPriority && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded border',
                          PRIORITY_COLORS[feature.taskPriority]
                        )}
                      >
                        {feature.taskPriority}
                      </span>
                    )}
                    {feature.submittedBy && (
                      <span className="text-[10px] text-muted-foreground">
                        by {feature.submittedBy}
                      </span>
                    )}
                    {feature.createdAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(feature.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Reject reason input */}
                  {showRejectInput === feature.id && (
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        placeholder="Reason for rejection..."
                        className="h-7 text-xs flex-1"
                        value={rejectReasonMap[feature.id] || ''}
                        onChange={(e) =>
                          setRejectReasonMap((prev) => ({ ...prev, [feature.id]: e.target.value }))
                        }
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => handleReject(feature.id)}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setShowRejectInput(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(feature.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-red-500 hover:text-red-600"
                    onClick={() => setShowRejectInput(feature.id)}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
