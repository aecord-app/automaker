// @ts-nocheck
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Bot, Plus, Copy, Trash2, Power, PowerOff, RotateCcw, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import {
  useAgentProfiles,
  useCreateAgentProfile,
  useUpdateAgentProfile,
  useCloneAgentProfile,
  useDeleteAgentProfile,
  useActivateAgentProfile,
  useDeactivateAgentProfile,
  useResetAgentProfiles,
} from '@/hooks/use-agent-profiles';
import type { AgentProfile } from '@automaker/types';

const SPECIALIST_TYPES = [
  'Backend Specialist',
  'Frontend Specialist',
  'Debug Specialist',
  'DevOps Specialist',
  'Optimization Specialist',
  'Triage Specialist',
];

const MODELS = ['sonnet-4.5', 'haiku-4.5', 'opus-4.5', 'sonnet-4', 'haiku-4'];
const PLANNING_MODES = ['spec', 'lite', 'skip'];
const TASK_TYPES = ['feature', 'bug', 'enhancement', 'issue'];

interface EditState {
  open: boolean;
  profile: Partial<AgentProfile> | null;
  isNew: boolean;
}

export function AgentProfilesSection() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const { data: profiles, isLoading } = useAgentProfiles();
  const createMutation = useCreateAgentProfile();
  const updateMutation = useUpdateAgentProfile();
  const cloneMutation = useCloneAgentProfile();
  const deleteMutation = useDeleteAgentProfile();
  const activateMutation = useActivateAgentProfile();
  const deactivateMutation = useDeactivateAgentProfile();
  const resetMutation = useResetAgentProfiles();

  const [editState, setEditState] = useState<EditState>({
    open: false,
    profile: null,
    isNew: false,
  });

  const handleSave = async () => {
    if (!editState.profile) return;
    try {
      if (editState.isNew) {
        await createMutation.mutateAsync(editState.profile);
        toast.success('Profile created');
      } else {
        await updateMutation.mutateAsync(editState.profile as AgentProfile & { id: string });
        toast.success('Profile updated');
      }
      setEditState({ open: false, profile: null, isNew: false });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    }
  };

  const handleClone = async (profile: AgentProfile) => {
    try {
      await cloneMutation.mutateAsync({ id: profile.id, name: `${profile.name} (Copy)` });
      toast.success('Profile cloned');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clone profile');
    }
  };

  const handleDelete = async (profile: AgentProfile) => {
    try {
      await deleteMutation.mutateAsync({ id: profile.id });
      toast.success('Profile deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete profile');
    }
  };

  const handleToggleActive = async (profile: AgentProfile) => {
    try {
      if (profile.isActive) {
        await deactivateMutation.mutateAsync(profile.id);
        toast.success('Profile deactivated');
      } else {
        await activateMutation.mutateAsync(profile.id);
        toast.success('Profile activated');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle profile');
    }
  };

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync();
      toast.success('Profiles reset to defaults');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset profiles');
    }
  };

  const updateField = (field: string, value: any) => {
    setEditState((prev) => ({
      ...prev,
      profile: { ...prev.profile, [field]: value },
    }));
  };

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'border border-border/50',
        'bg-gradient-to-br from-card/80 via-card/70 to-card/80 backdrop-blur-xl',
        'shadow-sm'
      )}
    >
      <div className="p-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Agent Profiles
              </h2>
            </div>
            <p className="text-sm text-muted-foreground/80 ml-12">
              Configure AI agent profiles for different task types.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={resetMutation.isPending}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset to Defaults
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setEditState({
                    open: true,
                    isNew: true,
                    profile: {
                      name: '',
                      specialist: '',
                      model: 'sonnet-4.5',
                      planningMode: 'spec',
                      taskTypes: [],
                      systemPromptTemplate: '',
                      isActive: true,
                    },
                  })
                }
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create Profile
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading profiles...</p>}

        {profiles?.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">No agent profiles configured.</p>
        )}

        {profiles?.map((profile) => (
          <div
            key={profile.id}
            className={cn(
              'flex items-center justify-between gap-4 p-4 rounded-xl border border-border/30',
              profile.isActive ? 'bg-muted/30' : 'bg-muted/10 opacity-60'
            )}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={cn(
                  'w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 border',
                  profile.isActive
                    ? 'from-primary/20 to-primary/10 border-primary/20'
                    : 'from-muted/50 to-muted/30 border-border/30'
                )}
              >
                <Bot
                  className={cn(
                    'w-5 h-5',
                    profile.isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">{profile.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground/70">{profile.specialist}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                    {profile.model}
                  </span>
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      profile.isActive
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-muted/50 text-muted-foreground'
                    )}
                  >
                    {profile.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setEditState({ open: true, profile: { ...profile }, isNew: false })
                  }
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleClone(profile)}
                  title="Clone"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleToggleActive(profile)}
                  title={profile.isActive ? 'Deactivate' : 'Activate'}
                >
                  {profile.isActive ? (
                    <PowerOff className="w-3.5 h-3.5" />
                  ) : (
                    <Power className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(profile)}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog
        open={editState.open}
        onOpenChange={(open) => !open && setEditState({ open: false, profile: null, isNew: false })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editState.isNew ? 'Create Agent Profile' : 'Edit Agent Profile'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editState.profile?.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Backend Specialist"
              />
            </div>
            <div className="space-y-2">
              <Label>Specialist Type</Label>
              <Select
                value={editState.profile?.specialist || ''}
                onValueChange={(v) => updateField('specialist', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select specialist" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALIST_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select
                  value={editState.profile?.model || 'sonnet-4.5'}
                  onValueChange={(v) => updateField('model', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Planning Mode</Label>
                <Select
                  value={editState.profile?.planningMode || 'spec'}
                  onValueChange={(v) => updateField('planningMode', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANNING_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Task Types</Label>
              <div className="flex flex-wrap gap-2">
                {TASK_TYPES.map((type) => {
                  const selected = editState.profile?.taskTypes?.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const current = editState.profile?.taskTypes || [];
                        updateField(
                          'taskTypes',
                          selected ? current.filter((t: string) => t !== type) : [...current, type]
                        );
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        selected
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>System Prompt Template</Label>
              <Textarea
                value={editState.profile?.systemPromptTemplate || ''}
                onChange={(e) => updateField('systemPromptTemplate', e.target.value)}
                placeholder="Custom system prompt for this agent profile..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditState({ open: false, profile: null, isNew: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                createMutation.isPending || updateMutation.isPending || !editState.profile?.name
              }
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
