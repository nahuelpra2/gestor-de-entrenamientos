import { AxiosError } from 'axios';
import { apiClient } from './client';
import { TODAY_QUERY_KEY, getToday } from './today';
import { generateIdempotencyKey } from '../lib/offline-queue';
import type {
  ApiEnvelope,
  CompleteSessionInput,
  CreateSessionInput,
  SessionConflictResolution,
  TodayResponse,
  WorkoutSession,
} from '../types/workout';

export async function createSession(input: CreateSessionInput): Promise<WorkoutSession> {
  const response = await apiClient.post<ApiEnvelope<WorkoutSession>>('/sessions', input, {
    headers: {
      'Idempotency-Key': generateIdempotencyKey(),
    },
  });

  return response.data.data;
}

export async function completeSession(
  sessionId: string,
  input: CompleteSessionInput = {},
): Promise<WorkoutSession> {
  const response = await apiClient.patch<ApiEnvelope<WorkoutSession>>(
    `/sessions/${sessionId}/complete`,
    input,
  );

  return response.data.data;
}

export async function abandonSession(sessionId: string): Promise<WorkoutSession> {
  const response = await apiClient.patch<ApiEnvelope<WorkoutSession>>(`/sessions/${sessionId}/abandon`);
  return response.data.data;
}

export async function resolveCreateSessionConflict(): Promise<SessionConflictResolution> {
  const today = await getToday();

  return {
    resumed: today.status === 'in_progress',
    today,
  };
}

export function isSessionConflictError(error: unknown): error is AxiosError<{ message?: string }> {
  return error instanceof AxiosError && error.response?.status === 409;
}

export function getSessionStartBlocker(today: TodayResponse | undefined): string | null {
  if (today?.status !== 'pending') {
    return null;
  }

  return today.assignmentId ? null : 'Bloqueado: today pendiente llegó sin assignmentId.';
}

export { TODAY_QUERY_KEY };
