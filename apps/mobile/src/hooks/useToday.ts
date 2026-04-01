import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TODAY_QUERY_KEY,
  abandonSession,
  completeSession,
  createSession,
  getSessionStartBlocker,
  isSessionConflictError,
  resolveCreateSessionConflict,
} from '../api/sessions';
import { getToday } from '../api/today';
import type { SessionConflictResolution, TodayResponse } from '../types/workout';

export function useToday(enabled = true) {
  return useQuery<TodayResponse>({
    queryKey: TODAY_QUERY_KEY,
    queryFn: getToday,
    enabled,
  });
}

export function useTodayActions() {
  const queryClient = useQueryClient();

  const invalidateToday = async () => {
    await queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY });
    await queryClient.refetchQueries({ queryKey: TODAY_QUERY_KEY, type: 'active' });
  };

  const startSessionMutation = useMutation({
    mutationFn: async (today: TodayResponse) => {
      const blocker = getSessionStartBlocker(today);
      if (blocker) {
        throw new Error(blocker);
      }

      if (today.status !== 'pending') {
        throw new Error('Solo se puede iniciar una sesión desde un today pendiente');
      }

      return createSession({
        planAssignmentId: today.assignmentId,
        trainingDayId: today.trainingDay.id,
      });
    },
    onSuccess: invalidateToday,
    onError: async (error) => {
      if (isSessionConflictError(error)) {
        const resolution = await resolveCreateSessionConflict();
        queryClient.setQueryData(TODAY_QUERY_KEY, resolution.today);
      }
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input?: { perceivedEffort?: number; notes?: string; completedAt?: string } }) =>
      completeSession(sessionId, input),
    onSuccess: invalidateToday,
  });

  const abandonSessionMutation = useMutation({
    mutationFn: abandonSession,
    onSuccess: invalidateToday,
  });

  return {
    startSessionMutation,
    completeSessionMutation,
    abandonSessionMutation,
  };
}
