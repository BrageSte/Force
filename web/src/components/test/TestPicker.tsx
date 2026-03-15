import type { Hand } from '../../types/force.ts';
import { benchmarkCategoryLabel, testFamilyLabel } from './testConfig.ts';
import { bestPeakOfResult } from './testAnalysis.ts';
import { TEST_LIBRARY } from './testLibrary.ts';
import type { CompletedTestResult, CustomTestTemplate, ProtocolRef, TestId } from './types.ts';

interface TestPickerProps {
  activeProfileName: string;
  selectedRef: ProtocolRef;
  onSelect: (ref: ProtocolRef) => void;
  onStart: () => void;
  onOpenAiBuilder: () => void;
  aiCoachingEnabled: boolean;
  onToggleAiCoaching: (enabled: boolean) => void;
  alternateHands: boolean;
  onToggleAlternateHands: (enabled: boolean) => void;
  hand: Hand;
  onChangeHand: (hand: Hand) => void;
  connected: boolean;
  latestByProtocol: Partial<Record<TestId, CompletedTestResult | null>>;
  customTemplates: CustomTestTemplate[];
  latestCustomByTemplateId: Record<string, CompletedTestResult | null>;
  onCreateCustom: () => void;
  onEditCustom: (template: CustomTestTemplate) => void;
  onDuplicateCustom: (template: CustomTestTemplate) => void;
  onDeleteCustom: (template: CustomTestTemplate) => void;
}

function tierClass(tier: string): string {
  if (tier === 'Core') return 'bg-success/15 text-success border border-success/30';
  if (tier === 'Advanced') return 'bg-warning/15 text-warning border border-warning/30';
  if (tier === 'Custom') return 'bg-primary/15 text-primary border border-primary/30';
  return 'bg-danger/15 text-danger border border-danger/30';
}

function isSelected(selectedRef: ProtocolRef, kind: ProtocolRef['kind'], id: string): boolean {
  return selectedRef.kind === kind && selectedRef.id === id;
}

export function TestPicker({
  activeProfileName,
  selectedRef,
  onSelect,
  onStart,
  onOpenAiBuilder,
  aiCoachingEnabled,
  onToggleAiCoaching,
  alternateHands,
  onToggleAlternateHands,
  hand,
  onChangeHand,
  connected,
  latestByProtocol,
  customTemplates,
  latestCustomByTemplateId,
  onCreateCustom,
  onEditCustom,
  onDuplicateCustom,
  onDeleteCustom,
}: TestPickerProps) {
  const selectedBuiltIn = selectedRef.kind === 'builtin'
    ? TEST_LIBRARY.find(protocol => protocol.id === selectedRef.id) ?? TEST_LIBRARY[0]
    : null;
  const selectedCustom = selectedRef.kind === 'custom'
    ? customTemplates.find(template => template.id === selectedRef.id) ?? null
    : null;
  const groupedProtocols = Object.entries(
    TEST_LIBRARY.reduce<Record<string, typeof TEST_LIBRARY>>((acc, protocol) => {
      acc[protocol.category] = [...(acc[protocol.category] ?? []), protocol];
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Test Library</h2>
          <p className="text-xs text-muted mt-1">
            Pick a protocol for {hand} hand on {activeProfileName}, or build a custom template with its own timing and dashboard defaults.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={() => onChangeHand('Left')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              hand === 'Left'
                ? 'bg-primary/20 text-primary'
                : 'bg-surface-alt border border-border text-muted hover:text-text'
            }`}
          >
            Left Hand
          </button>
          <button
            onClick={() => onChangeHand('Right')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              hand === 'Right'
                ? 'bg-primary/20 text-primary'
                : 'bg-surface-alt border border-border text-muted hover:text-text'
            }`}
          >
            Right Hand
          </button>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-3 py-2">
            <input
              type="checkbox"
              checked={aiCoachingEnabled}
              onChange={e => onToggleAiCoaching(e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-xs font-medium text-text">AI Coaching</span>
          </label>
          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
            selectedRef.kind === 'builtin'
              ? 'border-border bg-surface-alt'
              : 'border-border/60 bg-bg text-muted'
          }`}>
            <input
              type="checkbox"
              checked={alternateHands}
              onChange={e => onToggleAlternateHands(e.target.checked)}
              disabled={selectedRef.kind !== 'builtin'}
              className="accent-blue-500"
            />
            <span className="text-xs font-medium">Alternate Hands</span>
          </label>
          <button
            onClick={onCreateCustom}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-text"
          >
            New Custom Template
          </button>
          <button
            onClick={onOpenAiBuilder}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 border border-primary/25 text-primary"
          >
            AI Test Builder
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Benchmark Library</h3>
              <span className="text-xs text-muted">{TEST_LIBRARY.length} protocols</span>
            </div>
            <div className="space-y-4">
              {groupedProtocols.map(([category, protocols]) => (
                <div key={category} className="space-y-3">
                  <div className="px-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {benchmarkCategoryLabel(protocols[0].category)}
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {protocols.map(protocol => {
                      const latest = latestByProtocol[protocol.id as TestId];
                      const selectedCard = isSelected(selectedRef, 'builtin', protocol.id);
                      return (
                        <button
                          key={protocol.id}
                          onClick={() => onSelect({ kind: 'builtin', id: protocol.id })}
                          className={`text-left bg-surface rounded-xl border p-4 transition-colors ${
                            selectedCard ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{protocol.name}</div>
                              <div className="text-xs text-muted mt-1">{protocol.purpose}</div>
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wide ${tierClass(protocol.tier)}`}>
                              {protocol.tier}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                            <div className="bg-surface-alt rounded-lg px-3 py-2">
                              <div className="text-muted">Duration</div>
                              <div className="font-semibold mt-0.5">{protocol.durationSec}s</div>
                            </div>
                            <div className="bg-surface-alt rounded-lg px-3 py-2">
                              <div className="text-muted">Sets</div>
                              <div className="font-semibold mt-0.5">{protocol.attemptCount}</div>
                            </div>
                            <div className="bg-surface-alt rounded-lg px-3 py-2">
                              <div className="text-muted">Rest</div>
                              <div className="font-semibold mt-0.5">{protocol.restSec}s</div>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-border text-xs">
                            {latest ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted">Latest ({latest.hand})</span>
                                <span className="font-semibold tabular-nums">
                                  {bestPeakOfResult(latest).toFixed(1)} kg
                                  {latest.summary.normalizedPeakKgPerKgBodyweight !== null && latest.summary.normalizedPeakKgPerKgBodyweight !== undefined
                                    ? ` · ${latest.summary.normalizedPeakKgPerKgBodyweight.toFixed(2)} x BW`
                                    : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted/70">No previous result</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Custom Templates</h3>
              <span className="text-xs text-muted">{customTemplates.length} saved</span>
            </div>
            {customTemplates.length === 0 ? (
              <div className="bg-surface rounded-xl border border-border p-6 text-sm text-muted">
                No custom templates yet. Create one to define your own set timing, targets, live panels and result dashboard.
              </div>
            ) : (
              <div className="space-y-3">
                {customTemplates.map(template => {
                  const latest = latestCustomByTemplateId[template.id];
                  const selectedCard = isSelected(selectedRef, 'custom', template.id);
                  const intervalLabel = template.interval?.enabled
                    ? `${template.interval.workSec}:${template.interval.restSec} x ${template.interval.cycles}`
                    : 'Continuous';
                  return (
                    <div
                      key={template.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect({ kind: 'custom', id: template.id })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelect({ kind: 'custom', id: template.id });
                        }
                      }}
                      className={`text-left bg-surface rounded-xl border p-4 transition-colors cursor-pointer ${
                        selectedCard ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{template.name}</div>
                          <div className="text-xs text-muted mt-1">
                            {template.purpose || 'Custom template'}
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wide ${tierClass('Custom')}`}>
                          Custom
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                        <div className="bg-surface-alt rounded-lg px-3 py-2">
                          <div className="text-muted">Family</div>
                          <div className="font-semibold mt-0.5">{testFamilyLabel(template.family)}</div>
                        </div>
                        <div className="bg-surface-alt rounded-lg px-3 py-2">
                          <div className="text-muted">Sets</div>
                          <div className="font-semibold mt-0.5">{template.attemptCount}</div>
                        </div>
                        <div className="bg-surface-alt rounded-lg px-3 py-2">
                          <div className="text-muted">Work</div>
                          <div className="font-semibold mt-0.5">{template.workSec}s</div>
                        </div>
                        <div className="bg-surface-alt rounded-lg px-3 py-2">
                          <div className="text-muted">Intervals</div>
                          <div className="font-semibold mt-0.5">{intervalLabel}</div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
                        {latest ? (
                          <div className="text-xs">
                            <span className="text-muted">Latest</span>{' '}
                            <span className="font-semibold tabular-nums">{bestPeakOfResult(latest).toFixed(1)} kg</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted/70">No previous result</span>
                        )}
                        <div className="flex items-center gap-2">
                          <button onClick={(event) => { event.stopPropagation(); onEditCustom(template); }} className="px-2 py-1 rounded text-xs font-medium bg-surface-alt border border-border text-text">
                            Edit
                          </button>
                          <button onClick={(event) => { event.stopPropagation(); onDuplicateCustom(template); }} className="px-2 py-1 rounded text-xs font-medium bg-surface-alt border border-border text-text">
                            Duplicate
                          </button>
                          <button onClick={(event) => { event.stopPropagation(); onDeleteCustom(template); }} className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger border border-danger/30">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-5 space-y-4 self-start xl:sticky xl:top-4">
          {selectedBuiltIn ? (
            <>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Benchmark Detail</div>
                <h3 className="text-xl font-semibold mt-1">{selectedBuiltIn.name}</h3>
                <p className="text-sm text-muted mt-2">{selectedBuiltIn.purpose}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Metric label="Grip / Mode" value={`${selectedBuiltIn.gripType.replaceAll('_', ' ')} · ${selectedBuiltIn.modality.replaceAll('_', ' ')}`} />
                <Metric label="Level" value={selectedBuiltIn.athleteLevel} />
                <Metric label="Timing" value={`${selectedBuiltIn.durationSec}s · ${selectedBuiltIn.attemptCount} sets · ${selectedBuiltIn.restSec}s rest`} />
                <Metric label="Target logic" value={selectedBuiltIn.targetIntensityLogic} />
              </div>

              <div className="rounded-xl border border-border bg-surface-alt p-4">
                <div className="text-sm font-semibold">Guidance</div>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {selectedBuiltIn.guidance.map(line => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-surface-alt p-4 space-y-2 text-sm">
                <div className="text-sm font-semibold">Context</div>
                <div className="text-xs text-muted">{selectedBuiltIn.effortType}</div>
                <div className="text-xs text-muted">Outputs: {selectedBuiltIn.outputs.join(' | ')}</div>
                <div className="text-xs text-muted">AI coaching: {aiCoachingEnabled ? 'Enabled' : 'Off'}</div>
                {alternateHands && (
                  <div className="text-xs text-warning">Alternate hands mode will run both hands in one guided session.</div>
                )}
              </div>
            </>
          ) : selectedCustom ? (
            <>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Custom Template</div>
                <h3 className="text-xl font-semibold mt-1">{selectedCustom.name}</h3>
                <p className="text-sm text-muted mt-2">{selectedCustom.purpose || 'Custom template'}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Metric label="Family" value={testFamilyLabel(selectedCustom.family)} />
                <Metric label="Hand mode" value={selectedCustom.handMode === 'alternate_hands' ? 'Alternate hands' : 'Current hand only'} />
                <Metric label="Timing" value={`${selectedCustom.workSec}s · ${selectedCustom.attemptCount} sets · ${selectedCustom.restSec}s rest`} />
                <Metric label="Panels" value={`${selectedCustom.livePanels.length} live · ${selectedCustom.resultWidgets.length} result`} />
              </div>
            </>
          ) : null}

          <button
            onClick={onStart}
            disabled={!connected}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40"
          >
            Start Guided Test
          </button>
        </div>
      </div>
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
