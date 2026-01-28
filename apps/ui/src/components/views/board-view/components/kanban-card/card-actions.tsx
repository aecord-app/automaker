// @ts-nocheck
import { memo } from 'react';
import { Feature } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import {
  Edit,
  PlayCircle,
  RotateCcw,
  StopCircle,
  CheckCircle2,
  FileText,
  Eye,
  Wand2,
  Archive,
  BadgeCheck,
} from 'lucide-react';

interface CardActionsProps {
  feature: Feature;
  isCurrentAutoTask: boolean;
  isAdmin?: boolean;
  hasContext?: boolean;
  shortcutKey?: string;
  isSelectionMode?: boolean;
  onEdit: () => void;
  onViewOutput?: () => void;
  onVerify?: () => void;
  onResume?: () => void;
  onForceStop?: () => void;
  onManualVerify?: () => void;
  onFollowUp?: () => void;
  onImplement?: () => void;
  onComplete?: () => void;
  onViewPlan?: () => void;
  onApprovePlan?: () => void;
  onMarkFixed?: () => void;
}

export const CardActions = memo(function CardActions({
  feature,
  isCurrentAutoTask,
  isAdmin = false,
  hasContext,
  shortcutKey,
  isSelectionMode = false,
  onEdit,
  onViewOutput,
  onVerify,
  onResume,
  onForceStop,
  onManualVerify,
  onFollowUp,
  onImplement,
  onComplete,
  onViewPlan,
  onApprovePlan,
  onMarkFixed,
}: CardActionsProps) {
  // Hide all actions when in selection mode
  if (isSelectionMode) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 -mx-3 -mb-3 px-3 pb-3">
      {isCurrentAutoTask && (
        <>
          {/* Approve Plan button - admin only */}
          {isAdmin && feature.planSpec?.status === 'generated' && onApprovePlan && (
            <Button
              variant="default"
              size="sm"
              className="flex-1 min-w-0 h-7 text-[11px] bg-purple-600 hover:bg-purple-700 text-white animate-pulse"
              onClick={(e) => {
                e.stopPropagation();
                onApprovePlan();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid={`approve-plan-running-${feature.id}`}
            >
              <FileText className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">Approve Plan</span>
            </Button>
          )}
          {onViewOutput && (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 h-7 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                onViewOutput();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid={`view-output-${feature.id}`}
            >
              <FileText className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">Logs</span>
              {shortcutKey && (
                <span
                  className="ml-1.5 px-1 py-0.5 text-[9px] font-mono rounded bg-foreground/10"
                  data-testid={`shortcut-key-${feature.id}`}
                >
                  {shortcutKey}
                </span>
              )}
            </Button>
          )}
          {/* Force Stop - admin only */}
          {isAdmin && onForceStop && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-[11px] px-2 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onForceStop();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid={`force-stop-${feature.id}`}
            >
              <StopCircle className="w-3 h-3" />
            </Button>
          )}
        </>
      )}
      {!isCurrentAutoTask &&
        (feature.status === 'in_progress' ||
          (typeof feature.status === 'string' && feature.status.startsWith('pipeline_'))) && (
          <>
            {/* Approve Plan button - admin only */}
            {isAdmin && feature.planSpec?.status === 'generated' && onApprovePlan && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-7 text-[11px] bg-purple-600 hover:bg-purple-700 text-white animate-pulse"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprovePlan();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`approve-plan-${feature.id}`}
              >
                <FileText className="w-3 h-3 mr-1" />
                Approve Plan
              </Button>
            )}
            {/* Verify / Resume / Manual Verify - admin only */}
            {isAdmin && (
              <>
                {feature.skipTests && onManualVerify ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-7 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onManualVerify();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    data-testid={`manual-verify-${feature.id}`}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verify
                  </Button>
                ) : onResume ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-7 text-[11px] bg-[var(--status-success)] hover:bg-[var(--status-success)]/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResume();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    data-testid={`resume-feature-${feature.id}`}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Resume
                  </Button>
                ) : onVerify ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-7 text-[11px] bg-[var(--status-success)] hover:bg-[var(--status-success)]/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVerify();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    data-testid={`verify-feature-${feature.id}`}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verify
                  </Button>
                ) : null}
              </>
            )}
            {/* Logs - visible to all */}
            {onViewOutput && !feature.skipTests && (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-[11px] px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOutput();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`view-output-inprogress-${feature.id}`}
              >
                <FileText className="w-3 h-3" />
              </Button>
            )}
          </>
        )}
      {!isCurrentAutoTask && feature.status === 'verified' && (
        <>
          {/* Logs - visible to all */}
          {onViewOutput && (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 h-7 text-xs min-w-0"
              onClick={(e) => {
                e.stopPropagation();
                onViewOutput();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid={`view-output-verified-${feature.id}`}
            >
              <FileText className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">Logs</span>
            </Button>
          )}
          {/* Complete - admin only */}
          {isAdmin && onComplete && (
            <Button
              variant="default"
              size="sm"
              className="flex-1 h-7 text-xs min-w-0 bg-brand-500 hover:bg-brand-600"
              onClick={(e) => {
                e.stopPropagation();
                onComplete();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid={`complete-${feature.id}`}
            >
              <Archive className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">Complete</span>
            </Button>
          )}
        </>
      )}
      {!isCurrentAutoTask && feature.status === 'waiting_approval' && (
        <>
          {/* Refine - admin only */}
          {isAdmin && onFollowUp && (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 h-7 text-[11px] min-w-0"
              onClick={(e) => {
                e.stopPropagation();
                onFollowUp();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid={`follow-up-${feature.id}`}
            >
              <Wand2 className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">Refine</span>
            </Button>
          )}
          {/* Verify / Mark as Verified - admin only */}
          {isAdmin && (
            <>
              {feature.prUrl && onManualVerify ? (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onManualVerify();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`verify-${feature.id}`}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Verify
                </Button>
              ) : onManualVerify ? (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onManualVerify();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`mark-as-verified-${feature.id}`}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Mark as Verified
                </Button>
              ) : null}
            </>
          )}
          {/* Logs - visible to all */}
          {onViewOutput && (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-[11px] px-2"
              onClick={(e) => {
                e.stopPropagation();
                onViewOutput();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid={`view-output-waiting-${feature.id}`}
            >
              <FileText className="w-3 h-3" />
            </Button>
          )}
        </>
      )}
      {/* Mark as Fixed - shown when feature has error/failed status, for admin */}
      {!isCurrentAutoTask &&
        isAdmin &&
        onMarkFixed &&
        (feature.error ||
          feature.status === 'failed' ||
          feature.title?.toLowerCase().startsWith('error')) && (
          <Button
            variant="default"
            size="sm"
            className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={(e) => {
              e.stopPropagation();
              onMarkFixed();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            data-testid={`mark-fixed-${feature.id}`}
          >
            <BadgeCheck className="w-3 h-3 mr-1" />
            Mark Fixed
          </Button>
        )}
      {!isCurrentAutoTask &&
        ['backlog', 'pending_approval', 'approved'].includes(feature.status) && (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid={`edit-backlog-${feature.id}`}
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
            {feature.planSpec?.content && onViewPlan && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewPlan();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`view-plan-${feature.id}`}
                title="View Plan"
              >
                <Eye className="w-3 h-3" />
              </Button>
            )}
            {isAdmin && onImplement && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onImplement();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`make-${feature.id}`}
              >
                <PlayCircle className="w-3 h-3 mr-1" />
                Make
              </Button>
            )}
          </>
        )}
    </div>
  );
});
