/**
 * Beads Tracker Panel
 *
 * Settings panel showing beads task tracker status, ready issues, and controls.
 */

import { useBeads, type BeadIssue } from '@/hooks/use-beads';
import { CircleDot, RefreshCw, Plus, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

function IssueBadge({ issue }: { issue: BeadIssue }) {
  const priorityColors: Record<number, string> = {
    1: 'bg-red-500/20 text-red-400',
    2: 'bg-orange-500/20 text-orange-400',
    3: 'bg-yellow-500/20 text-yellow-400',
    4: 'bg-green-500/20 text-green-400',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50">
      <div className="flex items-center gap-2 min-w-0">
        <CircleDot className="h-4 w-4 text-blue-400 shrink-0" />
        <span className="text-sm truncate">{issue.title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {issue.labels?.map((label) => (
          <span
            key={label}
            className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
          >
            {label}
          </span>
        ))}
        {issue.priority && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${priorityColors[issue.priority] || 'bg-muted text-muted-foreground'}`}
          >
            P{issue.priority}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{issue.id.slice(0, 8)}</span>
      </div>
    </div>
  );
}

export function BeadsPanel() {
  const {
    available,
    version,
    isStatusLoading,
    readyIssues,
    allIssues,
    isListLoading,
    createIssue,
    isCreating,
    closeIssue,
    sync,
    isSyncing,
  } = useBeads();

  const [newTitle, setNewTitle] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createIssue({ title: newTitle.trim() });
    setNewTitle('');
    setShowCreate(false);
  };

  if (isStatusLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Beads Tracker</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Git-backed task tracking with beads CLI
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Checking beads availability...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Beads Tracker</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Git-backed task tracking with beads CLI
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
        {available ? (
          <>
            <Check className="h-5 w-5 text-green-400" />
            <div>
              <div className="text-sm font-medium">Beads Available</div>
              {version && <div className="text-xs text-muted-foreground">{version}</div>}
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div>
              <div className="text-sm font-medium">Beads Not Available</div>
              <div className="text-xs text-muted-foreground">
                Install <code className="px-1 py-0.5 rounded bg-muted">bd</code> CLI and run{' '}
                <code className="px-1 py-0.5 rounded bg-muted">bd init</code> to enable
              </div>
            </div>
          </>
        )}
      </div>

      {!available && (
        <div className="text-sm text-muted-foreground p-4 rounded-lg border border-dashed border-border/50">
          Beads integration mirrors automaker feature lifecycle events into a git-backed task
          tracker. Issues are created when features start and closed when they complete. Install the
          beads CLI to enable this feature.
        </div>
      )}

      {available && (
        <>
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Issue
            </button>
            <button
              onClick={() => sync()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>

          {/* Create Form */}
          {showCreate && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Issue title..."
                className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={isCreating || !newTitle.trim()}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          )}

          {/* Ready Issues */}
          <div>
            <h3 className="text-sm font-medium mb-2">Ready Issues ({readyIssues.length})</h3>
            {isListLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : readyIssues.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed border-border/50">
                No ready issues
              </div>
            ) : (
              <div className="space-y-2">
                {readyIssues.map((issue) => (
                  <div key={issue.id} className="group relative">
                    <IssueBadge issue={issue} />
                    <button
                      onClick={() => closeIssue(issue.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 px-2 py-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
                    >
                      Close
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Issues */}
          <div>
            <h3 className="text-sm font-medium mb-2">All Issues ({allIssues.length})</h3>
            {isListLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : allIssues.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed border-border/50">
                No issues tracked
              </div>
            ) : (
              <div className="space-y-2">
                {allIssues.map((issue) => (
                  <IssueBadge key={issue.id} issue={issue} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
