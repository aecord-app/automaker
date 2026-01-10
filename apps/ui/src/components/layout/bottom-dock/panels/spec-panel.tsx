import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Loader2,
  Save,
  Sparkles,
  RefreshCw,
  FilePlus2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { getElectronAPI } from '@/lib/electron';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SpecRegenerationEvent } from '@/types/electron';

// Feature count options
type FeatureCount = 20 | 50 | 100;

const FEATURE_COUNT_OPTIONS: { value: FeatureCount; label: string; warning?: string }[] = [
  { value: 20, label: '20' },
  { value: 50, label: '50', warning: 'May take up to 5 minutes' },
  { value: 100, label: '100', warning: 'May take up to 5 minutes' },
];

const PHASE_LABELS: Record<string, string> = {
  initialization: 'Initializing...',
  setup: 'Setting up tools...',
  analysis: 'Analyzing project...',
  spec_complete: 'Spec created! Generating features...',
  feature_generation: 'Creating features...',
  complete: 'Complete!',
  error: 'Error occurred',
};

const SPEC_FILE_WRITE_DELAY = 500;

export function SpecPanel() {
  const { currentProject, appSpec, setAppSpec } = useAppStore();
  const [specContent, setSpecContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [specExists, setSpecExists] = useState(false);

  // Generation state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [projectOverview, setProjectOverview] = useState('');
  const [projectDefinition, setProjectDefinition] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateFeatures, setGenerateFeatures] = useState(true);
  const [analyzeProject, setAnalyzeProject] = useState(true);
  const [featureCount, setFeatureCount] = useState<FeatureCount>(50);
  const [currentPhase, setCurrentPhase] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const hasChanges = specContent !== originalContent;

  // Load spec from file
  const loadSpec = useCallback(async () => {
    if (!currentProject?.path) return;

    setLoading(true);
    try {
      const api = getElectronAPI();

      // Check if generation is running
      if (api.specRegeneration) {
        const status = await api.specRegeneration.status();
        if (status.success && status.isRunning) {
          setIsGenerating(true);
          if (status.currentPhase) {
            setCurrentPhase(status.currentPhase);
          }
          setLoading(false);
          return;
        }
      }

      // Read the spec file using the correct API
      const specPath = `${currentProject.path}/.automaker/app_spec.txt`;
      const result = await api.readFile(specPath);

      if (result.success && result.content) {
        setSpecContent(result.content);
        setOriginalContent(result.content);
        setAppSpec(result.content);
        setSpecExists(true);
      } else {
        setSpecContent('');
        setOriginalContent('');
        setSpecExists(false);
      }
    } catch (error) {
      console.error('Error loading spec:', error);
      setSpecExists(false);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.path, setAppSpec]);

  useEffect(() => {
    loadSpec();
  }, [loadSpec]);

  // Sync with store
  useEffect(() => {
    if (appSpec && appSpec !== specContent && !hasChanges) {
      setSpecContent(appSpec);
      setOriginalContent(appSpec);
      setSpecExists(true);
    }
  }, [appSpec, specContent, hasChanges]);

  // Subscribe to spec regeneration events
  useEffect(() => {
    if (!currentProject?.path) return;

    const api = getElectronAPI();
    if (!api.specRegeneration) return;

    const unsubscribe = api.specRegeneration.onEvent((event: SpecRegenerationEvent) => {
      if (event.projectPath !== currentProject.path) return;

      if (event.type === 'spec_regeneration_progress') {
        setIsGenerating(true);
        const phaseMatch = event.content.match(/\[Phase:\s*([^\]]+)\]/);
        if (phaseMatch) {
          setCurrentPhase(phaseMatch[1]);
        }
        if (event.content.includes('All tasks completed')) {
          setIsGenerating(false);
          setCurrentPhase('');
          setTimeout(() => loadSpec(), SPEC_FILE_WRITE_DELAY);
        }
      } else if (event.type === 'spec_regeneration_complete') {
        const isFinal =
          event.message?.includes('All tasks completed') ||
          event.message === 'Spec regeneration complete!' ||
          event.message === 'Initial spec creation complete!';

        if (isFinal) {
          setIsGenerating(false);
          setCurrentPhase('');
          setShowCreateDialog(false);
          setShowRegenerateDialog(false);
          setProjectOverview('');
          setProjectDefinition('');
          setErrorMessage('');
          setTimeout(() => loadSpec(), SPEC_FILE_WRITE_DELAY);
          toast.success('Spec Generation Complete', {
            description: 'Your app specification has been saved.',
          });
        }
      } else if (event.type === 'spec_regeneration_error') {
        setIsGenerating(false);
        setCurrentPhase('error');
        setErrorMessage(event.error);
      }
    });

    return () => unsubscribe();
  }, [currentProject?.path, loadSpec]);

  // Save spec
  const handleSave = useCallback(async () => {
    if (!currentProject?.path || !hasChanges) return;

    setSaving(true);
    try {
      const api = getElectronAPI();
      const specPath = `${currentProject.path}/.automaker/app_spec.txt`;
      await api.writeFile(specPath, specContent);
      setOriginalContent(specContent);
      setAppSpec(specContent);
      toast.success('Spec saved');
    } catch (error) {
      toast.error('Failed to save spec');
    } finally {
      setSaving(false);
    }
  }, [currentProject?.path, specContent, hasChanges, setAppSpec]);

  // Create spec
  const handleCreateSpec = useCallback(async () => {
    if (!currentProject?.path || !projectOverview.trim()) return;

    setIsGenerating(true);
    setShowCreateDialog(false);
    setCurrentPhase('initialization');
    setErrorMessage('');

    try {
      const api = getElectronAPI();
      if (!api.specRegeneration) {
        setIsGenerating(false);
        toast.error('Spec generation not available');
        return;
      }

      const result = await api.specRegeneration.create(
        currentProject.path,
        projectOverview.trim(),
        generateFeatures,
        analyzeProject,
        generateFeatures ? featureCount : undefined
      );

      if (!result.success) {
        setIsGenerating(false);
        setCurrentPhase('error');
        setErrorMessage(result.error || 'Failed to create spec');
      }
    } catch (error) {
      setIsGenerating(false);
      setCurrentPhase('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create spec');
    }
  }, [currentProject?.path, projectOverview, generateFeatures, analyzeProject, featureCount]);

  // Regenerate spec
  const handleRegenerate = useCallback(async () => {
    if (!currentProject?.path || !projectDefinition.trim()) return;

    setIsGenerating(true);
    setShowRegenerateDialog(false);
    setCurrentPhase('initialization');
    setErrorMessage('');

    try {
      const api = getElectronAPI();
      if (!api.specRegeneration) {
        setIsGenerating(false);
        toast.error('Spec generation not available');
        return;
      }

      const result = await api.specRegeneration.generate(
        currentProject.path,
        projectDefinition.trim(),
        generateFeatures,
        analyzeProject,
        generateFeatures ? featureCount : undefined
      );

      if (!result.success) {
        setIsGenerating(false);
        setCurrentPhase('error');
        setErrorMessage(result.error || 'Failed to regenerate spec');
      }
    } catch (error) {
      setIsGenerating(false);
      setCurrentPhase('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to regenerate spec');
    }
  }, [currentProject?.path, projectDefinition, generateFeatures, analyzeProject, featureCount]);

  const selectedOption = FEATURE_COUNT_OPTIONS.find((o) => o.value === featureCount);
  const phaseLabel = PHASE_LABELS[currentPhase] || currentPhase;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Generation in progress view
  if (isGenerating) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs font-medium">Generating Spec...</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="mb-4">
              <div className="p-3 rounded-full bg-primary/10 inline-block">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </div>
            <p className="text-sm font-medium mb-2">
              {currentPhase === 'feature_generation'
                ? 'Creating Features...'
                : 'Generating Specification'}
            </p>
            {currentPhase && <p className="text-xs text-muted-foreground">{phaseLabel}</p>}
            {errorMessage && (
              <div className="mt-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-destructive">{errorMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no spec exists
  if (!specExists) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">App Specification</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <FilePlus2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium mb-1">No Spec Found</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create an app specification to help AI understand your project.
            </p>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Create Spec
            </Button>
          </div>
        </div>

        {/* Create Spec Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create App Specification</DialogTitle>
              <DialogDescription>
                Describe your project and we'll generate a comprehensive specification.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Overview</label>
                <Textarea
                  value={projectOverview}
                  onChange={(e) => setProjectOverview(e.target.value)}
                  placeholder="Describe what your project does and what features you want to build..."
                  className="h-32 resize-none font-mono text-sm"
                  autoFocus
                />
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="analyze-project"
                  checked={analyzeProject}
                  onCheckedChange={(checked) => setAnalyzeProject(checked === true)}
                />
                <div className="space-y-0.5">
                  <label htmlFor="analyze-project" className="text-sm font-medium cursor-pointer">
                    Analyze current project
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Research your codebase to understand the tech stack.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="generate-features"
                  checked={generateFeatures}
                  onCheckedChange={(checked) => setGenerateFeatures(checked === true)}
                />
                <div className="space-y-0.5">
                  <label htmlFor="generate-features" className="text-sm font-medium cursor-pointer">
                    Generate feature list
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Automatically create features from the spec.
                  </p>
                </div>
              </div>

              {generateFeatures && (
                <div className="space-y-2 pl-6">
                  <label className="text-sm font-medium">Number of Features</label>
                  <div className="flex gap-2">
                    {FEATURE_COUNT_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={featureCount === option.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFeatureCount(option.value)}
                        className="flex-1"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  {selectedOption?.warning && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {selectedOption.warning}
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSpec} disabled={!projectOverview.trim()}>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Spec
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main view - spec exists
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">App Specification</span>
          {hasChanges && <span className="text-[10px] text-amber-500">Unsaved</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowRegenerateDialog(true)}
            title="Regenerate spec"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-2 overflow-hidden">
        <Textarea
          value={specContent}
          onChange={(e) => setSpecContent(e.target.value)}
          className={cn(
            'h-full w-full resize-none font-mono text-xs',
            'bg-muted/30 border-0 focus-visible:ring-1'
          )}
          placeholder="Enter your app specification..."
        />
      </div>

      {/* Regenerate Spec Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Regenerate App Specification</DialogTitle>
            <DialogDescription>
              We'll regenerate your spec based on your project description.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Describe your project</label>
              <Textarea
                value={projectDefinition}
                onChange={(e) => setProjectDefinition(e.target.value)}
                placeholder="Describe what your app should do..."
                className="h-32 resize-none font-mono text-sm"
                autoFocus
              />
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="regen-analyze-project"
                checked={analyzeProject}
                onCheckedChange={(checked) => setAnalyzeProject(checked === true)}
              />
              <div className="space-y-0.5">
                <label
                  htmlFor="regen-analyze-project"
                  className="text-sm font-medium cursor-pointer"
                >
                  Analyze current project
                </label>
                <p className="text-xs text-muted-foreground">
                  Research your codebase to understand the tech stack.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="regen-generate-features"
                checked={generateFeatures}
                onCheckedChange={(checked) => setGenerateFeatures(checked === true)}
              />
              <div className="space-y-0.5">
                <label
                  htmlFor="regen-generate-features"
                  className="text-sm font-medium cursor-pointer"
                >
                  Generate feature list
                </label>
                <p className="text-xs text-muted-foreground">
                  Automatically create features from the spec.
                </p>
              </div>
            </div>

            {generateFeatures && (
              <div className="space-y-2 pl-6">
                <label className="text-sm font-medium">Number of Features</label>
                <div className="flex gap-2">
                  {FEATURE_COUNT_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={featureCount === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFeatureCount(option.value)}
                      className="flex-1"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                {selectedOption?.warning && (
                  <p className="text-xs text-amber-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedOption.warning}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRegenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRegenerate} disabled={!projectDefinition.trim()}>
              <Sparkles className="w-4 h-4 mr-2" />
              Regenerate Spec
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
