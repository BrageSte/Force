import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../stores/appStore.ts';
import { exportSessionCsv } from '../../storage/sessionStore.ts';
import { loadTestResults } from '../test/testStorage.ts';
import { listTrainingSessions } from '../train/trainStorage.ts';
import { HistoryCompareWorkspace } from './HistoryCompareWorkspace.tsx';
import { HistoryTestAnalysisWorkspace } from './HistoryTestAnalysisWorkspace.tsx';
import { HistoryTestDetailView } from './HistoryTestDetailView.tsx';
import { HistoryTrainDetailView } from './HistoryTrainDetailView.tsx';
import { groupTestResultsBySession, groupTrainSessionsBySession } from './sessionGrouping.ts';
import { NavButton } from '../shared/NavButton.tsx';
import { EmptyState } from '../shared/EmptyState.tsx';
import { formatDateTime } from '../shared/formatDateTime.ts';
import type { PageId } from '../layout/Sidebar.tsx';
import type { CompletedTestResult } from '../test/types.ts';
import type { TrainSessionMeta } from '../train/types.ts';

interface HistoryPageProps {
  onNavigate: (page: PageId) => void;
}

type HistoryView = 'sessions' | 'tests' | 'training';
type TestHistoryView = 'list' | 'compare' | 'analysis' | 'detail';

export function HistoryPage({ onNavigate }: HistoryPageProps) {
  const sessions = useAppStore(s => s.sessions);
  const activeProfile = useAppStore(s => s.profiles.find(profile => profile.profileId === s.activeProfileId) ?? null);
  const refreshSessions = useAppStore(s => s.refreshSessions);
  const loadSession = useAppStore(s => s.loadSession);
  const [view, setView] = useState<HistoryView>('sessions');
  const [testView, setTestView] = useState<TestHistoryView>('list');
  const [selectedTestResultId, setSelectedTestResultId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<CompletedTestResult[]>(() => loadTestResults());
  const [trainingSessions, setTrainingSessions] = useState<TrainSessionMeta[]>([]);
  const [testDetailResults, setTestDetailResults] = useState<CompletedTestResult[] | null>(null);
  const [trainDetailSessionIds, setTrainDetailSessionIds] = useState<string[] | null>(null);

  const filteredSessions = activeProfile
    ? sessions.filter(session => session.profileId === activeProfile.profileId)
    : sessions;
  const filteredTestResults = activeProfile
    ? testResults.filter(result => result.profile?.profileId === activeProfile.profileId)
    : testResults;
  const filteredTrainingSessions = activeProfile
    ? trainingSessions.filter(session => session.profileId === activeProfile.profileId)
    : trainingSessions;

  const testSessionGroups = useMemo(
    () => groupTestResultsBySession(filteredTestResults),
    [filteredTestResults],
  );
  const trainSessionGroups = useMemo(
    () => groupTrainSessionsBySession(filteredTrainingSessions),
    [filteredTrainingSessions],
  );

  useEffect(() => {
    const refresh = async () => {
      await refreshSessions();
      setTestResults(loadTestResults());
      setTrainingSessions(await listTrainingSessions());
    };
    void refresh();
  }, [refreshSessions]);

  const handleLoad = async (id: string) => {
    await loadSession(id);
    onNavigate('session');
  };

  const handleExport = async (id: string) => {
    const session = await useAppStore.getState().loadSession(id);
    if (session) exportSessionCsv(session);
  };

  const handleTestGroupClick = (results: CompletedTestResult[]) => {
    setTestDetailResults(results);
    setTestView('detail');
  };

  const handleTrainGroupClick = (sessionIds: string[]) => {
    setTrainDetailSessionIds(sessionIds);
  };

  // Test detail view
  if (view === 'tests' && testView === 'detail' && testDetailResults) {
    return (
      <div className="h-full flex flex-col gap-4 overflow-auto">
        <HistoryTestDetailView
          results={testDetailResults}
          onBack={() => {
            setTestDetailResults(null);
            setTestView('list');
          }}
        />
      </div>
    );
  }

  // Train detail view
  if (view === 'training' && trainDetailSessionIds) {
    return (
      <div className="h-full flex flex-col gap-4 overflow-auto">
        <HistoryTrainDetailView
          trainSessionIds={trainDetailSessionIds}
          onBack={() => setTrainDetailSessionIds(null)}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">History</h2>
          <p className="text-xs text-muted mt-1">
            Session recordings, saved tests and guided training history for {activeProfile?.name ?? 'the active profile'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NavButton active={view === 'sessions'} onClick={() => setView('sessions')} label="Sessions" />
          <NavButton active={view === 'tests'} onClick={() => setView('tests')} label="Tests" />
          <NavButton active={view === 'training'} onClick={() => setView('training')} label="Training" />
          <button
            onClick={() => void (async () => {
              await refreshSessions();
              setTestResults(loadTestResults());
              setTrainingSessions(await listTrainingSessions());
            })()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-muted hover:text-text border border-border transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {view === 'sessions' && (filteredSessions.length === 0 ? (
        <EmptyState message="No saved sessions for this profile yet. Record a session from the Live page." />
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Hand</th>
                <th className="px-4 py-2.5 text-right">Efforts</th>
                <th className="px-4 py-2.5 text-right">Best Peak</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map(session => (
                <tr key={session.sessionId} className="border-t border-border hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-2.5">
                    {new Date(session.startedAtIso).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{session.hand}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{session.effortsCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{session.bestPeakKg.toFixed(1)} kg</td>
                  <td className="px-4 py-2.5 text-right space-x-2">
                    <button
                      onClick={() => handleLoad(session.sessionId)}
                      className="px-2 py-1 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/20 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleExport(session.sessionId)}
                      className="px-2 py-1 rounded-lg text-xs font-medium bg-surface-alt text-muted hover:text-text transition-colors"
                    >
                      CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {view === 'tests' && (
        <div className="space-y-3">
          <div className="bg-surface rounded-xl border border-border p-2 flex gap-2 flex-wrap">
            <NavButton active={testView === 'list'} onClick={() => setTestView('list')} label="List" />
            <NavButton active={testView === 'compare'} onClick={() => setTestView('compare')} label="Compare" />
            <NavButton active={testView === 'analysis'} onClick={() => setTestView('analysis')} label="Analysis" />
          </div>

          {testView === 'compare' ? (
            <HistoryCompareWorkspace results={filteredTestResults} />
          ) : testView === 'analysis' ? (
            <HistoryTestAnalysisWorkspace
              results={filteredTestResults}
              selectedResultId={selectedTestResultId}
              onSelectResult={setSelectedTestResultId}
            />
          ) : testSessionGroups.length === 0 ? (
            <EmptyState message="No test results for this profile yet." />
          ) : (
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Protocol</th>
                    <th className="px-4 py-2.5 text-left">Hand</th>
                    <th className="px-4 py-2.5 text-right">Peak</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {testSessionGroups.map(group => (
                    <tr
                      key={group.sessionId}
                      onClick={() => handleTestGroupClick(group.results)}
                      className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 text-muted">{formatDateTime(group.startedAtIso)}</td>
                      <td className="px-4 py-2.5">{group.protocolName}</td>
                      <td className="px-4 py-2.5 text-muted">{group.hands}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{group.bestPeak.toFixed(1)} kg</td>
                      <td className="px-4 py-2.5 text-right">
                        {!group.completed && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/10 text-warning border border-warning/30">
                            Incomplete
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'training' && (trainSessionGroups.length === 0 ? (
        <EmptyState message="No guided training sessions for this profile yet." />
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Preset</th>
                <th className="px-4 py-2.5 text-left">Hand</th>
                <th className="px-4 py-2.5 text-right">Completion</th>
                <th className="px-4 py-2.5 text-right">TUT</th>
                <th className="px-4 py-2.5 text-right">Best</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {trainSessionGroups.map(group => (
                <tr
                  key={group.sessionId}
                  onClick={() => handleTrainGroupClick(group.sessions.map(s => s.trainSessionId))}
                  className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5 text-muted">{formatDateTime(group.startedAtIso)}</td>
                  <td className="px-4 py-2.5">{group.presetName}</td>
                  <td className="px-4 py-2.5 text-muted">{group.hands}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{group.completionPct.toFixed(0)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{group.totalTutS.toFixed(0)}s</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{group.bestPeak.toFixed(1)} kg</td>
                  <td className="px-4 py-2.5 text-right">
                    {!group.completed && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/10 text-warning border border-warning/30">
                        Incomplete
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
