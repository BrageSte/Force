import { DEFAULT_SETTINGS, normalizeAppSettings, type AppSettings } from '../types/settings.ts'
import type { ForceSample } from '../types/force.ts'
import { saveActiveProfileId, saveProfiles } from '../storage/profileStore.ts'
import { saveSettings } from '../storage/settingsStore.ts'
import { useAppStore } from '../stores/appStore.ts'
import { useDeviceStore } from '../stores/deviceStore.ts'
import { useLiveStore } from '../stores/liveStore.ts'
import { createProfile } from '../types/profile.ts'

export function resetAllStores(partialSettings: Partial<AppSettings> = {}): AppSettings {
  const settings = normalizeAppSettings({ ...DEFAULT_SETTINGS, ...partialSettings })
  const profile = createProfile('Test Person')
  saveSettings(settings)
  saveProfiles([profile])
  saveActiveProfileId(profile.profileId)

  useAppStore.setState({
    settings,
    hand: settings.handDefault,
    profiles: [profile],
    activeProfileId: profile.profileId,
    sessions: [],
    currentSession: null,
  })

  useDeviceStore.setState({
    sourceKind: settings.preferredSource,
    connectionState: 'idle',
    connected: false,
    statusMessages: [],
    provider: null,
    activeDevice: null,
    scannedDevices: [],
  })

  useLiveStore.getState().setBufferSeconds(settings.ringBufferSeconds)
  useLiveStore.getState().resetSession()

  return settings
}

export function uniformForceSample(tMs: number, totalKg: number): ForceSample {
  const perFinger = totalKg / 4
  return {
    tMs,
    source: 'native-bs',
    raw: [perFinger, perFinger, perFinger, perFinger],
    kg: [perFinger, perFinger, perFinger, perFinger],
    totalKg,
    totalN: totalKg * 9.80665,
    stability: null,
  }
}
