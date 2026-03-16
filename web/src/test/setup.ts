import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { afterEach, beforeEach, vi } from 'vitest'

function createStorage(): Storage {
  const data = new Map<string, string>()

  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key) {
      return data.has(key) ? data.get(key)! : null
    },
    key(index) {
      return Array.from(data.keys())[index] ?? null
    },
    removeItem(key) {
      data.delete(key)
    },
    setItem(key, value) {
      data.set(key, String(value))
    },
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: createStorage(),
  configurable: true,
})

Object.defineProperty(globalThis, 'sessionStorage', {
  value: createStorage(),
  configurable: true,
})

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  value: true,
  configurable: true,
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
  try {
    const db = await openDB('fingerforce', 2)
    const storeNames = Array.from(db.objectStoreNames)
    if (storeNames.length > 0) {
      const tx = db.transaction(storeNames, 'readwrite')
      for (const storeName of storeNames) {
        await tx.objectStore(storeName).clear()
      }
      await tx.done
    }
    db.close()
  } catch {
    // Database may not exist yet.
  }
})
