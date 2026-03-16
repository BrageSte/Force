import type { CapabilityRequirements, SourceKind } from '@krimblokk/core';
import type { DeviceCapabilities } from '../types/force.ts';
import { defaultConnectedDevice } from './deviceProfiles.ts';

export function deviceCapabilitiesForSourceKind(sourceKind: SourceKind): DeviceCapabilities {
  return defaultConnectedDevice(sourceKind).capabilities;
}

export function supportsCapabilityRequirements(
  requirements: CapabilityRequirements,
  capabilities: DeviceCapabilities,
): boolean {
  if (requirements.requiresTotalForce && !capabilities.totalForce) return false;
  if (requirements.requiresPerFingerForce && !capabilities.perFingerForce) return false;
  return true;
}

export function capabilityBlockReason(
  requirements: CapabilityRequirements,
  capabilities: DeviceCapabilities,
): string | null {
  if (requirements.requiresPerFingerForce && !capabilities.perFingerForce) {
    return 'This protocol requires per-finger force data. Tindeq Progressor provides total force only.';
  }
  if (requirements.requiresTotalForce && !capabilities.totalForce) {
    return 'This protocol requires total-force data from a connected device.';
  }
  return null;
}
