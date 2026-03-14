import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Singleton de refresh ─────────────────────────────────────────────────────
// Problema a resolver: si N requests fallan con 401 simultáneamente, sin este
// mecanismo cada una dispararía su propio refresh. El primero rotaría el token
// exitosamente; los N-1 restantes enviarían el token ya revocado, activando la
// detección de robo y cerrando la sesión del usuario.
//
// Solución: la primera llamada crea la promesa de refresh y todas las demás
// esperan la MISMA promesa. Cuando resuelve, todas reintentan con el nuevo token.
let refreshPromise: Promise<boolean> | null = null;

// Bandera en el config del request para evitar reintentos infinitos
const RETRY_MARKER = '__retried';

// ─── Request interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor ────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config as AxiosRequestConfig & { [RETRY_MARKER]?: boolean };

    // 401 → intentar refresh una sola vez por request original
    if (status === 401 && config && !config[RETRY_MARKER]) {
      config[RETRY_MARKER] = true;

      // Compartir la promesa de refresh entre requests concurrentes
      if (!refreshPromise) {
        refreshPromise = tryRefreshToken().finally(() => {
          refreshPromise = null;
        });
      }

      const refreshed = await refreshPromise;

      if (refreshed) {
        // Reintentar el request original con el nuevo token
        const newToken = await SecureStore.getItemAsync('access_token');
        if (config.headers) {
          (config.headers as any).Authorization = `Bearer ${newToken}`;
        }
        return apiClient.request(config);
      }

      // Refresh falló → sesión expirada, limpiar y notificar
      await clearSession();
      throw Object.assign(new Error('Sesión expirada'), { code: 'SESSION_EXPIRED' });
    }

    if (status === 403) {
      throw Object.assign(error, { code: 'FORBIDDEN' });
    }

    if (!error.response) {
      throw Object.assign(new Error('Sin conexión a internet'), { code: 'NETWORK_ERROR' });
    }

    throw error;
  },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function tryRefreshToken(): Promise<boolean> {
  try {
    const refreshToken = await SecureStore.getItemAsync('refresh_token');
    if (!refreshToken) return false;

    // Usar axios directamente (sin el interceptor) para evitar loops
    const response = await axios.post(
      `${API_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 10_000 },
    );

    const { access_token, refresh_token: newRefreshToken } = response.data.data;
    await SecureStore.setItemAsync('access_token', access_token);
    await SecureStore.setItemAsync('refresh_token', newRefreshToken);
    return true;
  } catch {
    return false;
  }
}

async function clearSession() {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
}
