import { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { GameType } from '@/types';
import { useProjectStore } from '@/stores';
import type { WizardState, WizardStep, SelectedStreamer } from './types';
import { WIZARD_STEPS, STEP_TITLES } from './types';
import { GameStep } from './steps/GameStep';
import { StreamersStep } from './steps/StreamersStep';
import { VodUrlsStep } from './steps/VodUrlsStep';
import { FinalizeStep } from './steps/FinalizeStep';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CreateMatchWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (projectId: string) => void;
}

const INITIAL_STATE: WizardState = {
  step: 'game',
  gameType: null,
  customGameId: undefined,
  selectionMode: 'preset',
  selectedPresetId: null,
  selectedStreamers: [],
  projectName: '',
};

export function CreateMatchWizard({
  open,
  onOpenChange,
  onProjectCreated,
}: CreateMatchWizardProps) {
  const { createProjectWithStreamers } = useProjectStore();
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setState(INITIAL_STATE);
    }
    onOpenChange(newOpen);
  };

  // Navigation helpers
  const currentStepIndex = WIZARD_STEPS.indexOf(state.step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  const goToStep = useCallback((step: WizardStep) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < WIZARD_STEPS.length) {
      goToStep(WIZARD_STEPS[nextIndex]);
    }
  }, [currentStepIndex, goToStep]);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(WIZARD_STEPS[prevIndex]);
    }
  }, [currentStepIndex, goToStep]);

  // Validation for each step
  const canProceed = useMemo(() => {
    switch (state.step) {
      case 'game':
        // Can always proceed (game is optional, can skip)
        return true;
      case 'streamers':
        return state.selectedStreamers.length > 0;
      case 'vods':
        // Reference must have URL
        const reference = state.selectedStreamers.find((s) => s.isReference);
        return !!reference?.vodUrl?.trim();
      case 'finalize':
        return state.projectName.trim().length > 0;
      default:
        return false;
    }
  }, [state]);

  // Game selection handlers
  const handleSelectGame = useCallback((gameType: GameType, customGameId?: string) => {
    setState((s) => ({ ...s, gameType, customGameId }));
    goToStep('streamers');
  }, [goToStep]);

  const handleSkipGame = useCallback(() => {
    setState((s) => ({ ...s, gameType: null, customGameId: undefined }));
    goToStep('streamers');
  }, [goToStep]);

  // Streamer selection handlers
  const handleSelectionModeChange = useCallback(
    (mode: 'preset' | 'manual') => {
      setState((s) => ({ ...s, selectionMode: mode }));
    },
    []
  );

  const handlePresetChange = useCallback((presetId: string | null) => {
    setState((s) => ({ ...s, selectedPresetId: presetId }));
  }, []);

  const handleStreamersChange = useCallback((streamers: SelectedStreamer[]) => {
    setState((s) => ({ ...s, selectedStreamers: streamers }));
  }, []);

  // Project name handler
  const handleProjectNameChange = useCallback((name: string) => {
    setState((s) => ({ ...s, projectName: name }));
  }, []);

  // Create project
  const handleCreate = useCallback(() => {
    // Filter out streamers without URLs (except reference which is required)
    const streamersWithUrls = state.selectedStreamers.filter(
      (s) => s.vodUrl?.trim() || s.isReference
    );

    // Ensure reference has URL (validation should prevent this, but double check)
    const reference = streamersWithUrls.find((s) => s.isReference);
    if (!reference?.vodUrl?.trim()) {
      console.error('Reference streamer must have a VOD URL');
      return;
    }

    const projectId = createProjectWithStreamers(
      state.projectName.trim(),
      state.gameType,
      state.customGameId,
      streamersWithUrls.map((s) => ({
        globalStreamerId: s.globalStreamerId,
        name: s.displayName,
        vodUrl: s.vodUrl,
        platform: s.platform,
        isReference: s.isReference,
      }))
    );

    if (projectId) {
      handleOpenChange(false);
      onProjectCreated(projectId);
    }
  }, [state, createProjectWithStreamers, handleOpenChange, onProjectCreated]);

  // Render current step content
  const renderStepContent = () => {
    switch (state.step) {
      case 'game':
        return (
          <GameStep
            selectedGameType={state.gameType}
            selectedCustomGameId={state.customGameId}
            onSelectGame={handleSelectGame}
            onSkip={handleSkipGame}
          />
        );
      case 'streamers':
        return (
          <StreamersStep
            gameType={state.gameType}
            customGameId={state.customGameId}
            selectionMode={state.selectionMode}
            selectedPresetId={state.selectedPresetId}
            selectedStreamers={state.selectedStreamers}
            onSelectionModeChange={handleSelectionModeChange}
            onPresetChange={handlePresetChange}
            onStreamersChange={handleStreamersChange}
          />
        );
      case 'vods':
        return (
          <VodUrlsStep
            streamers={state.selectedStreamers}
            onStreamersChange={handleStreamersChange}
          />
        );
      case 'finalize':
        return (
          <FinalizeStep
            gameType={state.gameType}
            customGameId={state.customGameId}
            streamers={state.selectedStreamers}
            projectName={state.projectName}
            onProjectNameChange={handleProjectNameChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Match</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 pb-4 border-b">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step} className="flex items-center">
              {index > 0 && (
                <div
                  className={`w-8 h-0.5 ${
                    index <= currentStepIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => index < currentStepIndex && goToStep(step)}
                disabled={index > currentStepIndex}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
                  index === currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : index < currentStepIndex
                    ? 'text-primary hover:bg-primary/10 cursor-pointer'
                    : 'text-muted-foreground cursor-not-allowed'
                }`}
              >
                <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">
                  {index + 1}
                </span>
                <span className="hidden sm:inline">{STEP_TITLES[step]}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto py-4">{renderStepContent()}</div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button variant="outline" onClick={goBack}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}

            {isLastStep ? (
              <Button onClick={handleCreate} disabled={!canProceed}>
                Create Match
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canProceed}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
