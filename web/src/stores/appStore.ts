import { create } from 'zustand';
import type { AppSettings } from '../types/settings.ts';
import type { Hand, SessionMeta, SessionPayload } from '../types/force.ts';
import { loadSettings, saveSettings } from '../storage/settingsStore.ts';
import { normalizeAppSettings } from '../types/settings.ts';
import * as sessionDb from '../storage/sessionStore.ts';
import { loadActiveProfileId, loadProfiles, saveActiveProfileId, saveProfiles } from '../storage/profileStore.ts';
import { createProfile, normalizeProfile, type UserProfile } from '../types/profile.ts';

interface AppState {
  settings: AppSettings;
  hand: Hand;
  profiles: UserProfile[];
  activeProfileId: string;
  sessions: SessionMeta[];
  currentSession: SessionPayload | null;

  updateSettings: (partial: Partial<AppSettings>) => void;
  setHand: (h: Hand) => void;
  setActiveProfile: (profileId: string) => void;
  saveProfile: (profile: UserProfile) => UserProfile;
  createProfile: (name?: string) => UserProfile;
  deleteProfile: (profileId: string) => void;
  refreshSessions: () => Promise<void>;
  saveSession: (payload: SessionPayload) => Promise<void>;
  loadSession: (id: string) => Promise<SessionPayload | null>;
  setCurrentSession: (s: SessionPayload | null) => void;
}

export const useAppStore = create<AppState>((set, get) => {
  const settings = loadSettings();
  const profiles = loadProfiles();
  const activeProfileId = loadActiveProfileId(profiles);
  return {
    settings,
    hand: settings.handDefault,
    profiles,
    activeProfileId,
    sessions: [],
    currentSession: null,

    updateSettings: (partial) => {
      const next = normalizeAppSettings({ ...get().settings, ...partial });
      saveSettings(next);
      set({ settings: next });
    },

    setHand: (h) => {
      set({ hand: h });
      const s = get().settings;
      const next = normalizeAppSettings({ ...s, handDefault: h });
      saveSettings(next);
      set({ settings: next });
    },

    setActiveProfile: (profileId) => {
      if (!get().profiles.some(profile => profile.profileId === profileId)) return;
      saveActiveProfileId(profileId);
      set({ activeProfileId: profileId });
    },

    saveProfile: (profile) => {
      const normalized = normalizeProfile({
        ...profile,
        updatedAtIso: new Date().toISOString(),
      }, profile.name || 'Person');
      const current = get().profiles;
      const existingIndex = current.findIndex(item => item.profileId === normalized.profileId);
      const nextProfiles = existingIndex >= 0
        ? current.map(item => (item.profileId === normalized.profileId ? normalized : item))
        : [...current, normalized];
      saveProfiles(nextProfiles);
      set({ profiles: nextProfiles });
      return normalized;
    },

    createProfile: (name) => {
      const created = createProfile(name ?? `Person ${get().profiles.length + 1}`);
      const nextProfiles = [...get().profiles, created];
      saveProfiles(nextProfiles);
      saveActiveProfileId(created.profileId);
      set({
        profiles: nextProfiles,
        activeProfileId: created.profileId,
      });
      return created;
    },

    deleteProfile: (profileId) => {
      const current = get().profiles;
      if (current.length <= 1) return;
      const nextProfiles = current.filter(profile => profile.profileId !== profileId);
      if (nextProfiles.length === current.length) return;
      const nextActiveProfileId = get().activeProfileId === profileId
        ? nextProfiles[0].profileId
        : get().activeProfileId;
      saveProfiles(nextProfiles);
      saveActiveProfileId(nextActiveProfileId);
      set({
        profiles: nextProfiles,
        activeProfileId: nextActiveProfileId,
      });
    },

    refreshSessions: async () => {
      const list = await sessionDb.listSessions();
      set({ sessions: list });
    },

    saveSession: async (payload) => {
      await sessionDb.saveSession(payload);
      await get().refreshSessions();
    },

    loadSession: async (id) => {
      const s = await sessionDb.loadSession(id);
      if (s) set({ currentSession: s });
      return s;
    },

    setCurrentSession: (s) => set({ currentSession: s }),
  };
});
