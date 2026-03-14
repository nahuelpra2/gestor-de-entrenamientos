import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

// Adapter para usar SecureStore con zustand persist
const secureStorage = {
  getItem: async (name: string) => {
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

type UserRole = 'coach' | 'athlete';

interface AuthState {
  // Estado
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userRole: UserRole | null;

  // Acciones
  setSession: (params: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    userRole: UserRole;
  }) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      userRole: null,

      setSession: ({ accessToken, refreshToken, userId, userRole }) => {
        set({ accessToken, refreshToken, userId, userRole });
      },

      clearSession: () => {
        set({ accessToken: null, refreshToken: null, userId: null, userRole: null });
      },

      isAuthenticated: () => {
        return get().accessToken !== null;
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => secureStorage),
      // Solo persistir los tokens y datos mínimos necesarios
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userId: state.userId,
        userRole: state.userRole,
      }),
    },
  ),
);
