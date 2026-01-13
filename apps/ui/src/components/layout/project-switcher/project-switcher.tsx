import { useState, useCallback, useEffect } from 'react';
import { Plus, Bug } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { useOSDetection } from '@/hooks/use-os-detection';
import { ProjectSwitcherItem } from './components/project-switcher-item';
import { ProjectContextMenu } from './components/project-context-menu';
import { EditProjectDialog } from './components/edit-project-dialog';
import { NewProjectModal } from '@/components/dialogs/new-project-modal';
import { OnboardingDialog } from '@/components/layout/sidebar/dialogs';
import { useProjectCreation, useProjectTheme } from '@/components/layout/sidebar/hooks';
import type { Project } from '@/lib/electron';
import { getElectronAPI } from '@/lib/electron';

function getOSAbbreviation(os: string): string {
  switch (os) {
    case 'mac':
      return 'M';
    case 'windows':
      return 'W';
    case 'linux':
      return 'L';
    default:
      return '?';
  }
}

export function ProjectSwitcher() {
  const navigate = useNavigate();
  const {
    projects,
    currentProject,
    setCurrentProject,
    trashedProjects,
    upsertAndSetCurrentProject,
  } = useAppStore();
  const [contextMenuProject, setContextMenuProject] = useState<Project | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [editDialogProject, setEditDialogProject] = useState<Project | null>(null);

  // Version info
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  const { os } = useOSDetection();
  const appMode = import.meta.env.VITE_APP_MODE || '?';
  const versionSuffix = `${getOSAbbreviation(os)}${appMode}`;

  // Get global theme for project creation
  const { globalTheme } = useProjectTheme();

  // Project creation state and handlers
  const {
    showNewProjectModal,
    setShowNewProjectModal,
    isCreatingProject,
    showOnboardingDialog,
    setShowOnboardingDialog,
    newProjectName,
    handleCreateBlankProject,
    handleCreateFromTemplate,
    handleCreateFromCustomUrl,
  } = useProjectCreation({
    trashedProjects,
    currentProject,
    globalTheme,
    upsertAndSetCurrentProject,
  });

  const handleContextMenu = (project: Project, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuProject(project);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const handleCloseContextMenu = () => {
    setContextMenuProject(null);
    setContextMenuPosition(null);
  };

  const handleEditProject = (project: Project) => {
    setEditDialogProject(project);
    handleCloseContextMenu();
  };

  const handleProjectClick = useCallback(
    (project: Project) => {
      setCurrentProject(project);
      // Navigate to board view when switching projects
      navigate({ to: '/board' });
    },
    [setCurrentProject, navigate]
  );

  const handleNewProject = () => {
    // Open the new project modal
    setShowNewProjectModal(true);
  };

  const handleOnboardingSkip = () => {
    setShowOnboardingDialog(false);
    navigate({ to: '/board' });
  };

  const handleBugReportClick = useCallback(() => {
    const api = getElectronAPI();
    api.openExternalLink('https://github.com/AutoMaker-Org/automaker/issues');
  }, []);

  // Keyboard shortcuts for project switching (1-9, 0)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ignore if modifier keys are pressed (except for standalone number keys)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // Map key to project index: "1" -> 0, "2" -> 1, ..., "9" -> 8, "0" -> 9
      const key = event.key;
      let projectIndex: number | null = null;

      if (key >= '1' && key <= '9') {
        projectIndex = parseInt(key, 10) - 1; // "1" -> 0, "9" -> 8
      } else if (key === '0') {
        projectIndex = 9; // "0" -> 9
      }

      if (projectIndex !== null && projectIndex < projects.length) {
        const targetProject = projects[projectIndex];
        if (targetProject && targetProject.id !== currentProject?.id) {
          handleProjectClick(targetProject);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projects, currentProject, handleProjectClick]);

  return (
    <>
      <aside
        className={cn(
          'flex-shrink-0 flex flex-col w-16 z-50 relative',
          // Glass morphism background with gradient
          'bg-gradient-to-b from-sidebar/95 via-sidebar/85 to-sidebar/90 backdrop-blur-2xl',
          // Premium border with subtle glow
          'border-r border-border/60 shadow-[1px_0_20px_-5px_rgba(0,0,0,0.1)]'
        )}
        data-testid="project-switcher"
      >
        {/* Automaker Logo and Version */}
        <div className="flex flex-col items-center pt-3 pb-2 px-2">
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="group flex flex-col items-center gap-0.5"
            title="Go to Dashboard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
              role="img"
              aria-label="Automaker Logo"
              className="size-10 group-hover:rotate-12 transition-transform duration-300 ease-out"
            >
              <defs>
                <linearGradient
                  id="bg-switcher"
                  x1="0"
                  y1="0"
                  x2="256"
                  y2="256"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" style={{ stopColor: 'var(--brand-400)' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--brand-600)' }} />
                </linearGradient>
              </defs>
              <rect x="16" y="16" width="224" height="224" rx="56" fill="url(#bg-switcher)" />
              <g
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M92 92 L52 128 L92 164" />
                <path d="M144 72 L116 184" />
                <path d="M164 92 L204 128 L164 164" />
              </g>
            </svg>
            <span className="text-[0.625rem] text-muted-foreground leading-none font-medium">
              v{appVersion} {versionSuffix}
            </span>
          </button>
          <div className="w-full h-px bg-border mt-3" />
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-2">
          {projects.map((project, index) => (
            <ProjectSwitcherItem
              key={project.id}
              project={project}
              isActive={currentProject?.id === project.id}
              hotkeyIndex={index < 10 ? index : undefined}
              onClick={() => handleProjectClick(project)}
              onContextMenu={(e) => handleContextMenu(project, e)}
            />
          ))}

          {/* Horizontal rule and Add Project Button - only show if there are projects */}
          {projects.length > 0 && (
            <>
              <div className="w-full h-px bg-border/40 my-2" />
              <button
                onClick={handleNewProject}
                className={cn(
                  'w-full aspect-square rounded-xl flex items-center justify-center',
                  'transition-all duration-200 ease-out',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-accent/50 border border-transparent hover:border-border/40',
                  'hover:shadow-sm hover:scale-105 active:scale-95'
                )}
                title="New Project"
                data-testid="new-project-button"
              >
                <Plus className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Add Project Button - when no projects, show without rule */}
          {projects.length === 0 && (
            <button
              onClick={handleNewProject}
              className={cn(
                'w-full aspect-square rounded-xl flex items-center justify-center',
                'transition-all duration-200 ease-out',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-accent/50 border border-transparent hover:border-border/40',
                'hover:shadow-sm hover:scale-105 active:scale-95'
              )}
              title="New Project"
              data-testid="new-project-button"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Bug Report Button at the very bottom */}
        <div className="p-2 border-t border-border/40">
          <button
            onClick={handleBugReportClick}
            className={cn(
              'w-full aspect-square rounded-xl flex items-center justify-center',
              'transition-all duration-200 ease-out',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-accent/50 border border-transparent hover:border-border/40',
              'hover:shadow-sm hover:scale-105 active:scale-95'
            )}
            title="Report Bug / Feature Request"
            data-testid="bug-report-button"
          >
            <Bug className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Context Menu */}
      {contextMenuProject && contextMenuPosition && (
        <ProjectContextMenu
          project={contextMenuProject}
          position={contextMenuPosition}
          onClose={handleCloseContextMenu}
          onEdit={handleEditProject}
        />
      )}

      {/* Edit Project Dialog */}
      {editDialogProject && (
        <EditProjectDialog
          project={editDialogProject}
          open={!!editDialogProject}
          onOpenChange={(open) => !open && setEditDialogProject(null)}
        />
      )}

      {/* New Project Modal */}
      <NewProjectModal
        open={showNewProjectModal}
        onOpenChange={setShowNewProjectModal}
        onCreateBlankProject={handleCreateBlankProject}
        onCreateFromTemplate={handleCreateFromTemplate}
        onCreateFromCustomUrl={handleCreateFromCustomUrl}
        isCreating={isCreatingProject}
      />

      {/* Onboarding Dialog */}
      <OnboardingDialog
        open={showOnboardingDialog}
        onOpenChange={setShowOnboardingDialog}
        newProjectName={newProjectName}
        onSkip={handleOnboardingSkip}
        onGenerateSpec={handleOnboardingSkip}
      />
    </>
  );
}
