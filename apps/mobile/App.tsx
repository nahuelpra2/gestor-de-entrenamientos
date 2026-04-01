import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiClient } from './src/api/client';
import { TODAY_QUERY_KEY } from './src/api/today';
import { getSessionStartBlocker } from './src/api/sessions';
import { useToday, useTodayActions } from './src/hooks/useToday';
import { queryClient } from './src/query-client';
import { useAuthStore } from './src/stores/auth.store';
import type { CompleteSessionInput, TodayResponse } from './src/types/workout';

type LoginApiResponse = {
  data: {
    access_token: string;
    refresh_token: string;
    user: {
      id: string;
      role: 'coach' | 'athlete';
    };
  };
};

function AppContent() {
  const { accessToken, userRole, hasHydrated, setSession, clearSession } = useAuthStore();

  const [email, setEmail] = useState('atleta.today@example.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => Boolean(accessToken), [accessToken]);
  const todayQuery = useToday(isAuthenticated && userRole === 'athlete');
  const today = todayQuery.data ?? null;
  const { startSessionMutation, completeSessionMutation, abandonSessionMutation } = useTodayActions();
  const sessionStartBlocker = getSessionStartBlocker(todayQuery.data);

  useEffect(() => {
    if (isAuthenticated && userRole && userRole !== 'athlete') {
      setError('Este corte mobile está preparado solo para atletas.');
    }
  }, [isAuthenticated, userRole]);

  useEffect(() => {
    if (todayQuery.error) {
      const queryError: any = todayQuery.error;
      const message = queryError?.response?.data?.message ?? queryError?.message ?? 'No se pudo cargar el día de hoy';
      setError(Array.isArray(message) ? message.join(', ') : message);
    }
  }, [todayQuery.error]);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<LoginApiResponse>('/auth/login', {
        email,
        password,
      });

      const session = response.data.data;

      setSession({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        userId: session.user.id,
        userRole: session.user.role,
      });
      setPassword('');
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo iniciar sesión';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }, [email, password, setSession]);

  const handleLogout = useCallback(async () => {
    clearSession();
    setError(null);
    setActionMessage(null);
    queryClient.removeQueries({ queryKey: TODAY_QUERY_KEY });
  }, [clearSession]);

  const handleStartSession = useCallback(async () => {
    setError(null);
    setActionMessage(null);

    if (!today) {
      return;
    }

    try {
      await startSessionMutation.mutateAsync(today);
      setActionMessage('Sesión iniciada. Today debería pasar de pending a in_progress.');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        await todayQuery.refetch();
        const resumedToday = queryClient.getQueryData<TodayResponse>(TODAY_QUERY_KEY);
        setActionMessage(
          resumedToday?.status === 'in_progress'
            ? 'Conflicto detectado: se refrescó today y podés reanudar la sesión en progreso.'
            : 'Conflicto detectado: se refrescó today, pero no apareció una sesión reanudable.',
        );
        return;
      }

      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo iniciar la sesión';
      setError(Array.isArray(message) ? message.join(', ') : message);
    }
  }, [startSessionMutation, today, todayQuery]);

  const handleCompleteSession = useCallback(async () => {
    if (today?.status !== 'in_progress') {
      return;
    }

    setError(null);
    setActionMessage(null);

    try {
      const payload: CompleteSessionInput = { completedAt: new Date().toISOString() };
      await completeSessionMutation.mutateAsync({ sessionId: today.session.id, input: payload });
      setActionMessage('Sesión completada. Today debería pasar de in_progress a already_done.');
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo completar la sesión';
      setError(Array.isArray(message) ? message.join(', ') : message);
    }
  }, [completeSessionMutation, today]);

  const handleAbandonSession = useCallback(async () => {
    if (today?.status !== 'in_progress') {
      return;
    }

    setError(null);
    setActionMessage(null);

    try {
      await abandonSessionMutation.mutateAsync(today.session.id);
      setActionMessage('Sesión abandonada. Today debería volver de in_progress a pending.');
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo abandonar la sesión';
      setError(Array.isArray(message) ? message.join(', ') : message);
    }
  }, [abandonSessionMutation, today]);

  const isTodayLoading = todayQuery.isLoading || todayQuery.isFetching;
  const isActionLoading = startSessionMutation.isPending || completeSessionMutation.isPending || abandonSessionMutation.isPending;

  if (!hasHydrated) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1e6b5c" />
          <Text style={styles.muted}>Cargando sesión...</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />

      {!isAuthenticated ? (
        <View style={styles.authContainer}>
          <Text style={styles.eyebrow}>Trainr mobile</Text>
          <Text style={styles.title}>Login atleta</Text>
          <Text style={styles.help}>
            Configurá `EXPO_PUBLIC_API_URL` en `apps/mobile/.env` apuntando a tu backend local.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#6b7b7a"
            style={styles.input}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#6b7b7a"
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>Hoy</Text>
              <Text style={styles.title}>Estado del entrenamiento</Text>
            </View>

            <Pressable style={styles.secondaryButton} onPress={handleLogout}>
              <Text style={styles.secondaryButtonText}>Salir</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Estado</Text>
            <Text style={styles.statusValue}>{today?.status ?? 'sin cargar'}</Text>

             {error ? <Text style={styles.error}>{error}</Text> : null}
             {actionMessage ? <Text style={styles.success}>{actionMessage}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={() => void todayQuery.refetch()} disabled={isTodayLoading}>
              <Text style={styles.primaryButtonText}>{isTodayLoading ? 'Actualizando...' : 'Recargar today'}</Text>
            </Pressable>
          </View>

          {today?.status === 'pending' || today?.status === 'in_progress' ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Training day</Text>
                <Text style={styles.dayName}>{today.trainingDay.name ?? 'Sin nombre'}</Text>
                <Text style={styles.muted}>Ejercicios: {today.trainingDay.exercises.length}</Text>
              </View>

              <View style={styles.list}>
                {today.trainingDay.exercises.map((item) => (
                  <View key={item.id} style={styles.exerciseCard}>
                    <Text style={styles.exerciseName}>{item.exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>Sets: {item.setsTarget}</Text>
                    <Text style={styles.exerciseMeta}>Reps: {item.repsTarget}</Text>
                  </View>
                ))}
              </View>

              {today.status === 'pending' ? (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Sesión</Text>
                  <Text style={styles.muted}>Demo esperada: pending -&gt; in_progress</Text>
                  {sessionStartBlocker ? <Text style={styles.warning}>{sessionStartBlocker}</Text> : null}
                  <Pressable
                    style={[styles.primaryButton, sessionStartBlocker ? styles.buttonDisabled : null]}
                    onPress={handleStartSession}
                    disabled={Boolean(sessionStartBlocker) || isActionLoading}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isActionLoading ? 'Procesando...' : 'Iniciar sesión'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {today.status === 'in_progress' ? (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Sesión activa</Text>
                  <Text style={styles.muted}>Sesión: {today.session.id}</Text>
                  <Text style={styles.muted}>Demo esperada: in_progress -&gt; already_done / pending</Text>

                  <Pressable style={styles.primaryButton} onPress={handleCompleteSession} disabled={isActionLoading}>
                    <Text style={styles.primaryButtonText}>
                      {isActionLoading ? 'Procesando...' : 'Completar sesión'}
                    </Text>
                  </Pressable>

                  <Pressable style={styles.secondaryButton} onPress={handleAbandonSession} disabled={isActionLoading}>
                    <Text style={styles.secondaryButtonText}>Abandonar sesión</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}

          {today?.status === 'rest_day' ? (
            <View style={styles.card}>
              <Text style={styles.dayName}>Hoy toca descanso</Text>
              <Text style={styles.muted}>
                Próximo día: {today.nextTrainingDay?.name ?? 'sin próximo día configurado'}
              </Text>
            </View>
          ) : null}

          {today?.status === 'no_plan' ? (
            <View style={styles.card}>
              <Text style={styles.dayName}>No hay plan activo</Text>
              {today.startsAt ? <Text style={styles.muted}>Empieza: {today.startsAt}</Text> : null}
            </View>
          ) : null}

          {today?.status === 'plan_completed' ? (
            <View style={styles.card}>
              <Text style={styles.dayName}>Plan completado</Text>
              <Text style={styles.muted}>Assignment: {today.assignmentId}</Text>
            </View>
          ) : null}

          {today?.status === 'already_done' ? (
            <View style={styles.card}>
              <Text style={styles.dayName}>Entrenamiento ya realizado</Text>
              <Text style={styles.muted}>Assignment: {today.assignmentId}</Text>
              <Text style={styles.muted}>Sesión: {today.session.id}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4efe6',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#1e6b5c',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e2d2a',
  },
  help: {
    color: '#526360',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7cdc0',
    backgroundColor: '#fffaf3',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e2d2a',
  },
  primaryButton: {
    backgroundColor: '#1e6b5c',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#f7f4ed',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1e6b5c',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#1e6b5c',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fffaf3',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  cardLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#7c6f60',
  },
  statusValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e2d2a',
  },
  dayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e2d2a',
  },
  muted: {
    color: '#5e6d69',
  },
  error: {
    color: '#9f2d1f',
    lineHeight: 20,
  },
  success: {
    color: '#1e6b5c',
    lineHeight: 20,
  },
  warning: {
    color: '#8a5a14',
    lineHeight: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  list: {
    gap: 12,
  },
  exerciseCard: {
    backgroundColor: '#1f2a28',
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  exerciseName: {
    color: '#f7f4ed',
    fontSize: 18,
    fontWeight: '700',
  },
  exerciseMeta: {
    color: '#d6e2df',
    fontSize: 15,
  },
});
