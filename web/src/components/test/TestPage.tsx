import { useMemo, useState } from 'react';
import { AiTestBuilderModal } from './AiTestBuilderModal.tsx';
import { buildAiCoachingReport } from './aiCoaching.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { NavButton } from '../shared/NavButton.tsx';
import { AttemptComparisonView } from './AttemptComparisonView.tsx';
import { CustomResultDashboard } from './CustomResultDashboard.tsx';
import { CustomTestBuilderModal } from './CustomTestBuilderModal.tsx';
import { FingerDetailView } from './FingerDetailView.tsx';
import { GuidedTestScreen } from './GuidedTestScreen.tsx';
import { ResultsScreen } from './ResultsScreen.tsx';
import { SessionContextView } from './SessionContextView.tsx';
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

  const [view, setView] = useState<TestPageView>('library');
  const [selectedRef, setSelectedRef] = useState<ProtocolRef>({ kind: 'builtin', id: 'standard_max' });
  const [activeProtocol, setActiveProtocol] = useState<TestProtocol | null>(null);
  const [activeTargetKg, setActiveTargetKg] = useState<number | null>(null);
  const [activeOppositeBestPeakKg, setActiveOppositeBestPeakKg] = useState<number | null>(null);
  const [alternateHands, setAlternateHands] = useState(false);
  const [runtimeAlternateHands, setRuntimeAlternateHands] = useState(false);
  const [currentResult, setCurrentResult] = useState<CompletedTestResult | null>(null);
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

  const aiCoachingReport = useMemo(() => {
    if (!settings.aiCoachingEnabled || !currentResult || currentResult.protocolKind !== 'builtin') return null;
    return buildAiCoachingReport(currentResult, profileHistory);
  }, [currentResult, profileHistory, settings.aiCoachingEnabled]);

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

    const oppositeBestPeak = opposite
      ? Math.max(...opposite.attempts.map(attempt => attempt.core.peakTotalKg))
      : null;
    const targetKg = resolveTargetKg(protocol, profileHistory, hand, activeProfile);

    setActiveProtocol(protocol);
    setActiveTargetKg(targetKg);
    setActiveOppositeBestPeakKg(oppositeBestPeak);
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
    setCurrentResult(enrichedResults.find(item => item.hand === hand) ?? enrichedResults[0] ?? null);
    setView('results');
  };

  const resetToLibrary = () => {
    setView('library');
    setActiveProtocol(null);
    setActiveTargetKg(null);
    setActiveOppositeBestPeakKg(null);
    setCurrentResult(null);
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

          {view === 'results' && (
            <ResultsScreen
              result={currentResult}
              aiCoachingReport={aiCoachingReport}
              onOpenComparison={() => setView('compare')}
              onOpenFinger={() => setView('finger')}
              onOpenSession={() => setView('session')}
              onBackToLibrary={resetToLibrary}
            />
          )}
          {view === 'compare' && <AttemptComparisonView result={currentResult} />}
          {view === 'finger' && (
            <FingerDetailView
              result={currentResult}
              oppositeHandResult={oppositeResult}
            />
          )}
          {view === 'session' && (
            <SessionContextView
              currentResult={currentResult}
              sessionResults={sessionResults}
            />
          )}
        </div>
      )}
    </div>
  );
}

