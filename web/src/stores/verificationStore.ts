import { create } from 'zustand';
import {
  createVerificationSnapshot,
  evaluateVerification,
  verificationAllowsLiveDisplay,
  verificationBlocksStarts,
  type DeviceCapabilities,
  type DeviceStreamMode,
  type ForceSample,
  type InputMode,
  type SourceKind,
  type VerificationSnapshot,
  type VerificationStatus,
} from '@krimblokk/core';

const MODE_CONFIRMATION_TIMEOUT_MS = 2_500;

let modeTimer: number | null = null;

function clearModeTimer() {
  if (modeTimer !== null) {
    window.clearTimeout(modeTimer);
    modeTimer = null;
  }
}

function requiresModeConfirmation(sourceKind: SourceKind | null): boolean {
  return sourceKind === 'Serial' || sourceKind === 'BLE_UART';
}

function autoConfirmedMode(sourceKind: SourceKind | null, mode: DeviceStreamMode | null): DeviceStreamMode | null {
  return sourceKind === 'Simulator' ? mode : null;
}

function modeFromStatusMessage(message: string): DeviceStreamMode | null {
  const match = message.match(/\bmode(?:\s+|=|:\s*)(raw|kg)\b/i);
  if (!match) return null;
  return match[1].toLowerCase() === 'raw' ? 'raw' : 'kg';
}

function checkingReason(
  sourceKind: SourceKind | null,
  requestedStreamMode: DeviceStreamMode | null,
  modeConfirmed = false,
): string {
  if (requiresModeConfirmation(sourceKind) && requestedStreamMode && !modeConfirmed) {
    return `Waiting for firmware to confirm ${requestedStreamMode.toUpperCase()} mode.`;
  }
  return 'Waiting for the first verified sample.';
}

function createCheckingState(
  sourceKind: SourceKind | null,
  requestedStreamMode: DeviceStreamMode | null,
  modeConfirmed = false,
): VerificationSnapshot {
  return createVerificationSnapshot('checking', [], checkingReason(sourceKind, requestedStreamMode, modeConfirmed));
}

export interface VerificationBadgePresentation {
  label: string;
  className: string;
}

interface VerificationState {
  sourceKind: SourceKind | null;
  requestedStreamMode: DeviceStreamMode | null;
  reportedStreamMode: DeviceStreamMode | null;
  snapshot: VerificationSnapshot;
  blockReason: string | null;
  lastVerifiedSampleTimeMs: number | null;
  lastSampleTMs: number | null;
  modeConfirmationTimedOut: boolean;

  beginConnection: (args: {
    sourceKind: SourceKind;
    requestedStreamMode: DeviceStreamMode | null;
  }) => void;
  noteRequestedStreamMode: (mode: DeviceStreamMode | null) => void;
  handleStatusMessage: (message: string) => void;
  evaluateSample: (args: {
    sample: ForceSample;
    capabilities: DeviceCapabilities;
    inputMode: InputMode;
    sampleRateHz: number;
    tareRequired: boolean;
    requiresPerFingerDisplay?: boolean;
  }) => VerificationSnapshot;
  reset: () => void;
}

function scheduleModeTimeout() {
  clearModeTimer();
  modeTimer = window.setTimeout(() => {
    useVerificationStore.setState(state => {
      if (!requiresModeConfirmation(state.sourceKind)) return state;
      if (!state.requestedStreamMode || state.requestedStreamMode === state.reportedStreamMode) return state;
      const snapshot = evaluateVerification({
        sample: null,
        capabilities: {
          totalForce: true,
          perFingerForce: true,
          batteryStatus: false,
          tare: true,
          startStopStreaming: true,
        },
        inputMode: 'MODE_KG_DIRECT',
        requestedStreamMode: state.requestedStreamMode,
        confirmedStreamMode: state.reportedStreamMode,
        requireModeConfirmation: true,
        modeConfirmationTimedOut: true,
      });
      return {
        ...state,
        modeConfirmationTimedOut: true,
        snapshot,
        blockReason: snapshot.blockReason,
      };
    });
    modeTimer = null;
  }, MODE_CONFIRMATION_TIMEOUT_MS);
}

export const useVerificationStore = create<VerificationState>((set, get) => ({
  sourceKind: null,
  requestedStreamMode: null,
  reportedStreamMode: null,
  snapshot: createVerificationSnapshot('checking', [], null),
  blockReason: null,
  lastVerifiedSampleTimeMs: null,
  lastSampleTMs: null,
  modeConfirmationTimedOut: false,

  beginConnection: ({ sourceKind, requestedStreamMode }) => {
    clearModeTimer();
    const reportedStreamMode = autoConfirmedMode(sourceKind, requestedStreamMode);
    const modeConfirmed = !requiresModeConfirmation(sourceKind) || reportedStreamMode === requestedStreamMode;
    const snapshot = createCheckingState(sourceKind, requestedStreamMode, modeConfirmed);
    set({
      sourceKind,
      requestedStreamMode,
      reportedStreamMode,
      snapshot,
      blockReason: snapshot.blockReason,
      lastVerifiedSampleTimeMs: null,
      lastSampleTMs: null,
      modeConfirmationTimedOut: false,
    });
    if (requiresModeConfirmation(sourceKind) && requestedStreamMode && reportedStreamMode !== requestedStreamMode) {
      scheduleModeTimeout();
    }
  },

  noteRequestedStreamMode: (mode) => {
    clearModeTimer();
    const state = get();
    const reportedStreamMode = autoConfirmedMode(state.sourceKind, mode) ?? state.reportedStreamMode;
    const modeConfirmed = !requiresModeConfirmation(state.sourceKind) || reportedStreamMode === mode;
    const snapshot = createCheckingState(state.sourceKind, mode, modeConfirmed);
    set({
      requestedStreamMode: mode,
      reportedStreamMode,
      snapshot,
      blockReason: snapshot.blockReason,
      modeConfirmationTimedOut: false,
    });
    if (requiresModeConfirmation(state.sourceKind) && mode && reportedStreamMode !== mode) {
      scheduleModeTimeout();
    }
  },

  handleStatusMessage: (message) => {
    const reportedMode = modeFromStatusMessage(message);
    if (!reportedMode) return;

    clearModeTimer();
    const state = get();
    const reportedMatches = !state.requestedStreamMode || state.requestedStreamMode === reportedMode;
    const nextSnapshot = createCheckingState(state.sourceKind, state.requestedStreamMode, reportedMatches);

    set({
      reportedStreamMode: reportedMode,
      snapshot: nextSnapshot,
      blockReason: nextSnapshot.blockReason,
      modeConfirmationTimedOut: false,
    });

    if (
      requiresModeConfirmation(state.sourceKind) &&
      state.requestedStreamMode &&
      state.requestedStreamMode !== reportedMode
    ) {
      scheduleModeTimeout();
    }
  },

  evaluateSample: ({ sample, capabilities, inputMode, sampleRateHz, tareRequired, requiresPerFingerDisplay }) => {
    const state = get();
    const snapshot = evaluateVerification({
      sample,
      previousSampleTMs: state.lastSampleTMs,
      capabilities,
      inputMode,
      sampleRateHz,
      tareRequired,
      requestedStreamMode: state.requestedStreamMode,
      confirmedStreamMode: state.reportedStreamMode,
      requireModeConfirmation: requiresModeConfirmation(state.sourceKind),
      modeConfirmationTimedOut: state.modeConfirmationTimedOut,
      requiresPerFingerDisplay,
    });

    const nextState: Partial<VerificationState> = {
      snapshot,
      blockReason: snapshot.blockReason,
      lastSampleTMs: sample.tMs,
    };

    if (verificationAllowsLiveDisplay(snapshot.status)) {
      nextState.lastVerifiedSampleTimeMs = sample.tMs;
    }

    set(nextState);
    return snapshot;
  },

  reset: () => {
    clearModeTimer();
    set({
      sourceKind: null,
      requestedStreamMode: null,
      reportedStreamMode: null,
      snapshot: createVerificationSnapshot('checking', [], null),
      blockReason: null,
      lastVerifiedSampleTimeMs: null,
      lastSampleTMs: null,
      modeConfirmationTimedOut: false,
    });
  },
}));

export function verificationStatusBadge(status: VerificationStatus): VerificationBadgePresentation {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified',
        className: 'border border-success/30 bg-success/10 text-success',
      };
    case 'warning':
      return {
        label: 'Attention',
        className: 'border border-warning/30 bg-warning/10 text-warning',
      };
    case 'critical':
      return {
        label: 'Blocked',
        className: 'border border-danger/30 bg-danger/10 text-danger',
      };
    default:
      return {
        label: 'Verifying',
        className: 'border border-warning/30 bg-warning/10 text-warning',
      };
  }
}

export function currentVerificationStatus(): VerificationStatus {
  return useVerificationStore.getState().snapshot.status;
}

export function currentVerificationBlockReason(): string | null {
  return useVerificationStore.getState().blockReason;
}

export function verificationAllowsCurrentDisplay(): boolean {
  return verificationAllowsLiveDisplay(currentVerificationStatus());
}

export function verificationBlocksCurrentStarts(): boolean {
  return verificationBlocksStarts(currentVerificationStatus());
}
