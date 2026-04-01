import { apiClient } from './client';
import type { ApiEnvelope, TodayResponse } from '../types/workout';

export const TODAY_QUERY_KEY = ['today'] as const;

export async function getToday(): Promise<TodayResponse> {
  const response = await apiClient.get<ApiEnvelope<TodayResponse>>('/athletes/me/today');
  return response.data.data;
}
