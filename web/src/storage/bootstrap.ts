const RESET_VERSION_KEY = 'fingerforce-storage-reset-version';
const RESET_VERSION = 'v1_5_workout_engine_v1';

const LOCAL_STORAGE_KEYS_TO_CLEAR = [
  'fingerforce-settings',
  'fingerforce-test-results-v1',
  'fingerforce-test-results-v2',
  'fingerforce-custom-test-templates-v1',
  'fingerforce-custom-train-workouts-v1',
];

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }

    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function runStorageResetIfNeeded(): Promise<void> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  try {
    if (localStorage.getItem(RESET_VERSION_KEY) === RESET_VERSION) {
      return;
    }

    for (const key of LOCAL_STORAGE_KEYS_TO_CLEAR) {
      localStorage.removeItem(key);
    }

    await deleteIndexedDb('fingerforce');
    localStorage.setItem(RESET_VERSION_KEY, RESET_VERSION);
  } catch {
    // Ignore reset failure and allow app startup.
  }
}
