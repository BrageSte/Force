import type { AppSettings } from '../types/settings.ts';
import { DEFAULT_SETTINGS, normalizeAppSettings } from '../types/settings.ts';

const STORAGE_KEY = 'fingerforce-settings';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeAppSettings(DEFAULT_SETTINGS);
    return normalizeAppSettings(JSON.parse(raw));
  } catch {
    return normalizeAppSettings(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}
