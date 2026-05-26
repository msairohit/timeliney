import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LifeEvent } from '../types';
import { GoogleDriveService } from '../utils/googleDriveService';
import { useAuthStore } from './authStore';
import { cancelNotification } from '../utils/notifications';

interface SaveStateMetaEntry {
  eventCount: number;
  fileCount: number;
}

interface EventState {
  events: LifeEvent[];
  isSyncing: boolean;
  /** Local cache of save state metadata keyed by Drive folder ID. Persisted to AsyncStorage. */
  saveStateMetadata: Record<string, SaveStateMetaEntry>;
  addEvent: (event: LifeEvent) => void;
  updateEvent: (id: string, updatedEvent: Partial<LifeEvent>) => void;
  deleteEvent: (id: string, options?: { deleteMedia: boolean }) => Promise<void>;
  cleanupMedia: (eventTitle: string, driveIds: string[], options: { deleteMedia: boolean }) => Promise<void>;
  renameEventFolder: (oldTitle: string, newTitle: string) => Promise<void>;
  renameDriveFile: (fileId: string, newName: string) => Promise<void>;
  getEventById: (id: string) => LifeEvent | undefined;
  syncEvents: (userId: string, isRetry?: boolean) => Promise<void>;
  fetchEvents: (userId: string, isRetry?: boolean) => Promise<void>;
  clearEvents: () => void;
  reorderGroupEvents: (groupId: string) => void;
  verifyAndHealEventFiles: (id: string) => Promise<void>;
  pendingRestore: {
    removedEvents: LifeEvent[];
    removedFiles: { eventId: string; eventTitle: string; fileId: string; fileName: string; isDoc: boolean }[];
  } | null;
  restorePendingData: () => Promise<void>;
  dismissPendingRestore: () => void;
  backupAndDetectOverrides: (newEvents: LifeEvent[], onProgress?: (msg: string) => void) => Promise<void>;
  listSaveStatesAction: () => Promise<{ id: string; name: string; createdTime: string; eventCount?: number; fileCount?: number }[]>;
  createSaveStateAction: (customName?: string, onProgress?: (msg: string) => void) => Promise<void>;
  deleteSaveStateAction: (folderId: string) => Promise<void>;
  restoreSaveStateAction: (folderId: string, folderName: string, onProgress?: (msg: string) => void) => Promise<void>;
}

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      events: [],
      isSyncing: false,
      pendingRestore: null,
      saveStateMetadata: {},
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

        // Cancel notification if it exists
        if (eventToDelete.notificationId) {
          await cancelNotification(eventToDelete.notificationId);
        }

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
            if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
              if (!isRetry) {
                const newToken = await useAuthStore.getState().refreshAccessToken();
                if (newToken) {
                  return performDriveCleanup(true);
                }
              }
              useAuthStore.getState().setNeedsReauth(true);
            }
            console.error('Error during Drive cleanup after deletion:', error);
          }
        };

        performDriveCleanup();
      },
      cleanupMedia: async (eventTitle, driveIds, options) => {
        const user = useAuthStore.getState().user;
        const accessToken = user?.accessToken;
        if (!accessToken || driveIds.length === 0) return;

        const performCleanup = async (isRetry = false): Promise<void> => {
          try {
            const driveService = new GoogleDriveService(accessToken);
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
            if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
              if (!isRetry) {
                const newToken = await useAuthStore.getState().refreshAccessToken();
                if (newToken) {
                  return performCleanup(true);
                }
              }
              useAuthStore.getState().setNeedsReauth(true);
            }
            console.error('Error during individual media cleanup:', error);
          }
        };

        return performCleanup();
      },
      renameEventFolder: async (oldTitle, newTitle) => {
        const user = useAuthStore.getState().user;
        const accessToken = user?.accessToken;
        if (!accessToken || oldTitle === newTitle) return;

        const performRename = async (isRetry = false): Promise<void> => {
          try {
            const driveService = new GoogleDriveService(accessToken);
            const rootFolderId = await driveService.getOrCreateFolder('Timeliney_Media');
            
            if (rootFolderId) {
              const folderId = await driveService.findFolder(oldTitle, rootFolderId);
              if (folderId) {
                await driveService.renameFile(folderId, newTitle);
                console.log(`Renamed folder from "${oldTitle}" to "${newTitle}"`);
              }
            }
          } catch (error: any) {
            if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
              if (!isRetry) {
                const newToken = await useAuthStore.getState().refreshAccessToken();
                if (newToken) {
                  return performRename(true);
                }
              }
              useAuthStore.getState().setNeedsReauth(true);
            }
            console.error('Error renaming event folder:', error);
          }
        };

        return performRename();
      },
      renameDriveFile: async (fileId, newName) => {
        const user = useAuthStore.getState().user;
        const accessToken = user?.accessToken;
        if (!accessToken) return;

        const performRename = async (isRetry = false): Promise<void> => {
          try {
            const driveService = new GoogleDriveService(accessToken);
            const success = await driveService.renameFile(fileId, newName);
            if (success) {
              console.log(`Successfully renamed file ${fileId} to "${newName}"`);
            }
          } catch (error: any) {
            if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
              if (!isRetry) {
                const newToken = await useAuthStore.getState().refreshAccessToken();
                if (newToken) {
                  return performRename(true);
                }
              }
              useAuthStore.getState().setNeedsReauth(true);
            }
            console.error('Error renaming drive file:', error);
          }
        };

        return performRename();
      },
      verifyAndHealEventFiles: async (id) => {
        const user = useAuthStore.getState().user;
        const accessToken = user?.accessToken;
        if (!accessToken) return;

        const event = get().events.find((e) => e.id === id);
        if (!event) return;

        const hasCloudFiles = 
          (event.mediaUrls && event.mediaUrls.length > 0) || 
          (event.documentUrls && event.documentUrls.length > 0);
        if (!hasCloudFiles) return;

        const performHealing = async (isRetry = false): Promise<void> => {
          try {
            const driveService = new GoogleDriveService(accessToken);
            const rootFolderId = await driveService.getOrCreateFolder('Timeliney_Media');
            if (!rootFolderId) return;

            const eventFolderId = await driveService.findFolder(event.title, rootFolderId);
            if (!eventFolderId) return;

            // List all files in the event's subfolder on Google Drive
            const driveFiles = await driveService.listFilesAndNamesInFolder(eventFolderId);
            
            let mediaUrls = [...(event.mediaUrls || [])];
            let documentUrls = [...(event.documentUrls || [])];
            let updated = false;

            // 1. Verify and heal mediaUrls
            for (let i = 0; i < mediaUrls.length; i++) {
              const fileId = mediaUrls[i];
              const existsInFolder = driveFiles.some(f => f.id === fileId);
              if (!existsInFolder) {
                const fileName = event.mediaNames?.[i];
                if (fileName) {
                  const match = driveFiles.find(f => f.name === fileName);
                  if (match) {
                    console.log(`Healed missing media reference in event "${event.title}": ${fileId} -> ${match.id}`);
                    mediaUrls[i] = match.id;
                    updated = true;
                  }
                }
              }
            }

            // 2. Verify and heal documentUrls
            for (let i = 0; i < documentUrls.length; i++) {
              const fileId = documentUrls[i];
              const existsInFolder = driveFiles.some(f => f.id === fileId);
              if (!existsInFolder) {
                const fileName = event.documentNames?.[i];
                if (fileName) {
                  const match = driveFiles.find(f => f.name === fileName);
                  if (match) {
                    console.log(`Healed missing doc reference in event "${event.title}": ${fileId} -> ${match.id}`);
                    documentUrls[i] = match.id;
                    updated = true;
                  }
                }
              }
            }

            if (updated) {
              set((state) => ({
                events: state.events.map((e) =>
                  e.id === id
                    ? {
                        ...e,
                        mediaUrls,
                        documentUrls,
                        syncStatus: 'pending',
                        updatedAt: new Date().toISOString(),
                      }
                    : e
                ),
              }));

              // Sync the updated events to Drive
              await get().syncEvents(user.uid);
            }
          } catch (error: any) {
            if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
              if (!isRetry) {
                const newToken = await useAuthStore.getState().refreshAccessToken();
                if (newToken) {
                  return performHealing(true);
                }
              }
              useAuthStore.getState().setNeedsReauth(true);
            }
            console.error('Error during verifyAndHealEventFiles:', error);
          }
        };

        return performHealing();
      },
      getEventById: (id) => get().events.find((e) => e.id === id),
      clearEvents: () => set({ events: [] }),
      
      syncEvents: async (userId, isRetry = false) => {
        if (get().isSyncing && !isRetry) return;
        
        set({ isSyncing: true });
        try {
          const user = useAuthStore.getState().user;
          const accessToken = user?.accessToken;
          if (!accessToken) {
            console.log("Sync skipped: No valid user or accessToken");
            throw new Error("No Google Drive access token. Please log in again.");
          }

          const driveService = new GoogleDriveService(accessToken);
          const { events } = get();
          
          // Find events that need media upload
          const pendingEvents = events.filter(e => 
            e.localMediaUris && e.localMediaUris.length > 0 || e.localDocumentUris && e.localDocumentUris.length > 0
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
            throw new Error("Failed to save timeline data to Google Drive. Please verify your permissions.");
          }
        } catch (error: any) {
          if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
            if (!isRetry) {
              console.log('Unauthorized, refreshing token and retrying sync...');
              const newToken = await useAuthStore.getState().refreshAccessToken();
              if (newToken) {
                return get().syncEvents(userId, true);
              }
            }
            useAuthStore.getState().setNeedsReauth(true);
          }
          console.error('Error during syncEvents:', error);
          throw error;
        } finally {
          set({ isSyncing: false });
        }
      },

      fetchEvents: async (userId, isRetry = false) => {
        if (get().isSyncing && !isRetry) return;
        
        set({ isSyncing: true });
        try {
          const user = useAuthStore.getState().user;
          const accessToken = user?.accessToken;
          if (!accessToken) return;

          const driveService = new GoogleDriveService(accessToken);
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
          if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
            if (!isRetry) {
              console.log('Unauthorized, refreshing token and retrying fetch...');
              const newToken = await useAuthStore.getState().refreshAccessToken();
              if (newToken) {
                return get().fetchEvents(userId, true);
              }
            }
            useAuthStore.getState().setNeedsReauth(true);
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
                return { ...e, occurrenceIndex: newIndex, syncStatus: 'pending' as const, updatedAt: new Date().toISOString() };
              }
            }
            return e;
          });

          return { events: updatedEvents };
        });
      },

      dismissPendingRestore: () => {
        set({ pendingRestore: null });
      },

      restorePendingData: async () => {
        const { pendingRestore, events } = get();
        if (!pendingRestore) return;

        let updatedEvents = [...events];

        // 1. Restore removed events
        pendingRestore.removedEvents.forEach(oldEv => {
          if (!updatedEvents.some(e => e.id === oldEv.id)) {
            updatedEvents.push({
              ...oldEv,
              syncStatus: 'local',
              updatedAt: new Date().toISOString()
            });
          }
        });

        // 2. Restore removed files to existing events
        pendingRestore.removedFiles.forEach(file => {
          const idx = updatedEvents.findIndex(e => e.id === file.eventId);
          if (idx !== -1) {
            const ev = updatedEvents[idx];
            if (file.isDoc) {
              const docUrls = [...(ev.documentUrls || [])];
              const docNames = [...(ev.documentNames || [])];
              if (!docUrls.includes(file.fileId)) {
                docUrls.push(file.fileId);
                docNames.push(file.fileName);
                updatedEvents[idx] = {
                  ...ev,
                  documentUrls: docUrls,
                  documentNames: docNames,
                  syncStatus: 'local',
                  updatedAt: new Date().toISOString()
                };
              }
            } else {
              const mediaUrls = [...(ev.mediaUrls || [])];
              const mediaNames = [...(ev.mediaNames || [])];
              if (!mediaUrls.includes(file.fileId)) {
                mediaUrls.push(file.fileId);
                mediaNames.push(file.fileName);
                updatedEvents[idx] = {
                  ...ev,
                  mediaUrls: mediaUrls,
                  mediaNames: mediaNames,
                  syncStatus: 'local',
                  updatedAt: new Date().toISOString()
                };
              }
            }
          }
        });

        set({ events: updatedEvents, pendingRestore: null });

        // Trigger sync to upload/save changes back to Drive
        const user = useAuthStore.getState().user;
        if (user && user.uid) {
          await get().syncEvents(user.uid);
        }
      },

      backupAndDetectOverrides: async (newEvents, onProgress) => {
        const user = useAuthStore.getState().user;
        const oldEvents = get().events;

        // 1. Create a safety backup in Google Drive if connected
        if (user && user.accessToken) {
          if (onProgress) onProgress('Creating safety backup in Google Drive...');
          try {
            const driveService = new GoogleDriveService(user.accessToken);
            await driveService.backupEntireMediaFolder();
          } catch (err) {
            console.error('Safety backup failed:', err);
          }
        }

        // 2. Identify removed events (events in oldEvents that are not in newEvents)
        const newEventIds = new Set(newEvents.map(e => e.id));
        const removedEvents = oldEvents.filter(e => !newEventIds.has(e.id));

        // 3. Identify removed files for events that exist in both
        const removedFiles: { eventId: string; eventTitle: string; fileId: string; fileName: string; isDoc: boolean }[] = [];
        
        oldEvents.forEach(oldEv => {
          const newEv = newEvents.find(e => e.id === oldEv.id);
          if (newEv) {
            // Check media
            const newMediaUrls = new Set(newEv.mediaUrls || []);
            (oldEv.mediaUrls || []).forEach((fileId, i) => {
              if (!newMediaUrls.has(fileId)) {
                removedFiles.push({
                  eventId: oldEv.id,
                  eventTitle: oldEv.title,
                  fileId,
                  fileName: oldEv.mediaNames?.[i] || `image_${i}.jpg`,
                  isDoc: false
                });
              }
            });

            // Check documents
            const newDocUrls = new Set(newEv.documentUrls || []);
            (oldEv.documentUrls || []).forEach((fileId, i) => {
              if (!newDocUrls.has(fileId)) {
                removedFiles.push({
                  eventId: oldEv.id,
                  eventTitle: oldEv.title,
                  fileId,
                  fileName: oldEv.documentNames?.[i] || `doc_${i}`,
                  isDoc: true
                });
              }
            });
          }
        });

        // 4. Update the state with newEvents
        set({ events: newEvents });

        // 5. If there are removals, save them to pendingRestore
        if (removedEvents.length > 0 || removedFiles.length > 0) {
          set({ pendingRestore: { removedEvents, removedFiles } });
        } else {
          set({ pendingRestore: null });
        }
      },
      listSaveStatesAction: async () => {
        const user = useAuthStore.getState().user;
        const accessToken = user?.accessToken;
        if (!accessToken) return [];
        try {
          const driveService = new GoogleDriveService(accessToken);
          const raw = await driveService.listSaveStates();
          // Merge locally-cached metadata (eventCount / fileCount) into each entry
          const metadata = get().saveStateMetadata;
          return raw.map(s => ({
            ...s,
            eventCount: metadata[s.id]?.eventCount,
            fileCount: metadata[s.id]?.fileCount,
          }));
        } catch (error: any) {
          console.error('listSaveStatesAction error:', error);
          if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
            useAuthStore.getState().setNeedsReauth(true);
          }
          return [];
        }
      },
      createSaveStateAction: async (customName, onProgress) => {
        const user = useAuthStore.getState().user;
        const accessToken = user?.accessToken;
        if (!accessToken) throw new Error('Not logged in to Google Drive');
        try {
          set({ isSyncing: true });
          const driveService = new GoogleDriveService(accessToken);
          
          if (onProgress) onProgress('Syncing local changes to Drive...');
          await get().syncEvents(user.uid);

          const currentEvents = get().events;

          // Compute counts from local data — no extra network calls needed
          const eventCount = currentEvents.length;
          const fileCount = currentEvents.reduce((sum, e) =>
            sum +
            (e.mediaUrls?.length ?? 0) +
            (e.documentUrls?.length ?? 0) +
            (e.localMediaUris?.length ?? 0) +
            (e.localDocumentUris?.length ?? 0),
          0);

          const result = await driveService.createSaveState(currentEvents, customName, onProgress);
          if (result) {
            // Persist metadata keyed by Drive folder ID
            const newMeta = { ...get().saveStateMetadata };

            // Clean up any IDs that Drive enforced deletion on (3-state limit)
            for (const deletedId of result.deletedIds) {
              delete newMeta[deletedId];
            }

            newMeta[result.folderId] = { eventCount, fileCount };
            set({ saveStateMetadata: newMeta });
          }
        } catch (error: any) {
          console.error('createSaveStateAction error:', error);
          if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
            useAuthStore.getState().setNeedsReauth(true);
          }
          throw error;
        } finally {
          set({ isSyncing: false });
        }
      },
      deleteSaveStateAction: async (folderId) => {
        const user = useAuthStore.getState().user;
        const accessToken = user?.accessToken;
        if (!accessToken) throw new Error('Not logged in to Google Drive');
        try {
          set({ isSyncing: true });
          const driveService = new GoogleDriveService(accessToken);
          await driveService.deleteFolderRecursively(folderId);
          // Remove from local metadata cache
          const newMeta = { ...get().saveStateMetadata };
          delete newMeta[folderId];
          set({ saveStateMetadata: newMeta });
        } catch (error: any) {
          console.error('deleteSaveStateAction error:', error);
          if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
            useAuthStore.getState().setNeedsReauth(true);
          }
          throw error;
        } finally {
          set({ isSyncing: false });
        }
      },
      restoreSaveStateAction: async (folderId, folderName, onProgress) => {
        const user = useAuthStore.getState().user;
        const accessToken = user?.accessToken;
        if (!accessToken) throw new Error('Not logged in to Google Drive');
        try {
          set({ isSyncing: true });
          const driveService = new GoogleDriveService(accessToken);
          
          const restoredEvents = await driveService.restoreSaveState(folderId, onProgress);
          if (!restoredEvents) {
            throw new Error('Failed to restore save state.');
          }

          if (onProgress) onProgress('Creating safety backup of current timeline before replace...');
          await get().backupAndDetectOverrides(restoredEvents, onProgress);

          if (onProgress) onProgress('Saving restored timeline to Google Drive...');
          await driveService.saveAppData(get().events);
          
          set((state) => ({
            events: state.events.map(e => ({ ...e, syncStatus: 'synced' }))
          }));
        } catch (error: any) {
          console.error('restoreSaveStateAction error:', error);
          if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') {
            useAuthStore.getState().setNeedsReauth(true);
          }
          throw error;
        } finally {
          set({ isSyncing: false });
        }
      }
    }),
    {
      name: 'timeline-events-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
