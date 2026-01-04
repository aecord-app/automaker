import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings2, AlertCircle } from 'lucide-react';
import { modelSupportsThinking } from '@/lib/utils';
import { Feature, ModelAlias, ThinkingLevel, AIProfile, PlanningMode } from '@/store/app-store';
import {
  ModelSelector,
  ThinkingLevelSelector,
  ProfileQuickSelect,
  TestingTabContent,
  PrioritySelector,
  PlanningModeSelector,
} from '../shared';
import { isCursorModel, PROVIDER_PREFIXES } from '@automaker/types';
import { cn } from '@/lib/utils';

interface MassEditDialogProps {
  open: boolean;
  onClose: () => void;
  selectedFeatures: Feature[];
  onApply: (updates: Partial<Feature>) => Promise<void>;
  showProfilesOnly: boolean;
  aiProfiles: AIProfile[];
}

interface ApplyState {
  model: boolean;
  thinkingLevel: boolean;
  planningMode: boolean;
  requirePlanApproval: boolean;
  priority: boolean;
  skipTests: boolean;
}

function getMixedValues(features: Feature[]): Record<string, boolean> {
  if (features.length === 0) return {};
  const first = features[0];
  return {
    model: !features.every((f) => f.model === first.model),
    thinkingLevel: !features.every((f) => f.thinkingLevel === first.thinkingLevel),
    planningMode: !features.every((f) => f.planningMode === first.planningMode),
    requirePlanApproval: !features.every(
      (f) => f.requirePlanApproval === first.requirePlanApproval
    ),
    priority: !features.every((f) => f.priority === first.priority),
    skipTests: !features.every((f) => f.skipTests === first.skipTests),
  };
}

function getInitialValue<T>(features: Feature[], key: keyof Feature, defaultValue: T): T {
  if (features.length === 0) return defaultValue;
  return (features[0][key] as T) ?? defaultValue;
}

interface FieldWrapperProps {
  label: string;
  isMixed: boolean;
  willApply: boolean;
  onApplyChange: (apply: boolean) => void;
  children: React.ReactNode;
}

function FieldWrapper({ label, isMixed, willApply, onApplyChange, children }: FieldWrapperProps) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-colors',
        willApply ? 'border-brand-500/50 bg-brand-500/5' : 'border-border bg-muted/20'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={willApply}
            onCheckedChange={(checked) => onApplyChange(!!checked)}
            className="data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500"
          />
          <Label
            className="text-sm font-medium cursor-pointer"
            onClick={() => onApplyChange(!willApply)}
          >
            {label}
          </Label>
        </div>
        {isMixed && (
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <AlertCircle className="w-3 h-3" />
            Mixed values
          </span>
        )}
      </div>
      <div className={cn(!willApply && 'opacity-50 pointer-events-none')}>{children}</div>
    </div>
  );
}

export function MassEditDialog({
  open,
  onClose,
  selectedFeatures,
  onApply,
  showProfilesOnly,
  aiProfiles,
}: MassEditDialogProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Track which fields to apply
  const [applyState, setApplyState] = useState<ApplyState>({
    model: false,
    thinkingLevel: false,
    planningMode: false,
    requirePlanApproval: false,
    priority: false,
    skipTests: false,
  });

  // Field values
  const [model, setModel] = useState<ModelAlias>('sonnet');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('none');
  const [planningMode, setPlanningMode] = useState<PlanningMode>('skip');
  const [requirePlanApproval, setRequirePlanApproval] = useState(false);
  const [priority, setPriority] = useState(2);
  const [skipTests, setSkipTests] = useState(false);

  // Calculate mixed values
  const mixedValues = useMemo(() => getMixedValues(selectedFeatures), [selectedFeatures]);

  // Reset state when dialog opens with new features
  useEffect(() => {
    if (open && selectedFeatures.length > 0) {
      setApplyState({
        model: false,
        thinkingLevel: false,
        planningMode: false,
        requirePlanApproval: false,
        priority: false,
        skipTests: false,
      });
      setModel(getInitialValue(selectedFeatures, 'model', 'sonnet') as ModelAlias);
      setThinkingLevel(getInitialValue(selectedFeatures, 'thinkingLevel', 'none') as ThinkingLevel);
      setPlanningMode(getInitialValue(selectedFeatures, 'planningMode', 'skip') as PlanningMode);
      setRequirePlanApproval(getInitialValue(selectedFeatures, 'requirePlanApproval', false));
      setPriority(getInitialValue(selectedFeatures, 'priority', 2));
      setSkipTests(getInitialValue(selectedFeatures, 'skipTests', false));
      setShowAdvancedOptions(false);
    }
  }, [open, selectedFeatures]);

  const handleModelSelect = (newModel: string) => {
    const isCursor = isCursorModel(newModel);
    setModel(newModel as ModelAlias);
    if (isCursor || !modelSupportsThinking(newModel)) {
      setThinkingLevel('none');
    }
  };

  const handleProfileSelect = (profile: AIProfile) => {
    if (profile.provider === 'cursor') {
      const cursorModel = `${PROVIDER_PREFIXES.cursor}${profile.cursorModel || 'auto'}`;
      setModel(cursorModel as ModelAlias);
      setThinkingLevel('none');
    } else {
      setModel((profile.model || 'sonnet') as ModelAlias);
      setThinkingLevel(profile.thinkingLevel || 'none');
    }
    setApplyState((prev) => ({ ...prev, model: true, thinkingLevel: true }));
  };

  const handleApply = async () => {
    const updates: Partial<Feature> = {};

    if (applyState.model) updates.model = model;
    if (applyState.thinkingLevel) updates.thinkingLevel = thinkingLevel;
    if (applyState.planningMode) updates.planningMode = planningMode;
    if (applyState.requirePlanApproval) updates.requirePlanApproval = requirePlanApproval;
    if (applyState.priority) updates.priority = priority;
    if (applyState.skipTests) updates.skipTests = skipTests;

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setIsApplying(true);
    try {
      await onApply(updates);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const hasAnyApply = Object.values(applyState).some(Boolean);
  const isCurrentModelCursor = isCursorModel(model);
  const modelAllowsThinking = !isCurrentModelCursor && modelSupportsThinking(model);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="mass-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit {selectedFeatures.length} Features</DialogTitle>
          <DialogDescription>
            Select which settings to apply to all selected features.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 pr-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Show Advanced Options Toggle */}
          {showProfilesOnly && (
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Simple Mode Active</p>
                <p className="text-xs text-muted-foreground">
                  Only showing AI profiles. Advanced model tweaking is hidden.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                data-testid="mass-edit-show-advanced-toggle"
              >
                <Settings2 className="w-4 h-4 mr-2" />
                {showAdvancedOptions ? 'Hide' : 'Show'} Advanced
              </Button>
            </div>
          )}

          {/* Quick Select Profile Section */}
          {aiProfiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quick Select Profile</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Selecting a profile will automatically enable model settings
              </p>
              <ProfileQuickSelect
                profiles={aiProfiles}
                selectedModel={model}
                selectedThinkingLevel={thinkingLevel}
                selectedCursorModel={isCurrentModelCursor ? model : undefined}
                onSelect={handleProfileSelect}
                testIdPrefix="mass-edit-profile"
              />
            </div>
          )}

          {/* Separator */}
          {aiProfiles.length > 0 && (!showProfilesOnly || showAdvancedOptions) && (
            <div className="border-t border-border" />
          )}

          {/* Model Selection */}
          {(!showProfilesOnly || showAdvancedOptions) && (
            <>
              <FieldWrapper
                label="AI Model"
                isMixed={mixedValues.model}
                willApply={applyState.model}
                onApplyChange={(apply) => setApplyState((prev) => ({ ...prev, model: apply }))}
              >
                <ModelSelector
                  selectedModel={model}
                  onModelSelect={handleModelSelect}
                  testIdPrefix="mass-edit-model"
                />
              </FieldWrapper>

              {modelAllowsThinking && (
                <FieldWrapper
                  label="Thinking Level"
                  isMixed={mixedValues.thinkingLevel}
                  willApply={applyState.thinkingLevel}
                  onApplyChange={(apply) =>
                    setApplyState((prev) => ({ ...prev, thinkingLevel: apply }))
                  }
                >
                  <ThinkingLevelSelector
                    selectedLevel={thinkingLevel}
                    onLevelSelect={setThinkingLevel}
                    testIdPrefix="mass-edit-thinking"
                  />
                </FieldWrapper>
              )}
            </>
          )}

          {/* Separator before options */}
          {(!showProfilesOnly || showAdvancedOptions) && <div className="border-t border-border" />}

          {/* Planning Mode */}
          <FieldWrapper
            label="Planning Mode"
            isMixed={mixedValues.planningMode || mixedValues.requirePlanApproval}
            willApply={applyState.planningMode || applyState.requirePlanApproval}
            onApplyChange={(apply) =>
              setApplyState((prev) => ({
                ...prev,
                planningMode: apply,
                requirePlanApproval: apply,
              }))
            }
          >
            <PlanningModeSelector
              mode={planningMode}
              onModeChange={setPlanningMode}
              requireApproval={requirePlanApproval}
              onRequireApprovalChange={setRequirePlanApproval}
              featureDescription=""
              testIdPrefix="mass-edit"
              compact
            />
          </FieldWrapper>

          {/* Priority */}
          <FieldWrapper
            label="Priority"
            isMixed={mixedValues.priority}
            willApply={applyState.priority}
            onApplyChange={(apply) => setApplyState((prev) => ({ ...prev, priority: apply }))}
          >
            <PrioritySelector
              selectedPriority={priority}
              onPrioritySelect={setPriority}
              testIdPrefix="mass-edit-priority"
            />
          </FieldWrapper>

          {/* Testing */}
          <FieldWrapper
            label="Testing"
            isMixed={mixedValues.skipTests}
            willApply={applyState.skipTests}
            onApplyChange={(apply) => setApplyState((prev) => ({ ...prev, skipTests: apply }))}
          >
            <TestingTabContent
              skipTests={skipTests}
              onSkipTestsChange={setSkipTests}
              testIdPrefix="mass-edit"
            />
          </FieldWrapper>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!hasAnyApply || isApplying}
            loading={isApplying}
            data-testid="mass-edit-apply-button"
          >
            Apply to {selectedFeatures.length} Features
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
