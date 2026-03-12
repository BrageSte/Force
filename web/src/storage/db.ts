import { openDB, type DBSchema } from 'idb';
import type { SessionPayload } from '../types/force.ts';
import type { TrainSessionResult } from '../components/train/types.ts';

export interface ForceDB extends DBSchema {
  sessions: {
    key: string;
    value: SessionPayload;
    indexes: {
      'by-date': string;
    };
  };
  trainingSessions: {
    key: string;
    value: TrainSessionResult;
    indexes: {
      'by-date': string;
    };
  };
}

export const DB_NAME = 'fingerforce';
export const DB_VERSION = 2;

export function getDB() {
  return openDB<ForceDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'sessionId' });
        store.createIndex('by-date', 'startedAtIso');
      }

      if (!db.objectStoreNames.contains('trainingSessions')) {
        const store = db.createObjectStore('trainingSessions', { keyPath: 'trainSessionId' });
        store.createIndex('by-date', 'startedAtIso');
      }
    },
  });
}
