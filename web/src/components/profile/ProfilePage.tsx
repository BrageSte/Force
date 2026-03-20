import { useEffect, useMemo, useState } from 'react';
import { bestPeakOfResult } from '../test/testAnalysis.ts';
import { listTrainingSessions } from '../train/trainStorage.ts';
import { EmptyState } from '../shared/EmptyState.tsx';
import { formatDateTime } from '../shared/formatDateTime.ts';
import { ProfileBenchmarkReferencesSection } from './ProfileBenchmarkReferencesSection.tsx';
import type { TrainSessionMeta } from '../train/types.ts';
import { ProfileEditorSection } from './ProfileEditorSection.tsx';
import { SetupChecklistCard } from '../shared/SetupChecklistCard.tsx';
import { useSetupReadiness } from '../../setup/useSetupReadiness.ts';
import type { PageId } from '../layout/Sidebar.tsx';

interface ProfilePageProps {
  onNavigate?: (page: PageId) => void;
}

export function ProfilePage({ onNavigate }: ProfilePageProps) {
  const {
    activeProfile,
    profileTestResults,
    readinessReport,
    refreshTestResults,
  } = useSetupReadiness();
  const [trainingSessions, setTrainingSessions] = useState<TrainSessionMeta[]>([]);

  useEffect(() => {
    void listTrainingSessions().then(setTrainingSessions);
  }, []);

  const profileTraining = useMemo(() => (
    activeProfile
      ? trainingSessions.filter(session => session.profileId === activeProfile.profileId)
      : []
  ), [activeProfile, trainingSessions]);

  const latestMaxResult = useMemo(
    () => profileTestResults.find(result => result.protocolId === 'standard_max') ?? null,
    [profileTestResults],
  );

  const latestMaxPeak = latestMaxResult ? bestPeakOfResult(latestMaxResult) : null;
  const injuredCount = activeProfile?.injuredFingers.filter(Boolean).length ?? 0;
  const profileName = activeProfile?.name.trim() || 'Unnamed profile';
  const injurySummary = injuredCount > 0
    ? `${injuredCount} fingers flagged`
    : activeProfile?.injuryNotes.trim()
      ? 'Notes saved'
      : 'No injury flags yet';

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-xs text-muted mt-1">
            Manage person data, injury context and recent test or training history for {activeProfile?.name ?? 'the active profile'}.
          </p>
        </div>
        <button
          onClick={() => {
            refreshTestResults();
            void listTrainingSessions().then(setTrainingSessions);
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-muted hover:text-text border border-border transition-colors"
        >
          Refresh
        </button>
      </div>

      <SetupChecklistCard report={readinessReport} onNavigate={onNavigate} showWhenReady />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Profile Name"
          value={profileName}
          detail={activeProfile?.createdAtIso ? `Created ${formatDateTime(activeProfile.createdAtIso)}` : 'Save a named profile to keep history organized'}
        />
        <StatCard
          label="Body Metrics"
          value={[
            activeProfile?.weightKg !== null && activeProfile?.weightKg !== undefined ? `${activeProfile.weightKg} kg` : null,
            activeProfile?.heightCm !== null && activeProfile?.heightCm !== undefined ? `${activeProfile.heightCm} cm` : null,
          ].filter(Boolean).join(' / ') || 'Not set'}
          detail={`Dominant hand: ${activeProfile?.dominantHand ?? 'Unknown'}`}
        />
        <StatCard
          label="Injury Context"
          value={injurySummary}
          detail={activeProfile?.injuryNotes.trim() ? activeProfile.injuryNotes : 'No injury notes saved'}
        />
        <StatCard
          label="My Numbers"
          value={latestMaxPeak !== null ? `${latestMaxPeak.toFixed(1)} kg` : 'Benchmark missing'}
          detail={latestMaxResult ? `Latest max: ${formatDateTime(latestMaxResult.completedAtIso)}` : 'Run Standard Max in TEST to unlock baseline numbers'}
        />
      </div>

      <ProfileEditorSection />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Recent Tests</h3>
            <p className="text-xs text-muted mt-1">Latest benchmark results for this profile.</p>
          </div>
          {profileTestResults.length === 0 ? (
            <EmptyState message="No test results saved for this profile yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Protocol</th>
                  <th className="px-4 py-2.5 text-left">Hand</th>
                  <th className="px-4 py-2.5 text-right">Peak</th>
                </tr>
              </thead>
              <tbody>
                {profileTestResults.slice(0, 6).map(result => (
                  <tr key={result.resultId} className="border-t border-border">
                    <td className="px-4 py-2.5 text-muted">{formatDateTime(result.completedAtIso)}</td>
                    <td className="px-4 py-2.5">{result.protocolName}</td>
                    <td className="px-4 py-2.5 text-muted">{result.hand}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{bestPeakOfResult(result).toFixed(1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Recent Training</h3>
            <p className="text-xs text-muted mt-1">Saved guided training sessions for this profile.</p>
          </div>
          {profileTraining.length === 0 ? (
            <EmptyState message="No training sessions saved for this profile yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Preset</th>
                  <th className="px-4 py-2.5 text-left">Hand</th>
                  <th className="px-4 py-2.5 text-right">Completion</th>
                </tr>
              </thead>
              <tbody>
                {profileTraining.slice(0, 6).map(session => (
                  <tr key={session.trainSessionId} className="border-t border-border">
                    <td className="px-4 py-2.5 text-muted">{formatDateTime(session.startedAtIso)}</td>
                    <td className="px-4 py-2.5">{session.presetName}</td>
                    <td className="px-4 py-2.5 text-muted">{session.hand}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{session.completionPct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <details className="rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">Benchmark References</h3>
              <p className="mt-1 text-xs text-muted">
                Keep manual benchmark references as a secondary setup surface. Test history remains the preferred source of truth.
              </p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Secondary</span>
          </div>
        </summary>
        <div className="border-t border-border p-4">
          <ProfileBenchmarkReferencesSection
            key={`${activeProfile?.profileId ?? 'none'}:${activeProfile?.updatedAtIso ?? 'none'}`}
            activeProfile={activeProfile}
            testResults={profileTestResults}
          />
        </div>
      </details>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-lg font-semibold text-text mt-2">{value}</div>
      <div className="text-xs text-muted mt-2">{detail}</div>
    </div>
  );
}
