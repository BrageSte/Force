import { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/appStore.ts';
import { exportSessionCsv } from '../../storage/sessionStore.ts';
import { loadTestResults } from '../test/testStorage.ts';
import { bestPeakOfResult } from '../test/testAnalysis.ts';
import { listTrainingSessions } from '../train/trainStorage.ts';
import { HistoryCompareWorkspace } from './HistoryCompareWorkspace.tsx';
import { HistoryTestAnalysisWorkspace } from './HistoryTestAnalysisWorkspace.tsx';
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
type TestHistoryView = 'list' | 'compare' | 'analysis';

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

  const filteredSessions = activeProfile
    ? sessions.filter(session => session.profileId === activeProfile.profileId)
    : sessions;
  const filteredTestResults = activeProfile
    ? testResults.filter(result => result.profile?.profileId === activeProfile.profileId)
    : testResults;
  const filteredTrainingSessions = activeProfile
    ? trainingSessions.filter(session => session.profileId === activeProfile.profileId)
    : trainingSessions;

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
          ) : filteredTestResults.length === 0 ? (
            <EmptyState message="No test results for this profile yet." />
          ) : (
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Protocol</th>
                    <th className="px-4 py-2.5 text-left">Hand</th>
                    <th className="px-4 py-2.5 text-right">Target</th>
                    <th className="px-4 py-2.5 text-right">Peak</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTestResults.map(result => (
                    <tr key={result.resultId} className="border-t border-border hover:bg-surface-alt transition-colors">
                      <td className="px-4 py-2.5 text-muted">{formatDateTime(result.completedAtIso)}</td>
                      <td className="px-4 py-2.5">{result.protocolName}</td>
                      <td className="px-4 py-2.5 text-muted">{result.hand}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{result.targetKg ? `${result.targetKg.toFixed(1)} kg` : 'n/a'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{bestPeakOfResult(result).toFixed(1)} kg</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedTestResultId(result.resultId);
                            setTestView('analysis');
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/20 transition-colors"
                        >
                          Analyze
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'training' && (filteredTrainingSessions.length === 0 ? (
        <EmptyState message="No guided training sessions for this profile yet." />
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Preset</th>
                <th className="px-4 py-2.5 text-left">Hand</th>
                <th className="px-4 py-2.5 text-right">Target</th>
                <th className="px-4 py-2.5 text-right">Completion</th>
                <th className="px-4 py-2.5 text-right">TUT</th>
                <th className="px-4 py-2.5 text-right">Best</th>
                <th className="px-4 py-2.5 text-right">Avg</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrainingSessions.map(session => (
                <tr key={session.trainSessionId} className="border-t border-border hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-2.5 text-muted">{formatDateTime(session.startedAtIso)}</td>
                  <td className="px-4 py-2.5">{session.presetName}</td>
                  <td className="px-4 py-2.5 text-muted">{session.hand}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{session.targetKg.toFixed(1)} kg</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{session.completionPct.toFixed(0)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{session.totalTutS.toFixed(0)}s</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{session.peakTotalKg.toFixed(1)} kg</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{session.avgHoldKg.toFixed(1)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
