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
  needsReauth: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setNeedsReauth: (needs: boolean) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
  reconnectGoogle: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      needsReauth: false,
      setUser: (user) => set({ user, isLoading: false, needsReauth: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      setNeedsReauth: (needsReauth) => set({ needsReauth }),
      logout: () => set({ user: null, isLoading: false, needsReauth: false }),
      refreshAccessToken: async () => {
        // Prevent multiple concurrent refresh calls
        if (refreshPromise) {
          return refreshPromise;
        }

        refreshPromise = (async () => {
          try {
            const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
            const { GOOGLE_CONFIG } = await import('../constants/GoogleConfig');
            GoogleSignin.configure({
              webClientId: GOOGLE_CONFIG.webClientId,
              iosClientId: GOOGLE_CONFIG.iosClientId,
              scopes: GOOGLE_CONFIG.scopes,
            });

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
              set({ user: { ...currentUser, accessToken }, needsReauth: false });
              return accessToken;
            }
            set({ needsReauth: true });
            return null;
          } catch (error) {
            console.error('Failed to refresh access token:', error);
            set({ needsReauth: true });
            return null;
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },
      reconnectGoogle: async () => {
        try {
          const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
          const { GOOGLE_CONFIG } = await import('../constants/GoogleConfig');
          GoogleSignin.configure({
            webClientId: GOOGLE_CONFIG.webClientId,
            iosClientId: GOOGLE_CONFIG.iosClientId,
            scopes: GOOGLE_CONFIG.scopes,
          });

          set({ isLoading: true });
          await GoogleSignin.hasPlayServices();
          const response = await GoogleSignin.signIn();
          
          if (response.type === 'success') {
            const userInfo = response.data;
            const { accessToken } = await GoogleSignin.getTokens();
            
            if (accessToken) {
              const currentUser = get().user;
              set({
                user: {
                  uid: userInfo.user.id,
                  email: userInfo.user.email,
                  username: userInfo.user.name || '',
                  displayName: userInfo.user.name,
                  photo: userInfo.user.photo,
                  accessToken: accessToken,
                },
                needsReauth: false,
                isLoading: false,
              });

              // Clear mismatched user data if logging in with a different user
              const { useEventStore } = await import('./eventStore');
              const currentEvents = useEventStore.getState().events;
              if (currentEvents.length > 0 && currentEvents[0].userId !== userInfo.user.id) {
                console.log('Clearing mismatched events during reconnect');
                useEventStore.getState().clearEvents();
              }

              // Run sync
              try {
                await useEventStore.getState().fetchEvents(userInfo.user.id);
                await useEventStore.getState().syncEvents(userInfo.user.id);
              } catch (syncError) {
                console.error('Sync failed after reconnection:', syncError);
              }

              return true;
            }
          }
          set({ isLoading: false });
          return false;
        } catch (error) {
          console.error('Failed to reconnect with Google:', error);
          set({ isLoading: false });
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
