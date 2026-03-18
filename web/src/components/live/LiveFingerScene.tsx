import { useMemo } from 'react';
import { FINGER_COLORS, FINGER_NAMES, TOTAL_COLOR, displayOrder } from '../../constants/fingers.ts';
import { defaultConnectedDevice } from '../../device/deviceProfiles.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { useVerificationStore } from '../../stores/verificationStore.ts';
import { ForceChart } from './ForceChart.tsx';
import {
  NATIVE_PER_FINGER_SERIES_VISIBILITY,
  TOTAL_ONLY_SERIES_VISIBILITY,
} from './liveSeries.ts';
import { pipeline } from '../../pipeline/SamplePipeline.ts';
import { verificationAllowsLiveDisplay } from '@krimblokk/core';

function sparklinePoints(values: number[], width: number, height: number, maxY: number): string {
  if (values.length === 0) return '';
  return values.map((value, index) => {
    const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
    const y = height - (Math.max(0, value) / Math.max(1e-6, maxY)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function sampleSeries(values: number[], maxPoints = 80): number[] {
  if (values.length <= maxPoints) return values;
  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round((index / Math.max(1, maxPoints - 1)) * (values.length - 1));
    return values[sourceIndex] ?? 0;
  });
}

function currentEffortSparkline(samples: ReturnType<typeof useLiveStore.getState>['currentEffortSamples']) {
  const series = [
    sampleSeries(samples.map(sample => sample.kg?.[0] ?? 0)),
    sampleSeries(samples.map(sample => sample.kg?.[1] ?? 0)),
    sampleSeries(samples.map(sample => sample.kg?.[2] ?? 0)),
    sampleSeries(samples.map(sample => sample.kg?.[3] ?? 0)),
  ] as const;

  const maxFingerKg = Math.max(
    1,
    ...series[0],
    ...series[1],
    ...series[2],
    ...series[3],
  );

  return {
    series,
    maxFingerKg,
  };
}

function formatPeakLabel(label: string): string {
  return label.endsWith('peak') ? label : `${label} peak`;
}

function TrendSparkline({
  values,
  color,
  maxY,
}: {
  values: number[];
  color: string;
  maxY: number;
}) {
  return (
    <svg viewBox="0 0 160 52" aria-hidden="true" className="h-14 w-full overflow-visible">
      <line x1="0" y1="50.5" x2="160" y2="50.5" stroke={`${color}33`} strokeWidth="1" />
      <polyline
        fill="none"
        points={sparklinePoints(values, 160, 48, maxY)}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FingerLiveCard({
  fingerIndex,
  liveKg,
  sharePct,
  peakKg,
  peakLabel,
  series,
  maxY,
}: {
  fingerIndex: number;
  liveKg: number;
  sharePct: number | null;
  peakKg: number | null;
  peakLabel: string;
  series: number[];
  maxY: number;
}) {
  const accent = FINGER_COLORS[fingerIndex];
  const shareWidth = sharePct === null ? 0 : Math.max(8, Math.min(100, sharePct));

  return (
    <article
      data-finger-card
      className="rounded-2xl border border-border bg-surface p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]"
      style={{ boxShadow: `0 20px 44px -34px ${accent}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: accent }}>
            {FINGER_NAMES[fingerIndex]}
          </h3>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted mt-1">Live load</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Share</div>
          <div className="text-sm font-semibold tabular-nums text-text mt-1">
            {sharePct === null ? '--' : `${sharePct.toFixed(0)}%`}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold tabular-nums" style={{ color: accent }}>
          {liveKg.toFixed(1)}
          <span className="ml-1 text-sm text-muted">kg</span>
        </div>
        <div className="min-w-[92px] text-right">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{peakLabel}</div>
          <div className="mt-1 text-sm font-semibold tabular-nums text-text">
            {peakKg === null ? '--' : `${peakKg.toFixed(1)} kg`}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface-alt/70 px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-muted">
          <span>Trend</span>
          <span>{series.length > 0 ? `${series.length} pts` : 'No data'}</span>
        </div>
        <TrendSparkline values={series} color={accent} maxY={maxY} />
        <div className="mt-1 h-1.5 rounded-full bg-surface">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${shareWidth}%`,
              backgroundColor: sharePct === null ? `${accent}44` : accent,
            }}
          />
        </div>
      </div>
    </article>
  );
}

function TotalForceFallbackCard({
  deviceName,
  latestTotalKg,
  runningPeakKg,
  latestEffortPeakKg,
  onReset,
  resetDisabled,
}: {
  deviceName: string;
  latestTotalKg: number;
  runningPeakKg: number;
  latestEffortPeakKg: number | null;
  onReset: () => void;
  resetDisabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_18px_44px_-34px_rgba(96,165,250,0.55)]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted">Total Force Live</div>
          <div className="mt-2 text-4xl font-semibold tabular-nums" style={{ color: TOTAL_COLOR }}>
            {latestTotalKg.toFixed(1)}
            <span className="ml-2 text-base text-muted">kg</span>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            {deviceName} streams total force only. The full four-finger live scene remains reserved for
            native per-finger hardware such as CURRENT_UNO_HX711.
          </p>
        </div>
        <div className="min-w-[220px] space-y-3">
          <button
            onClick={onReset}
            disabled={resetDisabled}
            className="w-full rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-semibold text-text disabled:opacity-30"
          >
            Reset LIVE
          </button>
          <div className="rounded-2xl border border-border bg-surface-alt/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Latest Context</div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">Running peak</span>
                <span className="text-sm font-semibold tabular-nums text-text">{runningPeakKg.toFixed(1)} kg</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">Latest effort peak</span>
                <span className="text-sm font-semibold tabular-nums text-text">
                  {latestEffortPeakKg === null ? '--' : `${latestEffortPeakKg.toFixed(1)} kg`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerificationBlockedCard({ reason }: { reason: string }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-danger">
      <div className="text-xs uppercase tracking-[0.22em]">Live Verification Blocked</div>
      <div className="mt-2 text-xl font-semibold text-text">Live force values are hidden until the stream is verified again.</div>
      <p className="mt-3 max-w-2xl text-sm">{reason}</p>
    </div>
  );
}

export function LiveFingerScene() {
  const hand = useAppStore(s => s.hand);
  const measurementHandOverride = useLiveStore(s => s.measurementHandOverride);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const latestKg = useLiveStore(s => s.latestKg);
  const latestPct = useLiveStore(s => s.latestPct);
  const latestTotalKg = useLiveStore(s => s.latestTotalKg);
  const hasMeaningfulLoad = useLiveStore(s => s.hasMeaningfulLoad);
  const quickMeasurePresetId = useLiveStore(s => s.quickMeasurePresetId);
  const quickResult = useLiveStore(s => s.quickResult);
  const quickLivePeakTotalKg = useLiveStore(s => s.quickLivePeakTotalKg);
  const quickLivePeakPerFingerKg = useLiveStore(s => s.quickLivePeakPerFingerKg);
  const currentEffort = useLiveStore(s => s.currentEffort);
  const lastEffort = useLiveStore(s => s.lastEffort);
  const currentEffortSamples = useLiveStore(s => s.currentEffortSamples);
  const quickCapture = useLiveStore(s => s.quickCapture);
  const recording = useLiveStore(s => s.recording);
  const resetLiveDashboard = useLiveStore(s => s.resetLiveDashboard);
  const verificationStatus = useVerificationStore(s => s.snapshot.status);
  const verificationReason = useVerificationStore(s => s.blockReason);
  const device = activeDevice ?? defaultConnectedDevice(sourceKind);
  const verificationBlocked = !verificationAllowsLiveDisplay(verificationStatus) && Boolean(verificationReason);
  const order = displayOrder(measurementHandOverride ?? hand);
  const activeQuickResult = quickResult && quickResult.presetId === quickMeasurePresetId ? quickResult : null;

  const peakSource = useMemo(() => {
    if (activeQuickResult?.peakPerFingerKg) {
      return {
        values: activeQuickResult.peakPerFingerKg,
        label: activeQuickResult.presetId === 'peak_per_finger' ? 'Last max pull' : 'Last capture',
      };
    }
    if (currentEffort?.peakPerFingerKg) {
      return {
        values: currentEffort.peakPerFingerKg,
        label: 'Current effort',
      };
    }
    if (lastEffort?.peakPerFingerKg) {
      return {
        values: lastEffort.peakPerFingerKg,
        label: 'Last effort',
      };
    }
    return {
      values: quickLivePeakPerFingerKg,
      label: 'Running',
    };
  }, [activeQuickResult, currentEffort, lastEffort, quickLivePeakPerFingerKg]);

  const latestEffortPeakKg = currentEffort?.peakTotalKg ?? lastEffort?.peakTotalKg ?? null;
  const totalContextLabel = activeQuickResult
    ? formatPeakLabel(activeQuickResult.label)
    : latestEffortPeakKg !== null
      ? currentEffort
        ? 'Current effort peak'
        : 'Last effort peak'
      : 'Running peak';
  const totalContextValue = activeQuickResult?.peakTotalKg
    ?? latestEffortPeakKg
    ?? quickLivePeakTotalKg;
  const sparkline = useMemo(
    () => currentEffortSparkline(currentEffortSamples),
    [currentEffortSamples],
  );
  const resetDisabled = recording || quickCapture.status !== 'idle';

  const handleResetLive = () => {
    if (resetDisabled) return;
    pipeline.finalizeActiveEffort();
    resetLiveDashboard();
    useDeviceStore.getState().addStatus('LIVE reset');
  };

  if (verificationBlocked) {
    return (
      <section aria-label="Live verification blocked" className="space-y-4">
        <VerificationBlockedCard reason={verificationReason ?? 'Waiting for runtime verification to complete.'} />
      </section>
    );
  }

  if (!device.capabilities.perFingerForce) {
    return (
      <section aria-label="Total force fallback" className="space-y-4">
        <TotalForceFallbackCard
          deviceName={device.deviceName}
          latestTotalKg={latestTotalKg}
          runningPeakKg={quickLivePeakTotalKg}
          latestEffortPeakKg={latestEffortPeakKg}
          onReset={handleResetLive}
          resetDisabled={resetDisabled}
        />

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted">Shared Live Graph</div>
              <div className="mt-1 text-lg font-semibold text-text">Total force trace</div>
            </div>
            <div className="text-xs text-muted">Per-finger traces unlock on CURRENT_UNO_HX711.</div>
          </div>
          <div className="mt-4">
            <ForceChart variant="total_focus" seriesVisibility={TOTAL_ONLY_SERIES_VISIBILITY} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Per finger live scene" className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-muted">Per-Finger Live Scene</div>
            <div className="mt-2 text-xl font-semibold text-text">Four finger cards stay front and center in LIVE.</div>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              CURRENT_UNO_HX711 keeps total load available as context while live kg, share, peak, and trend stay tied
              to each finger.
            </p>
          </div>
          <div className="min-w-[220px] space-y-3">
            <button
              onClick={handleResetLive}
              disabled={resetDisabled}
              className="w-full rounded-xl border border-border bg-surface-alt px-4 py-2 text-sm font-semibold text-text disabled:opacity-30"
            >
              Reset LIVE
            </button>
            <div className="rounded-2xl border border-border bg-surface-alt/70 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Total Context</div>
              <div className="mt-3 text-3xl font-semibold tabular-nums" style={{ color: TOTAL_COLOR }}>
                {latestTotalKg.toFixed(1)}
                <span className="ml-2 text-sm text-muted">kg</span>
              </div>
              <div className="mt-2 text-xs text-muted">
                {totalContextLabel}: <span className="font-semibold text-text">{totalContextValue.toFixed(1)} kg</span>
              </div>
              {resetDisabled && (
                <div className="mt-3 text-xs text-muted">
                  Stop active recording or quick capture before resetting LIVE.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {order.map(fingerIndex => (
          <FingerLiveCard
            key={fingerIndex}
            fingerIndex={fingerIndex}
            liveKg={latestKg?.[fingerIndex] ?? 0}
            sharePct={hasMeaningfulLoad && latestPct ? latestPct[fingerIndex] : null}
            peakKg={peakSource.values?.[fingerIndex] ?? null}
            peakLabel={peakSource.label}
            series={sparkline.series[fingerIndex]}
            maxY={sparkline.maxFingerKg}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Shared Live Graph</div>
            <div className="mt-1 text-lg font-semibold text-text">Finger traces over time</div>
          </div>
          <div className="text-xs text-muted">Total trace is hidden by default in native per-finger mode.</div>
        </div>
        <div className="mt-4">
          <ForceChart variant="per_finger_focus" seriesVisibility={NATIVE_PER_FINGER_SERIES_VISIBILITY} />
        </div>
      </div>

      {!hasMeaningfulLoad && (
        <div className="text-xs text-muted">Share percentages appear once the live load reaches 1.0 kg.</div>
      )}
    </section>
  );
}
