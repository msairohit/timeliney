import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

import { LifeEvent } from '../types';

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export async function scheduleEventNotification(
  eventId: string,
  title: string,
  eventDateString: string,
  eventTimeString: string | undefined,
  daysBefore: number,
  reminderTimeString: string | undefined
): Promise<string | undefined> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.log('Notification permission not granted');
    return undefined;
  }

  try {
    // Parse the event date
    // eventDateString format is YYYY-MM-DD
    const dateParts = eventDateString.split('-');
    if (dateParts.length !== 3) return undefined;
    
    let targetDate = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );

    // Default time is 9:00 AM
    let hours = 9;
    let minutes = 0;

    // Use reminderTimeString if provided, otherwise default to 9 AM
    const timeToParse = reminderTimeString || '09:00 AM';

    if (timeToParse && timeToParse.includes(':')) {
      const timeParts = timeToParse.split(/[: ]/);
      if (timeParts.length >= 2) {
        let h = parseInt(timeParts[0]);
        const m = parseInt(timeParts[1]);
        const ampm = timeParts[2]?.toLowerCase();
        
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        
        hours = h;
        minutes = m;
      }
    }

    targetDate.setHours(hours, minutes, 0, 0);

    // Subtract daysBefore
    targetDate.setDate(targetDate.getDate() - daysBefore);

    // If the target date is in the past, don't schedule
    if (targetDate.getTime() < Date.now()) {
      console.log('Cannot schedule notification in the past');
      return undefined;
    }

    let notificationTitle = `🗓️ ${title}`;
    let notificationBody = `It's happening today! 🚀`;
    
    if (daysBefore === 1) {
      notificationBody = `Coming up tomorrow! Get ready! ✨`;
    } else if (daysBefore > 1) {
      notificationBody = `Coming up in ${daysBefore} days! Mark your calendar! ⏰`;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationTitle,
        body: notificationBody,
        data: { eventId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return undefined;
  }
}

export async function cancelNotification(notificationId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

export async function syncAnniversaryNotifications(events: LifeEvent[]) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    
    // Find all currently scheduled anniversary notifications
    const anniversaryNotificationIds = scheduled
      .filter(n => n.content.data?.type === 'anniversary')
      .map(n => n.identifier);

    // Cancel them all to start fresh
    for (const id of anniversaryNotificationIds) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = Date.now();

    const upcomingAnniversaries = events
      .filter(e => {
        const parts = e.eventDate.split('-');
        if (parts.length !== 3) return false;
        const year = parseInt(parts[0]);
        return year < today.getFullYear(); // Must be a past event
      })
      .map(e => {
        const parts = e.eventDate.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);

        let targetDate = new Date(today.getFullYear(), month, day, 9, 0, 0);
        
        // If it already passed this year, the next one is next year
        if (targetDate.getTime() < now) {
          targetDate = new Date(today.getFullYear() + 1, month, day, 9, 0, 0);
        }
        
        const yearsAgo = targetDate.getFullYear() - year;
        
        return {
          event: e,
          targetDate,
          yearsAgo
        };
      })
      .sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime())
      .slice(0, 30); // Schedule next 30 to respect OS limits (iOS is 64 total)

    for (const { event, targetDate, yearsAgo } of upcomingAnniversaries) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Years Ago Today 🗓️',
          body: `On this day ${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago: ${event.title}`,
          data: { eventId: event.id, type: 'anniversary' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
        },
      });
    }
  } catch (error) {
    console.error('Error syncing anniversary notifications:', error);
  }
}
