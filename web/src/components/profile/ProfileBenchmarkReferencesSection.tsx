import { useMemo, useState } from 'react';
import {
  benchmarkReferenceSourceLabel,
  resolveBenchmarkReference,
  type BenchmarkReferenceResolution,
} from '../../profile/benchmarkReferences.ts';
import { useAppStore } from '../../stores/appStore.ts';
import type { Hand } from '../../types/force.ts';
import {
  cloneBenchmarkReferences,
  createEmptyBenchmarkReferenceByHand,
  type UserProfile,
  type BenchmarkReferenceMap,
  type BenchmarkReferenceSource,
} from '../../types/profile.ts';
import { Section } from '../shared/Section.tsx';
import { formatDateTime } from '../shared/formatDateTime.ts';
import { benchmarkCategoryLabel } from '../test/testConfig.ts';
import { TEST_LIBRARY } from '../test/testLibrary.ts';
import type { CompletedTestResult } from '../test/types.ts';

const HANDS: Hand[] = ['Left', 'Right'];

interface ProfileBenchmarkReferencesSectionProps {
  activeProfile: UserProfile | null;
  testResults: CompletedTestResult[];
}

export function ProfileBenchmarkReferencesSection({ activeProfile, testResults }: ProfileBenchmarkReferencesSectionProps) {
  const saveProfile = useAppStore(s => s.saveProfile);
  const [draftReferences, setDraftReferences] = useState<BenchmarkReferenceMap>(() => cloneBenchmarkReferences(activeProfile?.benchmarkReferences));

  const draftProfile = useMemo(
    () => (activeProfile ? { ...activeProfile, benchmarkReferences: draftReferences } : null),
    [activeProfile, draftReferences],
  );

  if (!activeProfile || !draftProfile) return null;

  const savedReferences = cloneBenchmarkReferences(activeProfile.benchmarkReferences);
  const isDirty = JSON.stringify(savedReferences) !== JSON.stringify(draftReferences);

  const updateReference = (
    benchmarkId: string,
    hand: Hand,
    patch: Partial<{ manualKg: number | null; preferredSource: BenchmarkReferenceSource }>,
  ) => {
    setDraftReferences(current => {
      const nextBenchmark = current[benchmarkId]
        ? {
            Left: { ...current[benchmarkId].Left },
            Right: { ...current[benchmarkId].Right },
          }
        : createEmptyBenchmarkReferenceByHand();

      nextBenchmark[hand] = {
        ...nextBenchmark[hand],
        ...patch,
      };

      return {
        ...current,
        [benchmarkId]: nextBenchmark,
      };
    });
  };

  const handleSave = () => {
    saveProfile({
      ...activeProfile,
      benchmarkReferences: draftReferences,
    });
  };

  return (
    <Section title="Benchmark References">
      <p className="text-xs text-muted mb-3">
        TEST results are always preserved and shown below. Manual values only decide which benchmark reference auto-targets use for each hand.
      </p>
      <p className="text-xs text-muted mb-4">
        Leave a manual field blank to keep it unset. Each hand can choose `TEST` or `Manual` independently.
      </p>

      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white disabled:opacity-40"
        >
          Save References
        </button>
        <button
          onClick={() => setDraftReferences(cloneBenchmarkReferences(activeProfile.benchmarkReferences))}
          disabled={!isDirty}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-text border border-border disabled:opacity-40"
        >
          Reset Changes
        </button>
      </div>

      <div className="space-y-4">
        {TEST_LIBRARY.map(protocol => (
          <div key={protocol.id} className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold">{protocol.name}</div>
                  <div className="text-xs text-muted mt-1">
                    {benchmarkCategoryLabel(protocol.category)} · {protocol.shortName}
                  </div>
                </div>
                <div className="text-xs text-muted">
                  {protocol.durationSec}s efforts · {protocol.attemptCount} attempts
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 p-4">
              {HANDS.map(hand => {
                const resolution = resolveBenchmarkReference({
                  results: testResults,
                  profile: draftProfile,
                  benchmarkId: protocol.id,
                  hand,
                });

                return (
                  <HandReferenceCard
                    key={hand}
                    hand={hand}
                    resolution={resolution}
                    onManualKgChange={(value) => updateReference(protocol.id, hand, { manualKg: value })}
                    onPreferredSourceChange={(preferredSource) => updateReference(protocol.id, hand, { preferredSource })}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HandReferenceCard({
  hand,
  resolution,
  onManualKgChange,
  onPreferredSourceChange,
}: {
  hand: Hand;
  resolution: BenchmarkReferenceResolution;
  onManualKgChange: (value: number | null) => void;
  onPreferredSourceChange: (source: BenchmarkReferenceSource) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{hand} Hand</div>
        <div className="text-xs text-muted">
          Preferred: {benchmarkReferenceSourceLabel(resolution.preferredSource)}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-alt px-3 py-3">
        <div className="text-xs text-muted">Latest TEST</div>
        <div className="text-sm font-semibold mt-1">
          {resolution.latestTestKg !== null ? `${resolution.latestTestKg.toFixed(1)} kg` : 'Missing'}
        </div>
        <div className="text-xs text-muted mt-1">
          {resolution.latestTestCompletedAtIso ? formatDateTime(resolution.latestTestCompletedAtIso) : 'No saved TEST result yet'}
        </div>
      </div>

      <div>
        <div className="text-xs text-muted mb-1.5">Manual kg</div>
        <input
          type="number"
          min={0}
          step="0.1"
          value={resolution.manualKg ?? ''}
          onChange={event => onManualKgChange(event.target.value === '' ? null : Number(event.target.value))}
          className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
          placeholder="Unset"
        />
      </div>

      <div>
        <div className="text-xs text-muted mb-1.5">Active source</div>
        <div className="flex gap-2 flex-wrap">
          {(['test', 'manual'] as const).map(source => (
            <button
              key={source}
              onClick={() => onPreferredSourceChange(source)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                resolution.preferredSource === source
                  ? 'bg-primary/20 text-primary'
                  : 'bg-surface-alt border border-border text-muted hover:text-text'
              }`}
            >
              {benchmarkReferenceSourceLabel(source)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface px-3 py-3">
        <div className="text-xs text-muted">Active reference</div>
        <div className="text-sm font-semibold mt-1">
          {renderActiveReference(resolution)}
        </div>
        <div className="text-xs text-muted mt-1">
          {renderActiveReferenceDetail(resolution)}
        </div>
      </div>
    </div>
  );
}

function renderActiveReference(resolution: BenchmarkReferenceResolution): string {
  if (resolution.activeKg === null || resolution.effectiveSource === null) return 'No active reference';
  return `${benchmarkReferenceSourceLabel(resolution.effectiveSource)} ${resolution.activeKg.toFixed(1)} kg${resolution.usedFallback ? ' (fallback)' : ''}`;
}

function renderActiveReferenceDetail(resolution: BenchmarkReferenceResolution): string {
  if (resolution.activeKg === null || resolution.effectiveSource === null) {
    return resolution.preferredSource === 'manual'
      ? 'Manual is selected, but both manual value and TEST result are missing.'
      : 'TEST is selected, but both TEST result and manual value are missing.';
  }

  if (resolution.usedFallback) {
    return `${benchmarkReferenceSourceLabel(resolution.preferredSource)} is selected, but unavailable for this hand, so ${benchmarkReferenceSourceLabel(resolution.effectiveSource)} is used instead.`;
  }

  return `${benchmarkReferenceSourceLabel(resolution.effectiveSource)} is the current reference used for auto-targets on this hand.`;
}
