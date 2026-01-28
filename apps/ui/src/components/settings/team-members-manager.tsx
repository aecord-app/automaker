/**
 * AECORD Team Members Manager
 *
 * Admin UI for managing team member accounts.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useTeamMembers, type TeamMember } from '@/hooks/use-team-members';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Shield,
  Loader2,
  Users2,
  Copy,
  Check,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

interface TeamMembersManagerProps {
  className?: string;
}

const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'backend-dev', label: 'Backend Dev' },
  { id: 'frontend-dev', label: 'Frontend Dev' },
  { id: 'devops', label: 'DevOps' },
];

const SERVICE_AREAS = [
  { id: '*', label: 'All Areas' },
  { id: 'aecord-api', label: 'API' },
  { id: 'aecord-web', label: 'Web' },
  { id: 'aecord-mobile', label: 'Mobile' },
  { id: 'infrastructure', label: 'Infrastructure' },
];

interface CredentialsBlock {
  username: string;
  password: string;
}

export function TeamMembersManager({ className }: TeamMembersManagerProps) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const {
    members,
    isLoading,
    addMember,
    updateMember,
    deleteMember,
    resetPassword,
    isAddingMember,
    isResettingPassword,
  } = useTeamMembers();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialsBlock | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'backend-dev',
    serviceAreas: [] as string[],
  });
  const [editData, setEditData] = useState({
    role: '',
    serviceAreas: [] as string[],
    isActive: true,
  });

  const resetForm = () => {
    setFormData({ username: '', email: '', password: '', role: 'backend-dev', serviceAreas: [] });
    setShowAddForm(false);
    setEditingId(null);
    setEditData({ role: '', serviceAreas: [], isActive: true });
  };

  const handleAdd = async () => {
    if (!formData.username || !formData.email || !formData.password) return;

    try {
      await addMember({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        serviceAreas: formData.serviceAreas,
      });
      setCredentials({ username: formData.username, password: formData.password });
      resetForm();
    } catch {
      // Error handled by mutation
    }
  };

  const handleEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setEditData({
      role: member.role,
      serviceAreas: member.serviceAreas || [],
      isActive: member.isActive,
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateMember({
      id: editingId,
      role: editData.role,
      serviceAreas: editData.serviceAreas,
      isActive: editData.isActive,
    });
    resetForm();
  };

  const handleDelete = (member: TeamMember) => {
    if (confirm(`Delete user "${member.username}"? This cannot be undone.`)) {
      deleteMember(member.id);
    }
  };

  const handleResetPassword = async (member: TeamMember) => {
    if (!confirm(`Reset password for "${member.username}"?`)) return;

    try {
      const result = await resetPassword(member.id);
      if (result.success) {
        setCredentials({ username: member.username, password: result.tempPassword });
      }
    } catch {
      // Error handled by mutation
    }
  };

  const copyCredentials = () => {
    if (!credentials) return;
    const text = `Username: ${credentials.username}\nPassword: ${credentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleServiceArea = (areaId: string, target: 'form' | 'edit') => {
    const setter = target === 'form' ? setFormData : setEditData;
    setter((prev: any) => ({
      ...prev,
      serviceAreas: prev.serviceAreas.includes(areaId)
        ? prev.serviceAreas.filter((a: string) => a !== areaId)
        : [...prev.serviceAreas, areaId],
    }));
  };

  if (!isAdmin) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
        <p className="text-muted-foreground">Only administrators can manage team members.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <Loader2 className="w-8 h-8 text-muted-foreground mx-auto mb-4 animate-spin" />
        <p className="text-muted-foreground">Loading team members...</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users2 className="w-5 h-5" />
            Team Members
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user accounts and access for your team
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-brand-500 text-white hover:bg-brand-600 transition-colors'
            )}
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        )}
      </div>

      {/* Credentials Block */}
      {credentials && (
        <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-green-600">Credentials — Share with user</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={copyCredentials}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  'border transition-colors',
                  copied
                    ? 'bg-green-500 text-white border-green-500'
                    : 'border-border hover:bg-accent'
                )}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => {
                  setCredentials(null);
                  setShowPassword(false);
                }}
                className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="font-mono text-sm space-y-1 bg-background/50 p-3 rounded border border-border">
            <div>
              Username: <span className="font-semibold">{credentials.username}</span>
            </div>
            <div>
              Password:{' '}
              <span className="font-semibold">
                {showPassword ? credentials.password : '••••••••••••'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 rounded-lg border border-brand-500/30 bg-brand-500/5">
          <h3 className="text-sm font-semibold mb-4">Add New Member</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="johndoe"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm',
                    'bg-background border border-border',
                    'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="john@example.com"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm',
                    'bg-background border border-border',
                    'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Temporary Password</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Min 8 chars, upper+lower+num+special"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm font-mono',
                    'bg-background border border-border',
                    'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm',
                    'bg-background border border-border',
                    'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
                  )}
                >
                  {ROLES.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Service Areas</label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_AREAS.map((area) => (
                  <button
                    key={area.id}
                    onClick={() => toggleServiceArea(area.id, 'form')}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      formData.serviceAreas.includes(area.id)
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-muted text-muted-foreground border-border hover:border-brand-500/50'
                    )}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleAdd}
                disabled={
                  !formData.username || !formData.email || !formData.password || isAddingMember
                }
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-brand-500 text-white hover:bg-brand-600 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isAddingMember ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Add Member
              </button>
              <button
                onClick={resetForm}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'border border-border hover:bg-accent transition-colors'
                )}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Members ({members.length})</h3>

        {members.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-lg">
            <Users2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No team members yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className={cn(
                  'p-4 rounded-lg border border-border bg-card/50',
                  'hover:border-brand-500/30 transition-colors',
                  !member.isActive && 'opacity-60'
                )}
              >
                {editingId === member.id ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{member.username}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1">Role</label>
                        <select
                          value={editData.role}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, role: e.target.value }))
                          }
                          className={cn(
                            'w-full px-3 py-2 rounded-lg text-sm',
                            'bg-background border border-border',
                            'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
                          )}
                        >
                          {ROLES.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Status</label>
                        <label className="flex items-center gap-2 cursor-pointer mt-2">
                          <div
                            className={cn(
                              'w-5 h-5 rounded border flex items-center justify-center transition-colors',
                              editData.isActive
                                ? 'bg-green-500 border-green-500'
                                : 'bg-muted border-border'
                            )}
                            onClick={() =>
                              setEditData((prev) => ({ ...prev, isActive: !prev.isActive }))
                            }
                          >
                            {editData.isActive && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm">Active</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Service Areas</label>
                      <div className="flex flex-wrap gap-2">
                        {SERVICE_AREAS.map((area) => (
                          <button
                            key={area.id}
                            onClick={() => toggleServiceArea(area.id, 'edit')}
                            className={cn(
                              'px-2 py-1 rounded text-xs font-medium border transition-colors',
                              editData.serviceAreas.includes(area.id)
                                ? 'bg-brand-500 text-white border-brand-500'
                                : 'bg-muted text-muted-foreground border-border hover:border-brand-500/50'
                            )}
                          >
                            {area.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleUpdate}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                          'bg-brand-500 text-white hover:bg-brand-600 transition-colors'
                        )}
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                      <button
                        onClick={resetForm}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                          'border border-border hover:bg-accent transition-colors'
                        )}
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.username}</span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            member.role === 'admin'
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                              : 'bg-brand-500/10 text-brand-500 border border-brand-500/20'
                          )}
                        >
                          {ROLES.find((r) => r.id === member.role)?.label || member.role}
                        </span>
                        {!member.isActive && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{member.email}</p>
                      {member.serviceAreas && member.serviceAreas.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {member.serviceAreas.map((area) => (
                            <span
                              key={area}
                              className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                            >
                              {SERVICE_AREAS.find((a) => a.id === area)?.label || area}
                            </span>
                          ))}
                        </div>
                      )}
                      {member.lastLoginAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last login: {new Date(member.lastLoginAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleResetPassword(member)}
                        disabled={isResettingPassword}
                        className={cn(
                          'p-2 rounded-lg hover:bg-accent transition-colors',
                          'text-muted-foreground hover:text-foreground'
                        )}
                        title="Reset password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(member)}
                        className={cn(
                          'p-2 rounded-lg hover:bg-accent transition-colors',
                          'text-muted-foreground hover:text-foreground'
                        )}
                        title="Edit member"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {member.id !== user?.id && (
                        <button
                          onClick={() => handleDelete(member)}
                          className={cn(
                            'p-2 rounded-lg hover:bg-destructive/10 transition-colors',
                            'text-muted-foreground hover:text-destructive'
                          )}
                          title="Delete member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
