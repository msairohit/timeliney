import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LifeEvent } from '../types';
import { GoogleDriveService } from '../utils/googleDriveService';
import { useAuthStore } from './authStore';

interface EventState {
  events: LifeEvent[];
  addEvent: (event: LifeEvent) => void;
  updateEvent: (id: string, updatedEvent: Partial<LifeEvent>) => void;
  deleteEvent: (id: string) => void;
  getEventById: (id: string) => LifeEvent | undefined;
  syncEvents: (userId: string) => Promise<void>;
  fetchEvents: (userId: string) => Promise<void>;
  clearEvents: () => void;
}

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      events: [],
      addEvent: (event) => {
        set((state) => ({ 
          events: [...state.events, { ...event, syncStatus: 'local' }] 
        }));
        // Auto-sync
        const user = useAuthStore.getState().user;
        if (user && user.accessToken) {
          get().syncEvents(user.uid);
        }
      },
      updateEvent: (id, updatedEvent) => {
        set((state) => ({
          events: state.events.map((e) => 
            e.id === id ? { ...e, ...updatedEvent, syncStatus: 'pending', updatedAt: new Date().toISOString() } : e
          ),
        }));
        const user = useAuthStore.getState().user;
        if (user && user.accessToken) {
          get().syncEvents(user.uid);
        }
      },
      deleteEvent: (id) => {
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        }));
        const user = useAuthStore.getState().user;
        if (user && user.accessToken) {
          get().syncEvents(user.uid);
        }
      },
      getEventById: (id) => get().events.find((e) => e.id === id),
      clearEvents: () => set({ events: [] }),
      
      syncEvents: async (userId) => {
        const user = useAuthStore.getState().user;
        if (!user || !user.accessToken) {
          console.log("Sync skipped: No valid user or accessToken");
          return;
        }

        const driveService = new GoogleDriveService(user.accessToken);
        const { events } = get();
        
        // Find events that need media upload
        const pendingEvents = events.filter(e => 
          e.localMediaUris?.length > 0 || e.localDocumentUris?.length > 0
        );

        let updatedEvents = [...events];
        let hasChanges = false;

        for (const event of pendingEvents) {
          let mediaUrls = [...(event.mediaUrls || [])];
          let documentUrls = [...(event.documentUrls || [])];
          let eventNeedsUpdate = false;

          // Upload media
          if (event.localMediaUris) {
            for (const uri of event.localMediaUris) {
              if (uri.startsWith('http')) continue;
              
              const filename = uri.split('/').pop() || `image_${Date.now()}`;
              const fileId = await driveService.uploadMedia(uri, filename);
              if (fileId) {
                mediaUrls.push(fileId);
                eventNeedsUpdate = true;
              }
            }
          }

          // Upload documents
          if (event.localDocumentUris) {
            for (let i = 0; i < event.localDocumentUris.length; i++) {
              const uri = event.localDocumentUris[i];
              if (uri.startsWith('http')) continue;

              const filename = event.documentNames?.[i] || uri.split('/').pop() || `doc_${Date.now()}`;
              const fileId = await driveService.uploadMedia(uri, filename);
              if (fileId) {
                documentUrls.push(fileId);
                eventNeedsUpdate = true;
              }
            }
          }

          if (eventNeedsUpdate) {
            const idx = updatedEvents.findIndex(e => e.id === event.id);
            if (idx !== -1) {
              updatedEvents[idx] = {
                ...updatedEvents[idx],
                mediaUrls: [...new Set(mediaUrls)],
                documentUrls: [...new Set(documentUrls)],
                localMediaUris: [], // Clear local URIs once uploaded
                localDocumentUris: [],
                syncStatus: 'synced',
                updatedAt: new Date().toISOString()
              };
              hasChanges = true;
            }
          }
        }

        if (hasChanges) {
          set({ events: updatedEvents });
        }

        // Save entire state to Google Drive
        const success = await driveService.saveAppData(get().events);
        if (success) {
          console.log("Sync to Google Drive successful!");
          // Mark all as synced
          set((state) => ({
            events: state.events.map(e => ({ ...e, syncStatus: 'synced' }))
          }));
        } else {
          console.error("Sync to Google Drive failed.");
        }
      },

      fetchEvents: async (userId) => {
        const user = useAuthStore.getState().user;
        if (!user || !user.accessToken) return;

        const driveService = new GoogleDriveService(user.accessToken);
        const remoteEvents = await driveService.fetchAppData();

        if (remoteEvents) {
          const localEvents = get().events;
          
          // Merge logic: prefer remote if remote is newer
          const mergedEvents = [...localEvents];
          
          remoteEvents.forEach(remote => {
            const localIndex = mergedEvents.findIndex(l => l.id === remote.id);
            if (localIndex === -1) {
              mergedEvents.push({ ...remote, syncStatus: 'synced' });
            } else {
              const local = mergedEvents[localIndex];
              if (new Date(remote.updatedAt) > new Date(local.updatedAt)) {
                mergedEvents[localIndex] = { ...remote, syncStatus: 'synced' };
              }
            }
          });

          set({ events: mergedEvents });
        }
      }
    }),
    {
      name: 'timeline-events-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
