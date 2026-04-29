import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

let refreshPromise: Promise<string | null> | null = null;

interface User {
  uid: string;
  email: string;
  username: string;
  displayName?: string | null;
  photo?: string | null;
  accessToken?: string; // For Google Drive API
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      logout: () => set({ user: null, isLoading: false }),
      refreshAccessToken: async () => {
        // Prevent multiple concurrent refresh calls
        if (refreshPromise) {
          return refreshPromise;
        }

        refreshPromise = (async () => {
          const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
          try {
            const currentUser = get().user;
            if (!currentUser) return null;

            // On Android, sometimes we need to clear the cache to get a fresh token
            if (currentUser.accessToken && (await import('react-native')).Platform.OS === 'android') {
              try {
                await GoogleSignin.clearCachedAccessToken(currentUser.accessToken);
              } catch (e) {
                // Ignore error if clearing fails
              }
            }

            // Attempt to sign in silently to refresh tokens if needed
            await GoogleSignin.signInSilently();
            const { accessToken } = await GoogleSignin.getTokens();
            
            if (accessToken) {
              set({ user: { ...currentUser, accessToken } });
              return accessToken;
            }
            return null;
          } catch (error) {
            console.error('Failed to refresh access token:', error);
            return null;
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
