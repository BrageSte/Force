import { useMemo, useState } from 'react';
import { AiTestBuilderModal } from './AiTestBuilderModal.tsx';
import { buildAiCoachingReport } from './aiCoaching.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { BilateralSummaryView } from './BilateralSummaryView.tsx';
import { NavButton } from '../shared/NavButton.tsx';
import { AttemptComparisonView } from './AttemptComparisonView.tsx';
import { CustomResultDashboard } from './CustomResultDashboard.tsx';
import { CustomTestBuilderModal } from './CustomTestBuilderModal.tsx';
import { FingerDetailView } from './FingerDetailView.tsx';
import { GuidedTestScreen } from './GuidedTestScreen.tsx';
import { ResultsScreen } from './ResultsScreen.tsx';
import { SessionContextView } from './SessionContextView.tsx';
import {
  availableAnalysisHandViews,
  buildAnalysisHandContext,
  defaultAnalysisHandView,
  normalizeAnalysisHandView,
  resultForAnalysisHand,
  type AnalysisHandView,
} from './handAnalysis.ts';
import { buildSessionComparison } from './testAnalysis.ts';
import {
  createDefaultCustomTemplate,
  deleteCustomTemplate,
  duplicateCustomTemplate,
  loadCustomTemplates,
  upsertCustomTemplate,
} from './customTestStorage.ts';
import { TEST_LIBRARY, getProtocolById } from './testLibrary.ts';
import {
  findLatestResult,
  findLatestTemplateResult,
  getSessionDateKey,
  listResultsForDate,
  loadTestResults,
  saveTestResults,
} from './testStorage.ts';
import { buildProtocolFromTemplate, resolveAlternateHands, resolveTargetKg } from './testProtocolUtils.ts';
import { TestPicker } from './TestPicker.tsx';
import type {
  CompletedTestResult,
  CustomTestTemplate,
  ProtocolRef,
  TestId,
  TestProtocol,
} from './types.ts';
import { toProfileSnapshot } from '../../types/profile.ts';
import { capabilityBlockReason, deviceCapabilitiesForSourceKind } from '../../device/capabilityChecks.ts';
import { resolveSimulatorAthleteContext } from '../../device/simulatorAthlete.ts';
import type { SimulatorAthleteProfile } from '../../device/simulatorTypes.ts';

type TestPageView = 'library' | 'guided' | 'results' | 'compare' | 'finger' | 'session';

function otherHand(hand: 'Left' | 'Right'): 'Left' | 'Right' {
  return hand === 'Left' ? 'Right' : 'Left';
}

interface BuilderState {
  mode: 'create' | 'edit';
  template: CustomTestTemplate;
}

export function TestPage() {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const hand = useAppStore(s => s.hand);
  const setHand = useAppStore(s => s.setHand);
  const activeProfile = useAppStore(s => s.profiles.find(profile => profile.profileId === s.activeProfileId) ?? null);
  const connected = useDeviceStore(s => s.connected);
  const sourceKind = useDeviceStore(s => s.sourceKind);

  const [view, setView] = useState<TestPageView>('library');
  const [selectedRef, setSelectedRef] = useState<ProtocolRef>({ kind: 'builtin', id: 'standard_max' });
  const [activeProtocol, setActiveProtocol] = useState<TestProtocol | null>(null);
  const [activeTargetKg, setActiveTargetKg] = useState<number | null>(null);
  const [activeOppositeBestPeakKg, setActiveOppositeBestPeakKg] = useState<number | null>(null);
  const [activeSimulatorProfiles, setActiveSimulatorProfiles] = useState<Record<'Left' | 'Right', SimulatorAthleteProfile> | null>(null);
  const [alternateHands, setAlternateHands] = useState(false);
  const [runtimeAlternateHands, setRuntimeAlternateHands] = useState(false);
  const [currentResult, setCurrentResult] = useState<CompletedTestResult | null>(null);
  const [analysisHandPreference, setAnalysisHandPreference] = useState<AnalysisHandView | null>(null);
  const [history, setHistory] = useState<CompletedTestResult[]>(() => loadTestResults());
  const [customTemplates, setCustomTemplates] = useState<CustomTestTemplate[]>(() => loadCustomTemplates());
  const [builderState, setBuilderState] = useState<BuilderState | null>(null);
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);

  const profileHistory = useMemo(() => {
    if (!activeProfile) return [];
    return history.filter(result => result.profile?.profileId === activeProfile.profileId);
  }, [activeProfile, history]);

  const latestByProtocol = useMemo(() => {
    const map: Partial<Record<TestId, CompletedTestResult | null>> = {};
    for (const protocol of TEST_LIBRARY) {
      map[protocol.id as TestId] = findLatestResult(profileHistory, protocol.id, hand);
    }
    return map;
  }, [hand, profileHistory]);

  const latestCustomByTemplateId = useMemo(() => {
    const map: Record<string, CompletedTestResult | null> = {};
    for (const template of customTemplates) {
      map[template.id] = findLatestTemplateResult(profileHistory, template.id, hand);
    }
    return map;
  }, [customTemplates, hand, profileHistory]);

  const sessionResults = useMemo(() => {
    if (!currentResult) return [];
    const dateKey = getSessionDateKey(currentResult.completedAtIso);
    return listResultsForDate(profileHistory, dateKey, currentResult.hand);
  }, [currentResult, profileHistory]);

  const oppositeResult = useMemo(() => {
    if (!currentResult) return null;
    if (currentResult.protocolKind === 'custom' && currentResult.templateId) {
      return findLatestTemplateResult(profileHistory, currentResult.templateId, otherHand(currentResult.hand));
    }
    return findLatestResult(profileHistory, currentResult.protocolId, otherHand(currentResult.hand));
  }, [currentResult, profileHistory]);

  const analysisHandContext = useMemo(
    () => buildAnalysisHandContext(currentResult, oppositeResult),
    [currentResult, oppositeResult],
  );

  const analysisHandViews = useMemo(
    () => availableAnalysisHandViews(analysisHandContext),
    [analysisHandContext],
  );

  const analysisDefaultView = useMemo(
    () => defaultAnalysisHandView(analysisHandContext),
    [analysisHandContext],
  );

  const analysisHandView = useMemo(
    () => normalizeAnalysisHandView(analysisHandPreference ?? analysisDefaultView, analysisHandContext),
    [analysisDefaultView, analysisHandContext, analysisHandPreference],
  );

  const selectedAnalysisResult = useMemo(() => {
    if (analysisHandView === 'both') return null;
    return resultForAnalysisHand(analysisHandView, analysisHandContext);
  }, [analysisHandContext, analysisHandView]);

  const selectedOppositeHandResult = useMemo(() => {
    if (analysisHandView === 'both' || !selectedAnalysisResult) return null;
    return selectedAnalysisResult.hand === 'Left'
      ? analysisHandContext.rightResult
      : analysisHandContext.leftResult;
  }, [analysisHandContext.leftResult, analysisHandContext.rightResult, analysisHandView, selectedAnalysisResult]);

  const selectedSessionResults = useMemo(() => {
    if (!selectedAnalysisResult) return [];
    const dateKey = getSessionDateKey(selectedAnalysisResult.completedAtIso);
    return listResultsForDate(profileHistory, dateKey, selectedAnalysisResult.hand);
  }, [profileHistory, selectedAnalysisResult]);

  const leftSessionResults = useMemo(() => {
    if (!analysisHandContext.leftResult) return [];
    return listResultsForDate(
      profileHistory,
      getSessionDateKey(analysisHandContext.leftResult.completedAtIso),
      'Left',
    );
  }, [analysisHandContext.leftResult, profileHistory]);

  const rightSessionResults = useMemo(() => {
    if (!analysisHandContext.rightResult) return [];
    return listResultsForDate(
      profileHistory,
      getSessionDateKey(analysisHandContext.rightResult.completedAtIso),
      'Right',
    );
  }, [analysisHandContext.rightResult, profileHistory]);

  const selectedAiCoachingReport = useMemo(() => {
    if (!settings.aiCoachingEnabled || !selectedAnalysisResult || selectedAnalysisResult.protocolKind !== 'builtin') return null;
    return buildAiCoachingReport(selectedAnalysisResult, profileHistory);
  }, [profileHistory, selectedAnalysisResult, settings.aiCoachingEnabled]);

  const selectedDeviceCapabilities = useMemo(
    () => deviceCapabilitiesForSourceKind(sourceKind),
    [sourceKind],
  );

  const selectedStartBlockReason = useMemo(() => {
    if (selectedRef.kind === 'builtin') {
      const protocol = getProtocolById(selectedRef.id as TestId);
      return capabilityBlockReason(protocol.capabilityRequirements, selectedDeviceCapabilities);
    }
    const template = customTemplates.find(item => item.id === selectedRef.id);
    return template
      ? capabilityBlockReason(template.capabilityRequirements, selectedDeviceCapabilities)
      : null;
  }, [customTemplates, selectedDeviceCapabilities, selectedRef]);

  const persistTemplate = (template: CustomTestTemplate): CustomTestTemplate => {
    const all = upsertCustomTemplate(template);
    setCustomTemplates(all);
    return all.find(item => item.id === template.id) ?? all[all.length - 1];
  };

  const startGuidedTest = (refOverride?: ProtocolRef, templatesOverride?: CustomTestTemplate[]) => {
    const ref = refOverride ?? selectedRef;
    const templates = templatesOverride ?? customTemplates;

    let protocol: TestProtocol | null = null;
    let opposite: CompletedTestResult | null = null;

    if (ref.kind === 'builtin') {
      protocol = getProtocolById(ref.id as TestId);
      opposite = findLatestResult(profileHistory, protocol.id, otherHand(hand));
    } else {
      const template = templates.find(item => item.id === ref.id);
      if (!template) return;
      protocol = buildProtocolFromTemplate(template);
      opposite = findLatestTemplateResult(profileHistory, template.id, otherHand(hand));
    }

    const blockReason = capabilityBlockReason(protocol.capabilityRequirements, selectedDeviceCapabilities);
    if (blockReason) {
      useDeviceStore.getState().addStatus(blockReason);
      return;
    }

    const oppositeBestPeak = opposite
      ? Math.max(...opposite.attempts.map(attempt => attempt.core.peakTotalKg))
      : null;
    const targetKg = resolveTargetKg(protocol, profileHistory, hand, activeProfile);

    setActiveProtocol(protocol);
    setActiveTargetKg(targetKg);
    setActiveOppositeBestPeakKg(oppositeBestPeak);
    setActiveSimulatorProfiles({
      Left: resolveSimulatorAthleteContext({ profile: activeProfile, results: profileHistory, hand: 'Left' }),
      Right: resolveSimulatorAthleteContext({ profile: activeProfile, results: profileHistory, hand: 'Right' }),
    });
    setRuntimeAlternateHands(resolveAlternateHands(protocol.handMode, alternateHands, protocol.protocolKind));
    setView('guided');
  };

  const handleTestComplete = (result: CompletedTestResult | CompletedTestResult[]) => {
    const nextResults = Array.isArray(result) ? result : [result];
    const historyBeforeSave = loadTestResults();
    const enrichedResults = nextResults.map(item => {
      const previous = item.protocolKind === 'custom' && item.templateId
        ? findLatestTemplateResult(profileHistory, item.templateId, item.hand)
        : findLatestResult(profileHistory, item.protocolId, item.hand);

      return {
        ...item,
        sessionComparison: buildSessionComparison(item, previous),
      };
    });
    const all = [...historyBeforeSave, ...enrichedResults];
    saveTestResults(all);
    setHistory(all);
    const nextCurrentResult = enrichedResults.find(item => item.hand === hand) ?? enrichedResults[0] ?? null;
    setCurrentResult(nextCurrentResult);
    setAnalysisHandPreference(
      nextCurrentResult?.hand === 'Left'
        ? 'left'
        : nextCurrentResult?.hand === 'Right'
          ? 'right'
          : null,
    );
    setView('results');
  };

  const resetToLibrary = () => {
    setView('library');
    setActiveProtocol(null);
    setActiveTargetKg(null);
    setActiveOppositeBestPeakKg(null);
    setActiveSimulatorProfiles(null);
    setCurrentResult(null);
    setAnalysisHandPreference(null);
    setRuntimeAlternateHands(false);
  };

  const openCreateBuilder = () => {
    setBuilderState({
      mode: 'create',
      template: createDefaultCustomTemplate(),
    });
  };

  const openAiBuilder = () => {
    setAiBuilderOpen(true);
  };

  const handleSaveTemplate = (template: CustomTestTemplate) => {
    const saved = persistTemplate(template);
    setSelectedRef({ kind: 'custom', id: saved.id });
    setBuilderState(null);
  };

  const handleSaveTemplateAndStart = (template: CustomTestTemplate) => {
    const saved = persistTemplate(template);
    setSelectedRef({ kind: 'custom', id: saved.id });
    setBuilderState(null);
    window.requestAnimationFrame(() => startGuidedTest({ kind: 'custom', id: saved.id }, loadCustomTemplates()));
  };

  const handleDuplicateTemplate = (template: CustomTestTemplate) => {
    const duplicate = duplicateCustomTemplate(template);
    setBuilderState({ mode: 'create', template: duplicate });
  };

  const handleDeleteTemplate = (template: CustomTestTemplate) => {
    if (!window.confirm(`Delete custom template "${template.name}"?`)) return;
    const next = deleteCustomTemplate(template.id);
    setCustomTemplates(next);
    if (selectedRef.kind === 'custom' && selectedRef.id === template.id) {
      setSelectedRef({ kind: 'builtin', id: 'standard_max' });
    }
  };

  const handleUseAiTemplate = (template: CustomTestTemplate) => {
    setAiBuilderOpen(false);
    setBuilderState({ mode: 'create', template });
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto">
      {view === 'library' && (
        <>
          <TestPicker
            selectedRef={selectedRef}
            onSelect={setSelectedRef}
            onStart={() => startGuidedTest()}
            activeProfileName={activeProfile?.name ?? 'Unknown profile'}
            onOpenAiBuilder={openAiBuilder}
            aiCoachingEnabled={settings.aiCoachingEnabled}
            onToggleAiCoaching={(enabled) => updateSettings({ aiCoachingEnabled: enabled })}
            alternateHands={alternateHands}
            onToggleAlternateHands={setAlternateHands}
            hand={hand}
            onChangeHand={setHand}
            connected={connected}
            latestByProtocol={latestByProtocol}
            customTemplates={customTemplates}
            latestCustomByTemplateId={latestCustomByTemplateId}
            onCreateCustom={openCreateBuilder}
            onEditCustom={(template) => setBuilderState({ mode: 'edit', template })}
            onDuplicateCustom={handleDuplicateTemplate}
          onDeleteCustom={handleDeleteTemplate}
          startDisabledReason={selectedStartBlockReason}
          />

          {aiBuilderOpen && (
            <AiTestBuilderModal
              open={aiBuilderOpen}
              onClose={() => setAiBuilderOpen(false)}
              onUseTemplate={handleUseAiTemplate}
            />
          )}

          {builderState && (
            <CustomTestBuilderModal
              key={`${builderState.mode}:${builderState.template.id}:${builderState.template.version}`}
              open
              mode={builderState.mode}
              template={builderState.template}
              onClose={() => setBuilderState(null)}
              onSave={handleSaveTemplate}
              onSaveAndStart={handleSaveTemplateAndStart}
              onDelete={builderState.mode === 'edit'
                ? (templateId) => {
                    const template = customTemplates.find(item => item.id === templateId);
                    if (template) {
                      handleDeleteTemplate(template);
                      setBuilderState(null);
                    }
                  }
                : undefined}
            />
          )}
        </>
      )}

      {view === 'guided' && activeProtocol && (
        <GuidedTestScreen
          protocol={activeProtocol}
          hand={hand}
          targetKg={activeTargetKg}
          oppositeHandBestPeakKg={activeOppositeBestPeakKg}
          alternateHands={runtimeAlternateHands}
          profile={activeProfile ? toProfileSnapshot(activeProfile) : null}
          simulatorProfiles={activeSimulatorProfiles ?? {
            Left: resolveSimulatorAthleteContext({ profile: activeProfile, results: profileHistory, hand: 'Left' }),
            Right: resolveSimulatorAthleteContext({ profile: activeProfile, results: profileHistory, hand: 'Right' }),
          }}
          onComplete={handleTestComplete}
          onCancel={resetToLibrary}
        />
      )}

      {currentResult && currentResult.protocolKind === 'custom' && view === 'results' && (
        <CustomResultDashboard
          key={currentResult.resultId}
          result={currentResult}
          history={profileHistory}
          oppositeHandResult={oppositeResult}
          sessionResults={sessionResults}
          onBackToLibrary={resetToLibrary}
        />
      )}

      {currentResult && currentResult.protocolKind !== 'custom' && (view === 'results' || view === 'compare' || view === 'finger' || view === 'session') && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border p-2 flex flex-wrap gap-2">
            <NavButton active={view === 'results'} onClick={() => setView('results')} label="Summary" />
            <NavButton active={view === 'compare'} onClick={() => setView('compare')} label="Attempt Comparison" />
            <NavButton active={view === 'finger'} onClick={() => setView('finger')} label="Finger Detail" />
            <NavButton active={view === 'session'} onClick={() => setView('session')} label="Session Context" />
            <div className="flex-1" />
            <button
              onClick={resetToLibrary}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
            >
              New Test
            </button>
          </div>

          <div className="bg-surface rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
            <div className="min-w-[180px]">
              <div className="text-sm font-semibold">Hand Analysis</div>
              <div className="text-xs text-muted mt-1">
                Switch between left, right, or both hands to compare force profiles after the test.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['left', 'right', 'both'] as const).map(option => {
                const available = analysisHandViews.includes(option);
                const label = option === 'left' ? 'Left' : option === 'right' ? 'Right' : 'Both';
                return (
                  <button
                    key={option}
                    onClick={() => available && setAnalysisHandPreference(option)}
                    disabled={!available}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      analysisHandView === option
                        ? 'border-transparent bg-primary text-white'
                        : 'border-border bg-surface-alt text-muted hover:text-text disabled:opacity-40 disabled:hover:text-muted'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex-1" />
            {analysisHandContext.leftResult && (
              <div className="text-[11px] text-muted">
                Left {new Date(analysisHandContext.leftResult.completedAtIso).toLocaleString()}
              </div>
            )}
            {analysisHandContext.rightResult && (
              <div className="text-[11px] text-muted">
                Right {new Date(analysisHandContext.rightResult.completedAtIso).toLocaleString()}
              </div>
            )}
          </div>

          {view === 'results' && analysisHandView === 'both' && analysisHandContext.leftResult && analysisHandContext.rightResult && (
            <BilateralSummaryView
              leftResult={analysisHandContext.leftResult}
              rightResult={analysisHandContext.rightResult}
            />
          )}
          {view === 'results' && analysisHandView !== 'both' && selectedAnalysisResult && (
            <ResultsScreen
              key={selectedAnalysisResult.resultId}
              result={selectedAnalysisResult}
              aiCoachingReport={selectedAiCoachingReport}
              onOpenComparison={() => setView('compare')}
              onOpenFinger={() => setView('finger')}
              onOpenSession={() => setView('session')}
              onBackToLibrary={resetToLibrary}
            />
          )}
          {view === 'compare' && analysisHandView === 'both' && analysisHandContext.leftResult && analysisHandContext.rightResult && (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
              <HandAnalysisPanel result={analysisHandContext.leftResult} description="Latest left-hand attempt analysis for this protocol.">
                <AttemptComparisonView result={analysisHandContext.leftResult} />
              </HandAnalysisPanel>
              <HandAnalysisPanel result={analysisHandContext.rightResult} description="Latest right-hand attempt analysis for this protocol.">
                <AttemptComparisonView result={analysisHandContext.rightResult} />
              </HandAnalysisPanel>
            </div>
          )}
          {view === 'compare' && analysisHandView !== 'both' && selectedAnalysisResult && (
            <AttemptComparisonView key={selectedAnalysisResult.resultId} result={selectedAnalysisResult} />
          )}
          {view === 'finger' && analysisHandView === 'both' && analysisHandContext.leftResult && analysisHandContext.rightResult && (
            <div className="space-y-3">
              <div className="bg-surface rounded-xl border border-border p-4 text-sm text-muted">
                Compare the same anatomical fingers between hands. Each panel keeps its own finger selection, so you can inspect matching fingers side by side.
              </div>
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                <HandAnalysisPanel result={analysisHandContext.leftResult} description="Finger-by-finger detail for the left hand.">
                  <FingerDetailView
                    key={analysisHandContext.leftResult.resultId}
                    result={analysisHandContext.leftResult}
                    oppositeHandResult={analysisHandContext.rightResult}
                  />
                </HandAnalysisPanel>
                <HandAnalysisPanel result={analysisHandContext.rightResult} description="Finger-by-finger detail for the right hand.">
                  <FingerDetailView
                    key={analysisHandContext.rightResult.resultId}
                    result={analysisHandContext.rightResult}
                    oppositeHandResult={analysisHandContext.leftResult}
                  />
                </HandAnalysisPanel>
              </div>
            </div>
          )}
          {view === 'finger' && analysisHandView !== 'both' && selectedAnalysisResult && (
            <FingerDetailView
              key={selectedAnalysisResult.resultId}
              result={selectedAnalysisResult}
              oppositeHandResult={selectedOppositeHandResult}
            />
          )}
          {view === 'session' && analysisHandView === 'both' && analysisHandContext.leftResult && analysisHandContext.rightResult && (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
              <HandAnalysisPanel result={analysisHandContext.leftResult} description="Session context for the left-hand result date.">
                <SessionContextView
                  currentResult={analysisHandContext.leftResult}
                  sessionResults={leftSessionResults}
                />
              </HandAnalysisPanel>
              <HandAnalysisPanel result={analysisHandContext.rightResult} description="Session context for the right-hand result date.">
                <SessionContextView
                  currentResult={analysisHandContext.rightResult}
                  sessionResults={rightSessionResults}
                />
              </HandAnalysisPanel>
            </div>
          )}
          {view === 'session' && analysisHandView !== 'both' && selectedAnalysisResult && (
            <SessionContextView
              key={selectedAnalysisResult.resultId}
              currentResult={selectedAnalysisResult}
              sessionResults={selectedSessionResults}
            />
          )}
        </div>
      )}
    </div>
  );
}

function HandAnalysisPanel({
  result,
  description,
  children,
}: {
  result: CompletedTestResult;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{result.hand} Hand</h3>
            <p className="text-xs text-muted mt-1">{description}</p>
          </div>
          <div className="text-xs text-muted">
            {new Date(result.completedAtIso).toLocaleString()}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
