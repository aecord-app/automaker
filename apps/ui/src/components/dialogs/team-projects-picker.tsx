/**
 * AECORD Team Projects Picker
 *
 * Modal for non-admin users to select from admin-configured team projects.
 * Replaces the file browser when filesystem browsing is restricted.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, FolderGit2, AlertCircle, Users, Shield } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useTeamProjects } from '@/hooks/use-team-projects';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

interface TeamProjectsPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string, name: string) => void;
}

export function TeamProjectsPicker({ open, onOpenChange, onSelect }: TeamProjectsPickerProps) {
  const user = useAuthStore((state) => state.user);
  const { projects, isLoading, error } = useTeamProjects();

  const handleSelect = (project: { path: string; name: string }) => {
    onSelect(project.path, project.name);
  };

  const errorMessage = error instanceof Error ? error.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FolderGit2 className="w-5 h-5 text-brand-500" />
            Select Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose from available team projects
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 min-h-[200px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Spinner size="xl" />
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            </div>
          )}

          {errorMessage && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {!isLoading && !errorMessage && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Shield className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No projects available for your role</p>
              <p className="text-xs text-muted-foreground">
                Contact your administrator to get access to projects
              </p>
            </div>
          )}

          {!isLoading && !errorMessage && projects.length > 0 && (
            <div className="space-y-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border border-border',
                    'bg-card hover:bg-card/70 hover:border-brand-500/50',
                    'transition-all duration-200 text-left group'
                  )}
                  data-testid={`team-project-${project.id}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center group-hover:border-brand-500/50 transition-colors shrink-0">
                    <FolderGit2 className="w-5 h-5 text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate group-hover:text-brand-500 transition-colors">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {project.allowedRoles.length === 0
                          ? 'All roles'
                          : project.allowedRoles.join(', ')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
