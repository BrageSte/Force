import { useEffect, useMemo, useState } from 'react';
import { FINGER_NAMES } from '../../constants/fingers.ts';
import { useAppStore } from '../../stores/appStore.ts';
import type { UserProfile } from '../../types/profile.ts';
import { Section } from '../shared/Section.tsx';
import { FormField } from '../shared/FormField.tsx';

export function ProfileEditorSection() {
  const profiles = useAppStore(s => s.profiles);
  const activeProfileId = useAppStore(s => s.activeProfileId);
  const setActiveProfile = useAppStore(s => s.setActiveProfile);
  const saveProfile = useAppStore(s => s.saveProfile);
  const createProfile = useAppStore(s => s.createProfile);
  const deleteProfile = useAppStore(s => s.deleteProfile);

  const activeProfile = useMemo(
    () => profiles.find(profile => profile.profileId === activeProfileId) ?? profiles[0] ?? null,
    [activeProfileId, profiles],
  );

  const [draft, setDraft] = useState<UserProfile | null>(activeProfile);

  useEffect(() => {
    setDraft(activeProfile);
  }, [activeProfile]);

  if (!draft) return null;

  const updateDraft = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setDraft(current => (current ? { ...current, [key]: value } : current));
  };

  const updateInjuredFinger = (index: number, checked: boolean) => {
    setDraft(current => {
      if (!current) return current;
      const next = [...current.injuredFingers] as UserProfile['injuredFingers'];
      next[index] = checked;
      return { ...current, injuredFingers: next };
    });
  };

  const handleSave = () => {
    if (!draft.name.trim()) return;
    saveProfile({
      ...draft,
      name: draft.name.trim(),
    });
  };

  const handleCreate = () => {
    const created = createProfile(`Person ${profiles.length + 1}`);
    setDraft(created);
  };

  const handleDelete = () => {
    if (profiles.length <= 1) return;
    if (!window.confirm(`Delete profile "${draft.name}"?`)) return;
    deleteProfile(draft.profileId);
  };

  return (
    <Section title="Profile">
      <p className="text-xs text-muted mb-3">
        Profiles separate people, injuries, dominant hand, tests and training history. New test, train and session data are saved on the active profile.
      </p>

      <div className="flex gap-2 flex-wrap mb-4">
        <select
          value={activeProfileId}
          onChange={e => setActiveProfile(e.target.value)}
          className="bg-surface-alt border border-border rounded-lg px-3 py-1.5 text-sm text-text min-w-[200px]"
        >
          {profiles.map(profile => (
            <option key={profile.profileId} value={profile.profileId}>
              {profile.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-text border border-border"
        >
          New Profile
        </button>
        <button
          onClick={handleSave}
          disabled={!draft.name.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white disabled:opacity-40"
        >
          Save Profile
        </button>
        <button
          onClick={handleDelete}
          disabled={profiles.length <= 1}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-danger/15 text-danger border border-danger/25 disabled:opacity-40"
        >
          Delete
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Name">
          <input
            type="text"
            value={draft.name}
            onChange={e => updateDraft('name', e.target.value)}
            className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
          />
        </FormField>

        <FormField label="Sex">
          <select
            value={draft.sex}
            onChange={e => updateDraft('sex', e.target.value as UserProfile['sex'])}
            className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
          >
            <option value="Unspecified">Unspecified</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </FormField>

        <FormField label="Weight (kg)">
          <input
            type="number"
            min={0}
            step="0.1"
            value={draft.weightKg ?? ''}
            onChange={e => updateDraft('weightKg', e.target.value === '' ? null : Number(e.target.value))}
            className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
          />
        </FormField>

        <FormField label="Height (cm)">
          <input
            type="number"
            min={0}
            step="1"
            value={draft.heightCm ?? ''}
            onChange={e => updateDraft('heightCm', e.target.value === '' ? null : Number(e.target.value))}
            className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
          />
        </FormField>

        <FormField label="Dominant Hand">
          <select
            value={draft.dominantHand}
            onChange={e => updateDraft('dominantHand', e.target.value as UserProfile['dominantHand'])}
            className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
          >
            <option value="Right">Right</option>
            <option value="Left">Left</option>
          </select>
        </FormField>
      </div>

      <div className="mt-4">
        <div className="text-xs text-muted mb-2">Injured Fingers</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {FINGER_NAMES.map((name, index) => (
            <label
              key={name}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs text-text"
            >
              <input
                type="checkbox"
                checked={draft.injuredFingers[index]}
                onChange={e => updateInjuredFinger(index, e.target.checked)}
                className="accent-blue-500"
              />
              <span>{name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mt-4">
        <FormField label="Injury Notes">
          <textarea
            value={draft.injuryNotes}
            onChange={e => updateDraft('injuryNotes', e.target.value)}
            rows={3}
            className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
          />
        </FormField>
        <FormField label="General Notes">
          <textarea
            value={draft.notes}
            onChange={e => updateDraft('notes', e.target.value)}
            rows={3}
            className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
          />
        </FormField>
      </div>
    </Section>
  );
}

