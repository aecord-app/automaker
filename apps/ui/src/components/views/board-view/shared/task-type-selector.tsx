import { cn } from '@/lib/utils';
import { Sparkles, Bug, TrendingUp, AlertTriangle } from 'lucide-react';
import type { TaskType } from '@automaker/types';

const TASK_TYPES: { type: TaskType; label: string; icon: typeof Sparkles; activeClass: string }[] =
  [
    {
      type: 'feature',
      label: 'Feature',
      icon: Sparkles,
      activeClass: 'bg-blue-500/20 text-blue-500 border-2 border-blue-500/50',
    },
    {
      type: 'bug',
      label: 'Bug',
      icon: Bug,
      activeClass: 'bg-red-500/20 text-red-500 border-2 border-red-500/50',
    },
    {
      type: 'enhancement',
      label: 'Enhancement',
      icon: TrendingUp,
      activeClass: 'bg-purple-500/20 text-purple-500 border-2 border-purple-500/50',
    },
    {
      type: 'issue',
      label: 'Issue',
      icon: AlertTriangle,
      activeClass: 'bg-orange-500/20 text-orange-500 border-2 border-orange-500/50',
    },
  ];

interface TaskTypeSelectorProps {
  selectedType: TaskType;
  onTypeSelect: (type: TaskType) => void;
  testIdPrefix?: string;
}

export function TaskTypeSelector({
  selectedType,
  onTypeSelect,
  testIdPrefix = 'task-type',
}: TaskTypeSelectorProps) {
  return (
    <div className="flex gap-2">
      {TASK_TYPES.map(({ type, label, icon: Icon, activeClass }) => (
        <button
          key={type}
          type="button"
          onClick={() => onTypeSelect(type)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors',
            selectedType === type
              ? activeClass
              : 'bg-muted/50 text-muted-foreground border border-border hover:bg-muted'
          )}
          data-testid={`${testIdPrefix}-${type}-button`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
