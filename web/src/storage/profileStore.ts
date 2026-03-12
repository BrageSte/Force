import type { UserProfile } from '../types/profile.ts';
import { createProfile, normalizeProfile } from '../types/profile.ts';

const PROFILES_STORAGE_KEY = 'fingerforce-profiles-v1';
const ACTIVE_PROFILE_STORAGE_KEY = 'fingerforce-active-profile-id-v1';

function defaultProfiles(): UserProfile[] {
  return [createProfile()];
}

export function loadProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return defaultProfiles();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultProfiles();
    const profiles = parsed
      .map((profile, index) => normalizeProfile(profile, `Person ${index + 1}`))
      .filter(profile => profile.name.trim().length > 0);
    return profiles.length > 0 ? profiles : defaultProfiles();
  } catch {
    return defaultProfiles();
  }
}

export function saveProfiles(profiles: UserProfile[]): void {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Ignore storage failure.
  }
}

export function loadActiveProfileId(profiles = loadProfiles()): string {
  try {
    const stored = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
    if (stored && profiles.some(profile => profile.profileId === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage failure.
  }
  return profiles[0]?.profileId ?? createProfile().profileId;
}

export function saveActiveProfileId(profileId: string): void {
  try {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
  } catch {
    // Ignore storage failure.
  }
}
