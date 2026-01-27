// @ts-nocheck
import { memo } from 'react';
import { Feature } from '@/store/app-store';
import {
  GitBranch,
  GitPullRequest,
  ExternalLink,
  User,
  Clock,
  Tag,
  AlertTriangle,
  Sparkles,
  Bug,
  TrendingUp,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
  feature: {
    label: 'Feature',
    icon: Sparkles,
    cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  bug: { label: 'Bug', icon: Bug, cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
  enhancement: {
    label: 'Enhancement',
    icon: TrendingUp,
    cls: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  issue: {
    label: 'Issue',
    icon: AlertTriangle,
    cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-500/15 text-red-500 border-red-500/25' },
  high: { label: 'High', cls: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  medium: { label: 'Medium', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  low: { label: 'Low', cls: 'bg-green-500/10 text-green-600 border-green-500/20' },
};

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface CardContentSectionsProps {
  feature: Feature;
  useWorktrees: boolean;
}

export const CardContentSections = memo(function CardContentSections({
  feature,
  useWorktrees,
}: CardContentSectionsProps) {
  const taskTypeConf = feature.taskType ? TASK_TYPE_CONFIG[feature.taskType] : null;
  const priorityConf = feature.taskPriority ? PRIORITY_CONFIG[feature.taskPriority] : null;
  const hasMetadata =
    taskTypeConf ||
    priorityConf ||
    feature.assignedTo ||
    feature.startedAt ||
    feature.serviceArea ||
    feature.createdBy ||
    feature.createdAt;

  return (
    <>
      {/* Team & Classification Metadata */}
      {hasMetadata && (
        <div className="mb-2 space-y-1.5">
          {/* Type & Priority badges row */}
          {(taskTypeConf || priorityConf) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {taskTypeConf &&
                (() => {
                  const TypeIcon = taskTypeConf.icon;
                  return (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border',
                        taskTypeConf.cls
                      )}
                    >
                      <TypeIcon className="w-2.5 h-2.5" />
                      {taskTypeConf.label}
                    </span>
                  );
                })()}
              {priorityConf && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border',
                    priorityConf.cls
                  )}
                >
                  {priorityConf.label}
                </span>
              )}
              {feature.serviceArea && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/30 border border-border/30">
                  <FolderOpen className="w-2.5 h-2.5" />
                  {feature.serviceArea}
                </span>
              )}
            </div>
          )}

          {/* Submitter & timestamps row */}
          {(feature.createdBy ||
            feature.createdAt ||
            feature.assignedTo ||
            feature.startedAt ||
            feature.assignedAt) && (
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground/70">
              {feature.createdBy && (
                <span
                  className="inline-flex items-center gap-1"
                  title={`Submitted by ${feature.createdBy}${feature.createdAt ? ' on ' + new Date(feature.createdAt as string).toLocaleString() : ''}`}
                >
                  <User className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[80px]">{feature.createdBy as string}</span>
                </span>
              )}
              {feature.createdAt && (
                <span
                  className="inline-flex items-center gap-1"
                  title={`Submitted ${new Date(feature.createdAt as string).toLocaleString()}`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  {formatRelativeTime(feature.createdAt as string)}
                </span>
              )}
              {feature.assignedTo && (
                <span
                  className="inline-flex items-center gap-1"
                  title={`Assigned to ${feature.assignedTo}`}
                >
                  <Tag className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[80px]">{feature.assignedTo}</span>
                </span>
              )}
              {feature.startedAt && !feature.createdAt && (
                <span
                  className="inline-flex items-center gap-1"
                  title={`Started ${new Date(feature.startedAt).toLocaleString()}`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  {formatRelativeTime(feature.startedAt)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Target Branch Display */}
      {useWorktrees && feature.branchName && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <GitBranch className="w-3 h-3 shrink-0" />
          <span className="font-mono truncate" title={feature.branchName}>
            {feature.branchName}
          </span>
        </div>
      )}

      {/* PR URL Display */}
      {typeof feature.prUrl === 'string' &&
        /^https?:\/\//i.test(feature.prUrl) &&
        (() => {
          const prNumber = feature.prUrl.split('/').pop();
          return (
            <div className="mb-2">
              <a
                href={feature.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-[11px] text-purple-500 hover:text-purple-400 transition-colors"
                title={feature.prUrl}
                data-testid={`pr-url-${feature.id}`}
              >
                <GitPullRequest className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[150px]">
                  {prNumber ? `Pull Request #${prNumber}` : 'Pull Request'}
                </span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            </div>
          );
        })()}
    </>
  );
});
