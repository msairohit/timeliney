import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useEventStore } from '../store/eventStore';
import { View, StyleSheet } from 'react-native';
import { useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import LoadingScreen from '../components/LoadingScreen';
import * as Notifications from 'expo-notifications';
import { syncAnniversaryNotifications } from '../utils/notifications';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { user, setLoading, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const events = useEventStore((state) => state.events);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Initial fetch of events if user is already logged in
    if (user?.uid) {
      // Security/Isolation check: If local events exist but belong to a different user, clear them first
      const currentEvents = useEventStore.getState().events;
      if (currentEvents.length > 0 && currentEvents[0].userId !== user.uid) {
        console.log('Clearing mismatched local events for new user session');
        useEventStore.getState().clearEvents();
      }
      
      // Background auto-sync check on startup
      const runStartSync = async () => {
        try {
          // Reset any stale reauth status from a previous session
          useAuthStore.getState().setNeedsReauth(false);

          // 1. Fetch remote events (pull changes)
          await useEventStore.getState().fetchEvents(user.uid);

          // 2. Push local events if any are unsynced
          const eventsToCheck = useEventStore.getState().events;
          const hasUnsynced = eventsToCheck.some(e => e.syncStatus !== 'synced');
          if (hasUnsynced) {
            await useEventStore.getState().syncEvents(user.uid);
          }
        } catch (error) {
          console.error('Start auto-sync failed:', error);
        }
      };

      runStartSync();
    }
    
    // Once we have the user state (either logged in or null), we can hide the splash screen
    if (isMounted) {
      setLoading(false);
      SplashScreen.hideAsync();
    }
  }, [user?.uid, isMounted]);

  useEffect(() => {
    if (!isMounted || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated and trying to access auth screens
      router.replace('/');
    }
  }, [user, segments, isLoading, isMounted]);

  useEffect(() => {
    if (!isMounted || isLoading) return;

    if (
      lastNotificationResponse &&
      lastNotificationResponse.notification.request.content.data.eventId &&
      lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const eventId = lastNotificationResponse.notification.request.content.data.eventId;
      // Use set timeout to ensure navigation occurs after initial routing completes
      setTimeout(() => {
        router.push(`/event/${eventId}`);
      }, 100);
    }
  }, [lastNotificationResponse, isMounted, isLoading]);

  useEffect(() => {
    if (isMounted && events.length > 0) {
      syncAnniversaryNotifications(events);
    }
  }, [events, isMounted]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f8fafc' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="timeline" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="sync" />
        <Stack.Screen name="statistics" />
        <Stack.Screen name="event/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="event/[id]" />
      </Stack>
      {isLoading && <LoadingScreen />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
