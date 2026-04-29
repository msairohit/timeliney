import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LifeEvent } from '../types';
import { GoogleDriveService } from '../utils/googleDriveService';
import { useAuthStore } from './authStore';

interface EventState {
  events: LifeEvent[];
  isSyncing: boolean;
  addEvent: (event: LifeEvent) => void;
  updateEvent: (id: string, updatedEvent: Partial<LifeEvent>) => void;
  deleteEvent: (id: string, options?: { deleteMedia: boolean }) => Promise<void>;
  cleanupMedia: (eventTitle: string, driveIds: string[], options: { deleteMedia: boolean }) => Promise<void>;
  getEventById: (id: string) => LifeEvent | undefined;
  syncEvents: (userId: string) => Promise<void>;
  fetchEvents: (userId: string) => Promise<void>;
  clearEvents: () => void;
  reorderGroupEvents: (groupId: string) => void;
}

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      events: [],
      isSyncing: false,
      addEvent: (event) => {
        const userId = useAuthStore.getState().user?.uid || 'local-user';
        set((state) => ({ 
          events: [...state.events, { ...event, userId, syncStatus: 'local' }] 
        }));
      },
      updateEvent: (id, updatedEvent) => {
        set((state) => ({
          events: state.events.map((e) => 
            e.id === id ? { ...e, ...updatedEvent, syncStatus: 'pending', updatedAt: new Date().toISOString() } : e
          ),
        }));
      },
      deleteEvent: async (id, options = { deleteMedia: false }) => {
        const eventToDelete = get().events.find((e) => e.id === id);
        if (!eventToDelete) return;

        const driveIdsToHandle = [
          ...(eventToDelete.mediaUrls || []),
          ...(eventToDelete.documentUrls || [])
        ];

        // 1. Immediate local state update
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        }));

        // 2. Perform Drive operations in the background
        const performDriveCleanup = async (isRetry = false) => {
          const user = useAuthStore.getState().user;
          if (!user || !user.accessToken) return;

          try {
            const driveService = new GoogleDriveService(user.accessToken);
            
            // Sync the updated event list to Drive first
            await get().syncEvents(user.uid);

              if (driveIdsToHandle.length > 0) {
                let backupFolderId: string | null = null;
                const rootFolderId = await driveService.getOrCreateFolder('Timeliney_Media');
                const eventFolderId = await driveService.getOrCreateFolder(eventToDelete.title, rootFolderId || undefined);

                if (!options.deleteMedia && rootFolderId) {
                  const deletedRootId = await driveService.getOrCreateFolder('deleted_events_media', rootFolderId);
                  if (deletedRootId) {
                    // Create a subfolder for this event inside deleted_events_media
                    backupFolderId = await driveService.getOrCreateFolder(eventToDelete.title, deletedRootId);
                  }
                }

                for (const fileId of driveIdsToHandle) {
                  // Verify if other events still use this file
                  const isStillUsed = get().events.some(e => 
                    e.mediaUrls?.includes(fileId) || e.documentUrls?.includes(fileId)
                  );

                  if (!isStillUsed) {
                    if (options.deleteMedia) {
                      await driveService.deleteFile(fileId);
                    } else if (backupFolderId) {
                      await driveService.moveFile(fileId, backupFolderId);
                    }
                  }
                }

                // Cleanup: Delete the event folder from Timeliney_Media if it's now empty
                if (eventFolderId) {
                  const filesInFolder = await driveService.listFilesInFolder(eventFolderId);
                  if (filesInFolder.length === 0) {
                    await driveService.deleteFile(eventFolderId);
                  }
                }
              }
          } catch (error: any) {
            if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED' && !isRetry) {
              await useAuthStore.getState().refreshAccessToken();
              return performDriveCleanup(true);
            }
            console.error('Error during Drive cleanup after deletion:', error);
          }
        };

        performDriveCleanup();
      },
      cleanupMedia: async (eventTitle, driveIds, options) => {
        const user = useAuthStore.getState().user;
        if (!user || !user.accessToken || driveIds.length === 0) return;

        const performCleanup = async (isRetry = false) => {
          try {
            const driveService = new GoogleDriveService(user.accessToken);
            let backupFolderId: string | null = null;
            const rootFolderId = await driveService.getOrCreateFolder('Timeliney_Media');
            const eventFolderId = await driveService.getOrCreateFolder(eventTitle, rootFolderId || undefined);

            if (!options.deleteMedia && rootFolderId) {
              const deletedRootId = await driveService.getOrCreateFolder('deleted_events_media', rootFolderId);
              if (deletedRootId) {
                backupFolderId = await driveService.getOrCreateFolder(eventTitle, deletedRootId);
              }
            }

            for (const fileId of driveIds) {
              // Verify if other events still use this file
              const isStillUsed = get().events.some(e => 
                e.mediaUrls?.includes(fileId) || e.documentUrls?.includes(fileId)
              );

              if (!isStillUsed) {
                if (options.deleteMedia) {
                  await driveService.deleteFile(fileId);
                } else if (backupFolderId) {
                  await driveService.moveFile(fileId, backupFolderId);
                }
              }
            }

            // Cleanup empty folder
            if (eventFolderId) {
              const filesInFolder = await driveService.listFilesInFolder(eventFolderId);
              if (filesInFolder.length === 0) {
                await driveService.deleteFile(eventFolderId);
              }
            }
          } catch (error: any) {
            if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED' && !isRetry) {
              await useAuthStore.getState().refreshAccessToken();
              return performCleanup(true);
            }
            console.error('Error during individual media cleanup:', error);
          }
        };

        performCleanup();
      },
      getEventById: (id) => get().events.find((e) => e.id === id),
      clearEvents: () => set({ events: [] }),
      
      syncEvents: async (userId, isRetry = false) => {
        if (get().isSyncing && !isRetry) return;
        
        set({ isSyncing: true });
        try {
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
            let mediaNames = [...(event.mediaNames || [])];
            let documentUrls = [...(event.documentUrls || [])];
            let documentNames = [...(event.documentNames || [])];
            let eventNeedsUpdate = false;

            // Upload media
            if (event.localMediaUris) {
              for (let i = 0; i < event.localMediaUris.length; i++) {
                const uri = event.localMediaUris[i];
                if (uri.startsWith('http')) continue;
                
                const filename = event.localMediaNames?.[i] || uri.split('/').pop() || `image_${Date.now()}`;
                const fileId = await driveService.uploadMedia(uri, filename, event.title);
                if (fileId) {
                  mediaUrls.push(fileId);
                  mediaNames.push(filename);
                  eventNeedsUpdate = true;
                }
              }
            }

            // Upload documents
            if (event.localDocumentUris) {
              for (let i = 0; i < event.localDocumentUris.length; i++) {
                const uri = event.localDocumentUris[i];
                if (uri.startsWith('http')) continue;

                const filename = event.localDocumentNames?.[i] || event.documentNames?.[i] || uri.split('/').pop() || `doc_${Date.now()}`;
                const fileId = await driveService.uploadMedia(uri, filename, event.title);
                if (fileId) {
                  documentUrls.push(fileId);
                  documentNames.push(filename);
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
                  mediaNames: [...new Set(mediaNames)],
                  documentUrls: [...new Set(documentUrls)],
                  documentNames: [...new Set(documentNames)],
                  localMediaUris: [],
                  localMediaNames: [],
                  localDocumentUris: [],
                  localDocumentNames: [],
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
        } catch (error: any) {
          if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED' && !isRetry) {
            console.log('Unauthorized, refreshing token and retrying sync...');
            await useAuthStore.getState().refreshAccessToken();
            return get().syncEvents(userId, true);
          }
          console.error('Error during syncEvents:', error);
        } finally {
          set({ isSyncing: false });
        }
      },

      fetchEvents: async (userId, isRetry = false) => {
        if (get().isSyncing && !isRetry) return;
        
        set({ isSyncing: true });
        try {
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
        } catch (error: any) {
          if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED' && !isRetry) {
            console.log('Unauthorized, refreshing token and retrying fetch...');
            await useAuthStore.getState().refreshAccessToken();
            return get().fetchEvents(userId, true);
          }
          console.error('Error during fetchEvents:', error);
        } finally {
          set({ isSyncing: false });
        }
      },

      reorderGroupEvents: (groupId) => {
        set((state) => {
          const groupEvents = state.events.filter(e => e.groupId === groupId);
          if (groupEvents.length === 0) return state;

          const sorted = [...groupEvents].sort((a, b) => {
            // Sort by date
            if (a.eventDate !== b.eventDate) {
              return a.eventDate.localeCompare(b.eventDate);
            }
            // If same date, sort by time if available
            const parseTime = (t: string) => {
              if (!t) return 0;
              const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
              if (!match) return 0;
              let [_, h, m, p] = match;
              let hours = parseInt(h, 10);
              const minutes = parseInt(m, 10);
              if (p.toUpperCase() === 'PM' && hours < 12) hours += 12;
              if (p.toUpperCase() === 'AM' && hours === 12) hours = 0;
              return hours * 60 + minutes;
            };
            return parseTime(a.eventTime || '') - parseTime(b.eventTime || '');
          });

          const updatedEvents = state.events.map(e => {
            if (e.groupId === groupId) {
              const newIndex = sorted.findIndex(se => se.id === e.id) + 1;
              if (e.occurrenceIndex !== newIndex) {
                return { ...e, occurrenceIndex: newIndex, syncStatus: 'pending', updatedAt: new Date().toISOString() };
              }
            }
            return e;
          });

          return { events: updatedEvents };
        });
      }
    }),
    {
      name: 'timeline-events-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
