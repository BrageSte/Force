import { useEffect, useMemo, useState } from 'react';
import {
  benchmarkReferenceSourceDescription,
  benchmarkReferenceSourceLabel,
  type BenchmarkReferenceResolution,
} from '../../profile/benchmarkReferences.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { toProfileSnapshot } from '../../types/profile.ts';
import { capabilityBlockReason, deviceCapabilitiesForSourceKind } from '../../device/capabilityChecks.ts';
import { loadTestResults } from '../test/testStorage.ts';
import type { CompletedTestResult } from '../test/types.ts';
import { AiTrainBuilderModal } from './AiTrainBuilderModal.tsx';
import { CustomTrainBuilderModal } from './CustomTrainBuilderModal.tsx';
import {
  createDefaultCustomTrainWorkout,
  deleteCustomTrainWorkout,
  duplicateCustomTrainWorkout,
  loadCustomTrainWorkouts,
  upsertCustomTrainWorkout,
} from './customTrainStorage.ts';
import { GuidedTrainScreen } from './GuidedTrainScreen.tsx';
import { buildAthleteForceProfile, buildPrescriptionText, buildTrainRecommendations } from './prescriptionEngine.ts';
import { TRAIN_LIBRARY, getTrainProtocolById, isTrainPresetId } from './trainLibrary.ts';
import { TrainResultScreen } from './TrainResultScreen.tsx';
import { listTrainingSessionResults, saveTrainingSession } from './trainStorage.ts';
import { formatCategoryLabel, formatGripSpec, resolveTrainTarget } from './trainUtils.ts';
import type {
  CustomTrainWorkout,
  TrainRecommendation,
  TrainSessionResult,
  TrainTargetMode,
  TrainWorkoutId,
  TrainWorkoutKind,
} from './types.ts';

type TrainPageView = 'library' | 'guided' | 'results';

interface ActiveRunConfig {
  hand: 'Left' | 'Right';
  workoutId: TrainWorkoutId;
  workoutKind: TrainWorkoutKind;
  alternateHands: boolean;
  remainingHand: 'Left' | 'Right' | null;
  targetMode: TrainTargetMode;
  targetKg: number;
  sourceMaxKg: number | null;
  bodyweightRelativeTarget: number | null;
  benchmarkSourceId?: string;
  benchmarkSourceLabel?: string;
  benchmarkReference: BenchmarkReferenceResolution | null;
  profileSnapshot: ReturnType<typeof toProfileSnapshot> | null;
  previousResult: TrainSessionResult | null;
  recommendation: TrainRecommendation | null;
  latestBenchmark: CompletedTestResult | null;
}

function otherHand(hand: 'Left' | 'Right'): 'Left' | 'Right' {
  return hand === 'Left' ? 'Right' : 'Left';
}

interface BuilderState {
  mode: 'create' | 'edit';
  workout: CustomTrainWorkout;
}

export function TrainPage() {
  const hand = useAppStore(s => s.hand);
  const setHand = useAppStore(s => s.setHand);
  const activeProfile = useAppStore(s => s.profiles.find(profile => profile.profileId === s.activeProfileId) ?? null);
  const deviceConnected = useDeviceStore(s => s.connected);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const [view, setView] = useState<TrainPageView>('library');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<TrainWorkoutId>('strength_10s');
  const [selectedWorkoutKind, setSelectedWorkoutKind] = useState<TrainWorkoutKind>('builtin');
  const [testResults, setTestResults] = useState<CompletedTestResult[]>(() => loadTestResults());
  const [trainingResults, setTrainingResults] = useState<TrainSessionResult[]>([]);
  const [customWorkouts, setCustomWorkouts] = useState<CustomTrainWorkout[]>(() => loadCustomTrainWorkouts());
  const [activeRun, setActiveRun] = useState<ActiveRunConfig | null>(null);
  const [currentResult, setCurrentResult] = useState<TrainSessionResult | null>(null);
  const [builderState, setBuilderState] = useState<BuilderState | null>(null);
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
  const [alternateHands, setAlternateHands] = useState(false);

  useEffect(() => {
    const sync = async () => {
      setTestResults(loadTestResults());
      setTrainingResults(await listTrainingSessionResults());
      setCustomWorkouts(loadCustomTrainWorkouts());
    };
    void sync();
  }, [activeProfile?.profileId]);

  const profileTests = useMemo(() => (
    activeProfile
      ? testResults.filter(result => result.profile?.profileId === activeProfile.profileId)
      : []
  ), [activeProfile, testResults]);

  const profileTraining = useMemo(() => (
    activeProfile
      ? trainingResults.filter(result => result.profile?.profileId === activeProfile.profileId)
      : []
  ), [activeProfile, trainingResults]);

  const recommendations = useMemo(
    () => buildTrainRecommendations(profileTests, hand),
    [hand, profileTests],
  );

  const athleteProfile = useMemo(
    () => buildAthleteForceProfile(profileTests, hand),
    [hand, profileTests],
  );

  const selectedWorkout = useMemo(() => {
    if (selectedWorkoutKind === 'builtin' && isTrainPresetId(selectedWorkoutId)) {
      return getTrainProtocolById(selectedWorkoutId);
    }
    return customWorkouts.find(workout => workout.id === selectedWorkoutId) ?? customWorkouts[0] ?? getTrainProtocolById('strength_10s');
  }, [customWorkouts, selectedWorkoutId, selectedWorkoutKind]);

  const selectedRecommendation = useMemo(
    () => recommendations.find(item => item.workoutId === selectedWorkout.id) ?? null,
    [recommendations, selectedWorkout.id],
  );

  const autoTarget = useMemo(
    () => resolveTrainTarget(selectedWorkout, profileTests, hand, activeProfile),
    [activeProfile, hand, profileTests, selectedWorkout],
  );

  const previousMatchingResult = useMemo(() => (
    profileTraining.find(result => result.workoutId === selectedWorkout.id && result.hand === hand) ?? null
  ), [hand, profileTraining, selectedWorkout.id]);

  const latestBenchmark = useMemo(() => {
    const benchmarkId = autoTarget.benchmarkSourceId ?? selectedWorkout.benchmarkSourceId;
    if (!benchmarkId) return null;
    return profileTests
      .filter(result => result.protocolId === benchmarkId && result.hand === hand)
      .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))[0] ?? null;
  }, [autoTarget.benchmarkSourceId, hand, profileTests, selectedWorkout.benchmarkSourceId]);

  const selectedDeviceCapabilities = useMemo(
    () => deviceCapabilitiesForSourceKind(sourceKind),
    [sourceKind],
  );

  const workoutStartBlockReason = useMemo(
    () => capabilityBlockReason(selectedWorkout.capabilityRequirements, selectedDeviceCapabilities),
    [selectedDeviceCapabilities, selectedWorkout.capabilityRequirements],
  );

  const handleStart = (config: Pick<ActiveRunConfig, 'targetMode' | 'targetKg' | 'sourceMaxKg' | 'bodyweightRelativeTarget' | 'benchmarkSourceId' | 'benchmarkSourceLabel' | 'benchmarkReference'>) => {
    if (workoutStartBlockReason) {
      useDeviceStore.getState().addStatus(workoutStartBlockReason);
      return;
    }
    setActiveRun({
      hand,
      workoutId: selectedWorkout.id,
      workoutKind: selectedWorkout.workoutKind,
      alternateHands,
      remainingHand: alternateHands ? otherHand(hand) : null,
      targetMode: config.targetMode,
      targetKg: config.targetKg,
      sourceMaxKg: config.sourceMaxKg,
      bodyweightRelativeTarget: config.bodyweightRelativeTarget,
      benchmarkSourceId: config.benchmarkSourceId,
      benchmarkSourceLabel: config.benchmarkSourceLabel,
      benchmarkReference: config.benchmarkReference,
      profileSnapshot: activeProfile ? toProfileSnapshot(activeProfile) : null,
      previousResult: previousMatchingResult,
      recommendation: selectedRecommendation,
      latestBenchmark,
    });
    setCurrentResult(null);
    setView('guided');
  };

  const handleComplete = async (result: TrainSessionResult) => {
    await saveTrainingSession(result);
    const refreshedResults = await listTrainingSessionResults();
    setTrainingResults(refreshedResults);

    if (activeRun?.alternateHands && activeRun.remainingHand) {
      const nextHand = activeRun.remainingHand;
      const nextPrevious = refreshedResults
        .filter(item => item.profile?.profileId === activeProfile?.profileId && item.workoutId === activeRun.workoutId && item.hand === nextHand)
        .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))[0] ?? null;
      const nextWorkout = activeRun.workoutKind === 'builtin' && isTrainPresetId(activeRun.workoutId)
        ? getTrainProtocolById(activeRun.workoutId)
        : customWorkouts.find(workout => workout.id === activeRun.workoutId) ?? selectedWorkout;
      const nextResolution = resolveTrainTarget(nextWorkout, profileTests, nextHand, activeProfile);
      const nextBenchmarkId = nextResolution.benchmarkSourceId ?? nextWorkout.benchmarkSourceId;
      const nextBenchmark = nextBenchmarkId
        ? profileTests
          .filter(item => item.protocolId === nextBenchmarkId && item.hand === nextHand)
          .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))[0] ?? null
        : null;

      setActiveRun({
        ...activeRun,
        hand: nextHand,
        remainingHand: null,
        targetMode: activeRun.targetMode === 'manual' || activeRun.targetMode === 'auto_from_first_set'
          ? activeRun.targetMode
          : nextResolution.mode,
        targetKg: activeRun.targetMode === 'manual' || activeRun.targetMode === 'auto_from_first_set'
          ? activeRun.targetKg
          : (nextResolution.targetKg ?? 0),
        sourceMaxKg: activeRun.targetMode === 'manual' || activeRun.targetMode === 'auto_from_first_set'
          ? activeRun.sourceMaxKg
          : nextResolution.sourceMaxKg,
        bodyweightRelativeTarget: nextResolution.bodyweightRelativeTarget,
        benchmarkSourceId: nextResolution.benchmarkSourceId,
        benchmarkSourceLabel: nextResolution.benchmarkSourceLabel,
        benchmarkReference: nextResolution.benchmarkReference,
        previousResult: nextPrevious,
        latestBenchmark: nextBenchmark,
      });
      return;
    }

    setCurrentResult(result);
    setView('results');
  };

  const persistCustomWorkout = (workout: CustomTrainWorkout): CustomTrainWorkout => {
    const all = upsertCustomTrainWorkout(workout);
    setCustomWorkouts(all);
    return all.find(item => item.id === workout.id) ?? all[all.length - 1];
  };

  const refreshHistory = async () => {
    setTestResults(loadTestResults());
    setTrainingResults(await listTrainingSessionResults());
    setCustomWorkouts(loadCustomTrainWorkouts());
  };

  if (view === 'guided' && activeRun) {
    const runtimeWorkout = activeRun.workoutKind === 'builtin' && isTrainPresetId(activeRun.workoutId)
      ? getTrainProtocolById(activeRun.workoutId)
      : customWorkouts.find(workout => workout.id === activeRun.workoutId) ?? selectedWorkout;

    return (
      <GuidedTrainScreen
        protocol={runtimeWorkout}
        hand={activeRun.hand}
        profile={activeRun.profileSnapshot}
        targetMode={activeRun.targetMode}
        targetKg={activeRun.targetKg}
        sourceMaxKg={activeRun.sourceMaxKg}
        bodyweightRelativeTarget={activeRun.bodyweightRelativeTarget}
        benchmarkSourceId={activeRun.benchmarkSourceId}
        benchmarkSourceLabel={activeRun.benchmarkSourceLabel}
        benchmarkReference={activeRun.benchmarkReference}
        previousResult={activeRun.previousResult}
        recommendation={activeRun.recommendation}
        latestBenchmark={activeRun.latestBenchmark}
        onComplete={handleComplete}
        onCancel={() => {
          setActiveRun(null);
          setView('library');
        }}
      />
    );
  }

  if (view === 'results' && currentResult) {
    return (
      <TrainResultScreen
        result={currentResult}
        onBackToLibrary={() => {
          setActiveRun(null);
          setCurrentResult(null);
          setView('library');
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Train</h2>
          <p className="text-xs text-muted mt-1">
            Prescription surface for {activeProfile?.name ?? 'the active profile'}. `TEST` benchmarks the hand; `TRAIN` turns that profile into guided work.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setHand('Left')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hand === 'Left' ? 'bg-primary/20 text-primary' : 'bg-surface-alt border border-border text-muted hover:text-text'}`}
          >
            Left Hand
          </button>
          <button
            onClick={() => setHand('Right')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hand === 'Right' ? 'bg-primary/20 text-primary' : 'bg-surface-alt border border-border text-muted hover:text-text'}`}
          >
            Right Hand
          </button>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-3 py-2">
            <input
              type="checkbox"
              checked={alternateHands}
              onChange={e => setAlternateHands(e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-xs font-medium text-text">Alternate Hands</span>
          </label>
          <button onClick={() => setBuilderState({ mode: 'create', workout: createDefaultCustomTrainWorkout() })} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-text">
            New Custom Workout
          </button>
          <button onClick={() => setAiBuilderOpen(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 border border-primary/25 text-primary">
            AI Workout Draft
          </button>
          <button onClick={() => void refreshHistory()} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-muted hover:text-text border border-border transition-colors">
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="space-y-4">
          <RecommendationPanel
            recommendations={recommendations}
            selectedWorkoutId={selectedWorkout.id}
            onSelect={(workoutId, workoutKind) => {
              setSelectedWorkoutId(workoutId);
              setSelectedWorkoutKind(workoutKind);
            }}
          />

          <LibrarySection
            title="Built-In Workouts"
            subtitle={`${TRAIN_LIBRARY.length} benchmark-driven sessions`}
            cards={TRAIN_LIBRARY.map(workout => ({
              id: workout.id,
              kind: 'builtin' as const,
              title: workout.name,
              subtitle: workout.trainingGoal,
              meta: `${formatCategoryLabel(workout.category)} · ${formatGripSpec(workout.gripType, workout.modality)}`,
              structure: describeBlocks(workout.blocks),
              selected: selectedWorkoutKind === 'builtin' && selectedWorkoutId === workout.id,
              recommendation: recommendations.find(item => item.workoutId === workout.id) ?? null,
              latestPeak: profileTraining.find(result => result.workoutId === workout.id && result.hand === hand)?.summary.peakTotalKg ?? null,
            }))}
            onSelect={(id, kind) => {
              setSelectedWorkoutId(id);
              setSelectedWorkoutKind(kind);
            }}
          />

          <LibrarySection
            title="Custom Workouts"
            subtitle={`${customWorkouts.length} saved`}
            emptyMessage="No custom workouts yet. Create one manually or use the AI draft tool."
            cards={customWorkouts.map(workout => ({
              id: workout.id,
              kind: 'custom' as const,
              title: workout.name,
              subtitle: workout.trainingGoal,
              meta: `${formatCategoryLabel(workout.category)} · ${formatGripSpec(workout.gripType, workout.modality)}`,
              structure: describeBlocks(workout.blocks),
              selected: selectedWorkoutKind === 'custom' && selectedWorkoutId === workout.id,
              recommendation: null,
              latestPeak: profileTraining.find(result => result.workoutId === workout.id && result.hand === hand)?.summary.peakTotalKg ?? null,
              customActions: {
                onEdit: () => setBuilderState({ mode: 'edit', workout }),
                onDuplicate: () => setBuilderState({ mode: 'create', workout: duplicateCustomTrainWorkout(workout) }),
                onDelete: () => {
                  if (!window.confirm(`Delete custom workout "${workout.name}"?`)) return;
                  const next = deleteCustomTrainWorkout(workout.id);
                  setCustomWorkouts(next);
                  if (selectedWorkoutKind === 'custom' && selectedWorkoutId === workout.id) {
                    setSelectedWorkoutId('strength_10s');
                    setSelectedWorkoutKind('builtin');
                  }
                },
              },
            }))}
            onSelect={(id, kind) => {
              setSelectedWorkoutId(id);
              setSelectedWorkoutKind(kind);
            }}
          />
        </div>

        <div className="xl:sticky xl:top-4 self-start">
          <TrainSetupPanel
            key={`${selectedWorkoutKind}:${selectedWorkout.id}:${hand}:${autoTarget.targetKg ?? 'none'}`}
            selectedWorkout={selectedWorkout}
            autoTarget={autoTarget}
            previousMatchingResult={previousMatchingResult}
            latestBenchmark={latestBenchmark}
            recommendation={selectedRecommendation}
            athleteProfile={athleteProfile}
            deviceConnected={deviceConnected}
            capabilityBlockReason={workoutStartBlockReason}
            onStart={handleStart}
          />
        </div>
      </div>

      {aiBuilderOpen && (
        <AiTrainBuilderModal
          open={aiBuilderOpen}
          onClose={() => setAiBuilderOpen(false)}
          onUseWorkout={(workout) => {
            setAiBuilderOpen(false);
            setBuilderState({ mode: 'create', workout });
          }}
        />
      )}

      {builderState && (
        <CustomTrainBuilderModal
          key={`${builderState.mode}:${builderState.workout.id}:${builderState.workout.updatedAtIso}`}
          open
          mode={builderState.mode}
          workout={builderState.workout}
          onClose={() => setBuilderState(null)}
          onSave={(workout) => {
            const saved = persistCustomWorkout(workout);
            setSelectedWorkoutId(saved.id);
            setSelectedWorkoutKind('custom');
            setBuilderState(null);
          }}
          onSaveAndStart={(workout) => {
            const saved = persistCustomWorkout(workout);
            setSelectedWorkoutId(saved.id);
            setSelectedWorkoutKind('custom');
            setBuilderState(null);
            const resolution = resolveTrainTarget(saved, profileTests, hand, activeProfile);
            const previous = profileTraining.find(result => result.workoutId === saved.id && result.hand === hand) ?? null;
            const benchmarkId = resolution.benchmarkSourceId ?? saved.benchmarkSourceId;
            const benchmark = benchmarkId
              ? profileTests
                .filter(result => result.protocolId === benchmarkId && result.hand === hand)
                .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))[0] ?? null
              : null;
            if (!resolution.targetKg || resolution.targetKg <= 0) {
              return;
            }
            setActiveRun({
              hand,
              workoutId: saved.id,
              workoutKind: 'custom',
              alternateHands,
              remainingHand: alternateHands ? otherHand(hand) : null,
              targetMode: resolution.mode,
              targetKg: resolution.targetKg,
              sourceMaxKg: resolution.sourceMaxKg,
              bodyweightRelativeTarget: resolution.bodyweightRelativeTarget,
              benchmarkSourceId: resolution.benchmarkSourceId,
              benchmarkSourceLabel: resolution.benchmarkSourceLabel,
              benchmarkReference: resolution.benchmarkReference,
              profileSnapshot: activeProfile ? toProfileSnapshot(activeProfile) : null,
              previousResult: previous,
              recommendation: null,
              latestBenchmark: benchmark,
            });
            setCurrentResult(null);
            setView('guided');
          }}
          onDelete={builderState.mode === 'edit'
            ? (workoutId) => {
                const next = deleteCustomTrainWorkout(workoutId);
                setCustomWorkouts(next);
                setBuilderState(null);
              }
            : undefined}
        />
      )}
    </div>
  );
}

function describeBlocks(blocks: Array<{ label: string; setCount: number; repsPerSet: number; hangSec: number; restBetweenRepsSec: number }>): string {
  return blocks
    .map(block => `${block.label}: ${block.setCount} x ${block.repsPerSet} (${block.hangSec}s/${block.restBetweenRepsSec}s)`)
    .join(' · ');
}

function RecommendationPanel({
  recommendations,
  selectedWorkoutId,
  onSelect,
}: {
  recommendations: TrainRecommendation[];
  selectedWorkoutId: TrainWorkoutId;
  onSelect: (workoutId: TrainWorkoutId, kind: TrainWorkoutKind) => void;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Recommended Next Sessions</h3>
          <p className="text-xs text-muted mt-1">Deterministic prescription based on recent benchmark history for the active hand.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recommendations.map(item => {
          const workout = isTrainPresetId(item.workoutId) ? getTrainProtocolById(item.workoutId) : null;
          if (!workout) return null;
          const active = selectedWorkoutId === item.workoutId;
          return (
            <button
              key={item.workoutId}
              onClick={() => onSelect(item.workoutId, 'builtin')}
              className={`text-left rounded-xl border p-4 transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border bg-surface-alt hover:border-primary/30'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{workout.name}</div>
                  <div className="text-xs text-muted mt-1">{item.reason}</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${item.priority === 'primary' ? 'bg-primary/15 text-primary' : item.priority === 'secondary' ? 'bg-warning/15 text-warning' : 'bg-surface border border-border text-muted'}`}>
                  {item.priority}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted">{buildPrescriptionText(item)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LibrarySection({
  title,
  subtitle,
  cards,
  onSelect,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  cards: Array<{
    id: TrainWorkoutId;
    kind: TrainWorkoutKind;
    title: string;
    subtitle: string;
    meta: string;
    structure: string;
    selected: boolean;
    recommendation: TrainRecommendation | null;
    latestPeak: number | null;
    customActions?: {
      onEdit: () => void;
      onDuplicate: () => void;
      onDelete: () => void;
    };
  }>;
  onSelect: (id: TrainWorkoutId, kind: TrainWorkoutKind) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted">{subtitle}</span>
      </div>
      {cards.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-5 text-sm text-muted">{emptyMessage ?? 'No items yet.'}</div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => (
            <div key={card.id} className={`bg-surface rounded-xl border p-4 transition-colors ${card.selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => onSelect(card.id, card.kind)} className="text-left flex-1">
                  <div className="text-sm font-semibold">{card.title}</div>
                  <div className="text-xs text-muted mt-1">{card.subtitle}</div>
                </button>
                {card.recommendation && (
                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${card.recommendation.priority === 'primary' ? 'bg-primary/15 text-primary' : card.recommendation.priority === 'secondary' ? 'bg-warning/15 text-warning' : 'bg-surface-alt text-muted border border-border'}`}>
                    {card.recommendation.priority}
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-surface-alt rounded-lg px-3 py-2">
                  <div className="text-muted">Context</div>
                  <div className="font-semibold mt-0.5">{card.meta}</div>
                </div>
                <div className="bg-surface-alt rounded-lg px-3 py-2">
                  <div className="text-muted">Last peak</div>
                  <div className="font-semibold mt-0.5">{card.latestPeak !== null ? `${card.latestPeak.toFixed(1)} kg` : 'No prior session'}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted">{card.structure}</div>
              {card.customActions && (
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={card.customActions.onEdit} className="px-2 py-1 rounded-lg text-xs font-medium bg-surface-alt border border-border text-text">Edit</button>
                  <button onClick={card.customActions.onDuplicate} className="px-2 py-1 rounded-lg text-xs font-medium bg-surface-alt border border-border text-text">Duplicate</button>
                  <button onClick={card.customActions.onDelete} className="px-2 py-1 rounded-lg text-xs font-medium bg-danger/15 text-danger border border-danger/25">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainSetupPanel({
  selectedWorkout,
  autoTarget,
  previousMatchingResult,
  latestBenchmark,
  recommendation,
  athleteProfile,
  deviceConnected,
  capabilityBlockReason,
  onStart,
}: {
  selectedWorkout: ReturnType<typeof getTrainProtocolById> | CustomTrainWorkout;
  autoTarget: ReturnType<typeof resolveTrainTarget>;
  previousMatchingResult: TrainSessionResult | null;
  latestBenchmark: CompletedTestResult | null;
  recommendation: TrainRecommendation | null;
  athleteProfile: ReturnType<typeof buildAthleteForceProfile>;
  deviceConnected: boolean;
  capabilityBlockReason: string | null;
  onStart: (config: Pick<ActiveRunConfig, 'targetMode' | 'targetKg' | 'sourceMaxKg' | 'bodyweightRelativeTarget' | 'benchmarkSourceId' | 'benchmarkSourceLabel' | 'benchmarkReference'>) => void;
}) {
  const defaultMode: TrainTargetMode = autoTarget.mode === 'manual' ? 'manual' : autoTarget.mode;
  const [targetMode, setTargetMode] = useState<TrainTargetMode>(defaultMode);
  const [manualTargetKgInput, setManualTargetKgInput] = useState(autoTarget.targetKg?.toFixed(1) ?? '');

  const resolvedTargetKg = useMemo(() => {
    if (targetMode !== 'manual') return autoTarget.targetKg;
    const parsed = Number(manualTargetKgInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [autoTarget.targetKg, manualTargetKgInput, targetMode]);

  const autoReference = autoTarget.benchmarkReference;
  const referenceSummary = autoTarget.sourceMaxKg !== null
    ? autoReference?.effectiveSource
      ? `${autoTarget.sourceMaxKg.toFixed(1)} kg from ${benchmarkReferenceSourceLabel(autoReference.effectiveSource)}`
      : `${autoTarget.sourceMaxKg.toFixed(1)} kg benchmark reference`
    : autoTarget.bodyweightRelativeTarget !== null
      ? `${autoTarget.bodyweightRelativeTarget.toFixed(2)} x bodyweight`
      : targetMode === 'manual' && !manualTargetKgInput.trim()
        ? 'First set will learn target'
        : 'Manual target required';
  const referenceDetail = autoReference?.effectiveSource
    ? `Active reference is ${benchmarkReferenceSourceDescription(autoReference.effectiveSource)}${autoReference.usedFallback ? ' via fallback because the preferred source is missing.' : '.'}`
    : autoTarget.rationale[0];
  const benchmarkSourceValue = autoReference?.effectiveSource
    ? `${autoTarget.benchmarkSourceLabel ?? latestBenchmark?.protocolName ?? 'Benchmark'} · ${benchmarkReferenceSourceLabel(autoReference.effectiveSource)}${autoReference.usedFallback ? ' fallback' : ''}`
    : latestBenchmark
      ? latestBenchmark.protocolName
      : selectedWorkout.benchmarkSourceLabel ?? 'Custom / manual';
  const targetSetupDetail = targetMode === 'manual' && !manualTargetKgInput.trim()
    ? 'Blank manual target means the first set becomes the reference for the rest of the workout.'
    : autoTarget.rationale[0];

  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted">Workout Detail</div>
        <h3 className="text-xl font-semibold mt-1">{selectedWorkout.name}</h3>
        <p className="text-sm text-muted mt-2">{selectedWorkout.trainingGoal}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Metric label="Category" value={formatCategoryLabel(selectedWorkout.category)} />
        <Metric label="Grip / Mode" value={formatGripSpec(selectedWorkout.gripType, selectedWorkout.modality)} />
        <Metric label="Structure" value={describeBlocks(selectedWorkout.blocks)} />
        <Metric label="Athlete Profile" value={athleteProfile.profileType.replaceAll('_', ' ')} />
      </div>

      {recommendation && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="text-sm font-semibold text-primary">Prescription</div>
          <div className="text-xs text-muted mt-1">{recommendation.reason}</div>
          <ul className="mt-2 space-y-1 text-xs text-text">
            {recommendation.rationale.map(line => <li key={line}>- {line}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-surface-alt rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold">Target Setup</div>
            <div className="text-xs text-muted mt-1">
              Auto-target uses benchmark or bodyweight logic when the required profile data exists.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {autoTarget.mode !== 'manual' && (
              <button
                onClick={() => setTargetMode(autoTarget.mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${targetMode === autoTarget.mode ? 'bg-primary/20 text-primary' : 'bg-surface border border-border text-muted hover:text-text'}`}
              >
                {autoTarget.mode === 'bodyweight_relative' ? 'Bodyweight' : 'Auto'}
              </button>
            )}
            <button
              onClick={() => setTargetMode('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${targetMode === 'manual' ? 'bg-primary/20 text-primary' : 'bg-surface border border-border text-muted hover:text-text'}`}
            >
              Manual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs text-muted mb-1.5">Target kg</div>
            <input
              type="number"
              min={0}
              step="0.1"
              value={targetMode === 'manual' ? manualTargetKgInput : (autoTarget.targetKg?.toFixed(1) ?? '')}
              onChange={e => setManualTargetKgInput(e.target.value)}
              disabled={targetMode !== 'manual'}
              className="bg-surface border border-border rounded px-3 py-2 text-sm text-text w-full disabled:opacity-60"
            />
          </label>
          <div className="rounded-lg border border-border bg-surface px-3 py-3">
            <div className="text-xs text-muted">Reference</div>
            <div className="text-sm font-semibold mt-1">
              {referenceSummary}
            </div>
            <div className="text-xs text-muted mt-1">
              {referenceDetail}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Metric label="Benchmark Source" value={benchmarkSourceValue} />
        <Metric label="Previous Matching Session" value={previousMatchingResult ? `${previousMatchingResult.summary.peakTotalKg.toFixed(1)} kg peak` : 'No prior session'} />
      </div>

      <div className="text-xs text-muted space-y-1">
        <div>Source basis: {selectedWorkout.sourceBasis}</div>
        <div>{targetSetupDetail}</div>
        <div>Recovery notes: {(selectedWorkout.recoveryNotes[0] ?? 'None yet')}</div>
      </div>

      <button
        onClick={() => {
          onStart({
            targetMode: targetMode === 'manual' && !manualTargetKgInput.trim() ? 'auto_from_first_set' : targetMode,
            targetKg: resolvedTargetKg ?? 0,
            sourceMaxKg: targetMode === 'auto_from_latest_test' ? autoTarget.sourceMaxKg : null,
            bodyweightRelativeTarget: targetMode === 'bodyweight_relative' ? autoTarget.bodyweightRelativeTarget : null,
            benchmarkSourceId: autoTarget.benchmarkSourceId,
            benchmarkSourceLabel: autoTarget.benchmarkSourceLabel,
            benchmarkReference: targetMode === 'auto_from_latest_test' ? autoTarget.benchmarkReference : null,
          });
        }}
        disabled={!deviceConnected || Boolean(capabilityBlockReason) || (targetMode !== 'manual' && (!resolvedTargetKg || resolvedTargetKg <= 0))}
        className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40"
      >
        Start Guided Workout
      </button>
      {capabilityBlockReason && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning">
          {capabilityBlockReason}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt px-3 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}
