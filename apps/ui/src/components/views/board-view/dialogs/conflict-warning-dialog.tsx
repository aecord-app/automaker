// @ts-nocheck
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Shield, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

interface ConflictInfo {
  file: string;
  lockedBy: {
    featureId: string;
    featureTitle?: string;
    userId?: string;
    username?: string;
  };
  lockType?: string;
  expiresAt?: string;
}

interface ConflictWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictInfo[];
  featureTitle?: string;
  onQueue: () => void;
  onForceStart: () => void;
  onCancel: () => void;
}

export function ConflictWarningDialog({
  open,
  onOpenChange,
  conflicts,
  featureTitle,
  onQueue,
  onForceStart,
  onCancel,
}: ConflictWarningDialogProps) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="w-5 h-5" />
            File Conflicts Detected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {featureTitle && (
            <p className="text-sm text-muted-foreground">
              Starting <span className="font-medium text-foreground">{featureTitle}</span> would
              conflict with files locked by other features:
            </p>
          )}

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {conflicts.map((conflict, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
              >
                <FileWarning className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono truncate">{conflict.file}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>
                      Locked by:{' '}
                      <span className="text-foreground">
                        {conflict.lockedBy.featureTitle || conflict.lockedBy.featureId}
                      </span>
                    </span>
                    {conflict.lockedBy.username && (
                      <span className="text-muted-foreground/70">
                        ({conflict.lockedBy.username})
                      </span>
                    )}
                  </div>
                  {conflict.expiresAt && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Expires: {new Date(conflict.expiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onQueue} className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Queue Task
          </Button>
          {isAdmin && (
            <Button
              variant="destructive"
              onClick={onForceStart}
              className="flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              Force Start
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
