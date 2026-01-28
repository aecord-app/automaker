/**
 * AECORD Team Projects Manager
 *
 * Admin UI for configuring team projects that all users can access.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useTeamProjects, type TeamProject } from '@/hooks/use-team-projects';
import {
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Shield,
  Loader2,
  Users,
  Info,
  Check,
  FolderGit2,
  AlertTriangle,
  Power,
} from 'lucide-react';

interface TeamProjectsManagerProps {
  className?: string;
}

const ROLES = [
  { id: 'backend-dev', label: 'Backend Dev' },
  { id: 'frontend-dev', label: 'Frontend Dev' },
  { id: 'devops', label: 'DevOps' },
];

export function TeamProjectsManager({ className }: TeamProjectsManagerProps) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const {
    projects,
    settings,
    isLoading,
    canBrowseFilesystem,
    addProject,
    updateProject,
    removeProject,
    updateSettings,
    isAddingProject,
  } = useTeamProjects();

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    description: '',
    allowedRoles: [] as string[],
  });

  const resetForm = () => {
    setFormData({ name: '', path: '', description: '', allowedRoles: [] });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!formData.name || !formData.path) return;

    addProject({
      name: formData.name,
      path: formData.path,
      description: formData.description,
      allowedRoles: formData.allowedRoles,
    });
    resetForm();
  };

  const handleEdit = (project: TeamProject) => {
    setEditingId(project.id);
    setFormData({
      name: project.name,
      path: project.path,
      description: project.description || '',
      allowedRoles: project.allowedRoles || [],
    });
  };

  const handleUpdate = () => {
    if (!editingId || !formData.name || !formData.path) return;

    updateProject({
      id: editingId,
      name: formData.name,
      path: formData.path,
      description: formData.description,
      allowedRoles: formData.allowedRoles,
    });
    resetForm();
  };

  const handleRemove = (id: string) => {
    if (confirm('Are you sure you want to remove this project from the team list?')) {
      removeProject(id);
    }
  };

  const toggleRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedRoles: prev.allowedRoles.includes(roleId)
        ? prev.allowedRoles.filter((r) => r !== roleId)
        : [...prev.allowedRoles, roleId],
    }));
  };

  if (!isAdmin) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
        <p className="text-muted-foreground">Only administrators can manage team projects.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <Loader2 className="w-8 h-8 text-muted-foreground mx-auto mb-4 animate-spin" />
        <p className="text-muted-foreground">Loading team projects...</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FolderGit2 className="w-5 h-5" />
            Team Projects
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure projects that team members can access
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-brand-500 text-white',
              'hover:bg-brand-600 transition-colors'
            )}
          >
            <Plus className="w-4 h-4" />
            Add Project
          </button>
        )}
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-500">Centralized Project Access</p>
          <p className="text-muted-foreground mt-1">
            Projects added here will be available to team members based on their role. Non-admin
            users will only see these projects instead of browsing the filesystem.
          </p>
        </div>
      </div>

      {/* Server Access Control */}
      <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Power className="w-4 h-4 text-destructive" />
          Server Access Control
        </h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={cn(
              'w-5 h-5 rounded border flex items-center justify-center transition-colors',
              settings.allowNonAdminAccess !== false
                ? 'bg-green-500 border-green-500'
                : 'bg-destructive border-destructive'
            )}
            onClick={() =>
              updateSettings({ allowNonAdminAccess: settings.allowNonAdminAccess === false })
            }
          >
            {settings.allowNonAdminAccess !== false && <Check className="w-3 h-3 text-white" />}
          </div>
          <div>
            <span className="text-sm font-medium">Allow non-admin users to access server</span>
            <p className="text-xs text-muted-foreground">
              When disabled, only admin users can access the server. Use this to lock out all
              non-admin users.
            </p>
          </div>
        </label>
        {settings.allowNonAdminAccess === false && (
          <div className="mt-3 flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              Server access is currently disabled for non-admin users. They will see an error
              message when trying to use the application.
            </p>
          </div>
        )}
      </div>

      {/* Filesystem Access Settings */}
      <div className="p-4 rounded-lg border border-border bg-card/50">
        <h3 className="text-sm font-semibold mb-3">Filesystem Access Settings</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={cn(
              'w-5 h-5 rounded border flex items-center justify-center transition-colors',
              settings.allowNonAdminBrowse
                ? 'bg-brand-500 border-brand-500'
                : 'bg-muted border-border'
            )}
            onClick={() => updateSettings({ allowNonAdminBrowse: !settings.allowNonAdminBrowse })}
          >
            {settings.allowNonAdminBrowse && <Check className="w-3 h-3 text-white" />}
          </div>
          <div>
            <span className="text-sm font-medium">Allow non-admin users to browse filesystem</span>
            <p className="text-xs text-muted-foreground">
              When disabled, non-admins can only access projects listed below
            </p>
          </div>
        </label>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <div className="p-4 rounded-lg border border-brand-500/30 bg-brand-500/5">
          <h3 className="text-sm font-semibold mb-4">
            {editingId ? 'Edit Project' : 'Add New Project'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="AECORD"
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-background border border-border',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Project Path</label>
              <input
                type="text"
                value={formData.path}
                onChange={(e) => setFormData((prev) => ({ ...prev, path: e.target.value }))}
                placeholder="/Users/admin/Library/CloudStorage/OneDrive-NDC/aecord"
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm font-mono',
                  'bg-background border border-border',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Main AECORD marketplace project"
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-background border border-border',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Allowed Roles (empty = all roles)
              </label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => toggleRole(role.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium',
                      'border transition-colors',
                      formData.allowedRoles.includes(role.id)
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-muted text-muted-foreground border-border hover:border-brand-500/50'
                    )}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.allowedRoles.length === 0
                  ? 'All team members can access this project'
                  : `Only ${formData.allowedRoles.join(', ')} can access this project`}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={editingId ? handleUpdate : handleAdd}
                disabled={!formData.name || !formData.path || isAddingProject}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-brand-500 text-white',
                  'hover:bg-brand-600 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isAddingProject ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingId ? 'Update' : 'Add'} Project
              </button>
              <button
                onClick={resetForm}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'border border-border',
                  'hover:bg-accent transition-colors'
                )}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Configured Projects ({projects.length})
        </h3>

        {projects.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-lg">
            <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No team projects configured yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add projects above to make them available to team members
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className={cn(
                  'p-4 rounded-lg border border-border bg-card/50',
                  'hover:border-brand-500/30 transition-colors'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-brand-500" />
                      <span className="font-medium">{project.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{project.path}</p>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {project.allowedRoles.length === 0
                          ? 'All roles'
                          : project.allowedRoles.join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(project)}
                      className={cn(
                        'p-2 rounded-lg',
                        'hover:bg-accent transition-colors',
                        'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(project.id)}
                      className={cn(
                        'p-2 rounded-lg',
                        'hover:bg-destructive/10 transition-colors',
                        'text-muted-foreground hover:text-destructive'
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
