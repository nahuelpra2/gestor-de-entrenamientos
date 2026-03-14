import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'session' | 'workout_log' | 'measurement';
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  payload: Record<string, unknown>;
  idempotencyKey: string;  // UUID generado cuando el usuario hizo la acción
  clientTimestamp: string; // ISO8601
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  status: 'pending' | 'failed';
  lastError: string | null;
  createdAt: string;
}

interface OfflineQueueState {
  operations: OfflineOperation[];
  addOperation: (op: Omit<OfflineOperation, 'id' | 'retryCount' | 'nextRetryAt' | 'status' | 'lastError' | 'createdAt'>) => void;
  updateOperation: (id: string, updates: Partial<OfflineOperation>) => void;
  removeOperation: (id: string) => void;
  markAsFailed: (id: string, error: string) => void;
  getPendingOperations: () => OfflineOperation[];
  hasPending: () => boolean;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      operations: [],

      addOperation: (op) => {
        const newOp: OfflineOperation = {
          ...op,
          id: Math.random().toString(36).slice(2),
          retryCount: 0,
          nextRetryAt: null,
          status: 'pending',
          lastError: null,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ operations: [...state.operations, newOp] }));
      },

      updateOperation: (id, updates) => {
        set((state) => ({
          operations: state.operations.map((op) =>
            op.id === id ? { ...op, ...updates } : op,
          ),
        }));
      },

      removeOperation: (id) => {
        set((state) => ({
          operations: state.operations.filter((op) => op.id !== id),
        }));
      },

      markAsFailed: (id, error) => {
        get().updateOperation(id, { status: 'failed', lastError: error });
      },

      getPendingOperations: () => {
        const now = new Date();
        return get().operations.filter(
          (op) =>
            op.status === 'pending' &&
            (op.nextRetryAt === null || new Date(op.nextRetryAt) <= now),
        );
      },

      hasPending: () => {
        return get().operations.some((op) => op.status === 'pending');
      },
    }),
    {
      name: 'offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
