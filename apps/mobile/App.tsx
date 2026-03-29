import { StatusBar } from 'expo-status-bar';
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
import type { TodayResponse } from './src/types/api.types';
import { useAuthStore } from './src/stores/auth.store';

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

export default function App() {
  const { accessToken, userRole, hasHydrated, setSession, clearSession } = useAuthStore();

  const [email, setEmail] = useState('atleta.today@example.com');
  const [password, setPassword] = useState('');
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => Boolean(accessToken), [accessToken]);

  const loadToday = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{ data: TodayResponse }>('/athletes/me/today');
      setToday(response.data.data);
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo cargar el día de hoy';
      setError(message);
      setToday(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && userRole === 'athlete') {
      void loadToday();
    } else if (isAuthenticated && userRole && userRole !== 'athlete') {
      setToday(null);
      setError('Este corte mobile está preparado solo para atletas.');
    }
  }, [isAuthenticated, userRole, loadToday]);

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
    setToday(null);
    setError(null);
  }, [clearSession]);

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

            <Pressable style={styles.primaryButton} onPress={loadToday} disabled={loading}>
              <Text style={styles.primaryButtonText}>{loading ? 'Actualizando...' : 'Recargar today'}</Text>
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
              <Text style={styles.muted}>Sesión: {today.session.id}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
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
