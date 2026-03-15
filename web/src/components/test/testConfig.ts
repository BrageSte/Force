import type {
  AthleteLevel,
  BenchmarkCategory,
  GripType,
  WorkoutModality,
} from '@krimblokk/core';
import type {
  CompareMetricId,
  HandMode,
  LivePanelId,
  ResultWidgetId,
  TargetMode,
  TestFamily,
} from './types.ts';

export const DEFAULT_LIVE_PANELS: LivePanelId[] = [
  'timer',
  'hand_progress',
  'instructions',
  'target',
  'live_force',
  'contribution',
  'trace',
];

export const DEFAULT_RESULT_WIDGETS: ResultWidgetId[] = [
  'summary',
  'attempt_table',
  'attempt_overlay',
  'finger_detail',
  'target_stability',
  'experimental',
  'raw_traces',
  'session_context',
];

export const LIVE_PANEL_CATALOG: Array<{
  id: LivePanelId;
  label: string;
  description: string;
  slot: 'left' | 'right';
}> = [
  { id: 'timer', label: 'Timer & Phase', description: 'Large timer with phase status and action buttons.', slot: 'left' },
  { id: 'hand_progress', label: 'Hand / Set Progress', description: 'Shows current hand, set progress and readiness.', slot: 'left' },
  { id: 'instructions', label: 'Instructions', description: 'Template guidance and target reminder.', slot: 'left' },
  { id: 'target', label: 'Target Band', description: 'Shows target behavior when a target mode is active.', slot: 'right' },
  { id: 'live_force', label: 'Live Force', description: 'Live total force, tare status and per-finger kg cards.', slot: 'right' },
  { id: 'contribution', label: 'Contribution', description: 'Per-finger percentage contribution bars.', slot: 'right' },
  { id: 'trace', label: 'Live Trace', description: 'Running force trace for the active set.', slot: 'right' },
];

export const RESULT_WIDGET_CATALOG: Array<{
  id: ResultWidgetId;
  label: string;
  description: string;
}> = [
  { id: 'summary', label: 'Summary KPIs', description: 'Best peak, repeatability, asymmetry and trend.' },
  { id: 'attempt_table', label: 'Attempt Table', description: 'Per-attempt metrics in a compact table.' },
  { id: 'attempt_overlay', label: 'Attempt Overlay', description: 'Overlay of attempts over normalized time.' },
  { id: 'finger_detail', label: 'Finger Detail', description: 'Finger-specific detail and opposite-hand context.' },
  { id: 'target_stability', label: 'Target / Stability', description: 'Target adherence and stability metrics when available.' },
  { id: 'experimental', label: 'Experimental Metrics', description: 'Explosive and repeater-specific exploratory outputs.' },
  { id: 'raw_traces', label: 'Raw Trace Gallery', description: 'Per-attempt raw traces for total force.' },
  { id: 'session_context', label: 'Session Context', description: 'How this test fits with the rest of the session.' },
];

export const TEST_FAMILY_OPTIONS: Array<{ value: TestFamily; label: string }> = [
  { value: 'max_pull', label: 'Max Pull' },
  { value: 'duration_hold', label: 'Duration Hold' },
  { value: 'repeater', label: 'Repeater / Intervals' },
  { value: 'explosive', label: 'Explosive' },
  { value: 'health_capacity', label: 'Health / Capacity' },
  { value: 'force_curve', label: 'Force Curve' },
  { value: 'custom', label: 'Other / Custom' },
];

export const BENCHMARK_CATEGORY_OPTIONS: Array<{ value: BenchmarkCategory; label: string }> = [
  { value: 'max_strength', label: 'Max Strength' },
  { value: 'repeated_max_strength', label: 'Repeated Max Strength' },
  { value: 'recruitment_rfd', label: 'Recruitment / RFD' },
  { value: 'strength_endurance', label: 'Strength-Endurance' },
  { value: 'health_capacity', label: 'Health / Capacity' },
  { value: 'force_curve', label: 'Force Curve' },
];

export const ATHLETE_LEVEL_OPTIONS: Array<{ value: AthleteLevel; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'elite', label: 'Elite' },
];

export const GRIP_TYPE_OPTIONS: Array<{ value: GripType; label: string }> = [
  { value: 'half_crimp', label: 'Half Crimp' },
  { value: 'open_hand', label: 'Open Hand' },
  { value: 'edge', label: 'Edge' },
  { value: 'ergonomic_block', label: 'Ergonomic Block' },
  { value: 'no_hang_pull', label: 'No-Hang Pull' },
];

export const MODALITY_OPTIONS: Array<{ value: WorkoutModality; label: string }> = [
  { value: 'edge', label: 'Edge Hang' },
  { value: 'ergonomic_block', label: 'Ergonomic Block' },
  { value: 'no_hang_pull', label: 'No-Hang Pull' },
];

export const BENCHMARK_CATEGORY_LABELS: Record<BenchmarkCategory, string> = {
  max_strength: 'Max Strength',
  repeated_max_strength: 'Repeated Max Strength',
  recruitment_rfd: 'Recruitment / RFD',
  strength_endurance: 'Strength-Endurance / Repeater',
  health_capacity: 'Health / Capacity',
  force_curve: 'Individual Force Curve',
};

export const HAND_MODE_OPTIONS: Array<{ value: HandMode; label: string }> = [
  { value: 'current_hand', label: 'Current hand only' },
  { value: 'alternate_hands', label: 'Alternate hands' },
];

export const TARGET_MODE_OPTIONS: Array<{ value: TargetMode; label: string }> = [
  { value: 'none', label: 'No target' },
  { value: 'fixed_kg', label: 'Fixed kg target' },
  { value: 'percent_of_known_max', label: '% of known max' },
  { value: 'bodyweight_relative', label: 'Bodyweight relative' },
];

export const DEFAULT_COMPARE_METRIC: CompareMetricId = 'best_peak_total_kg';

export function livePanelLabel(panelId: LivePanelId): string {
  return LIVE_PANEL_CATALOG.find(panel => panel.id === panelId)?.label ?? panelId;
}

export function resultWidgetLabel(widgetId: ResultWidgetId): string {
  return RESULT_WIDGET_CATALOG.find(widget => widget.id === widgetId)?.label ?? widgetId;
}

export function testFamilyLabel(family: TestFamily): string {
  return TEST_FAMILY_OPTIONS.find(option => option.value === family)?.label ?? family;
}

export function benchmarkCategoryLabel(category: BenchmarkCategory): string {
  return BENCHMARK_CATEGORY_LABELS[category] ?? category;
}
