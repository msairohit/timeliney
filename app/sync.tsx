import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Modal, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Cloud, 
  RefreshCw, 
  Trash2, 
  Download, 
  Upload, 
  FolderArchive, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  RotateCcw,
  X
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useEventStore } from '../store/eventStore';
import { GoogleDriveService } from '../utils/googleDriveService';
import { LifeEvent } from '../types';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { zip, unzip } from 'react-native-zip-archive';
import { LinearGradient } from 'expo-linear-gradient';

export default function SyncScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, needsReauth, reconnectGoogle } = useAuthStore();
  const { 
    events, 
    isSyncing, 
    syncEvents, 
    clearEvents,
    listSaveStatesAction,
    createSaveStateAction,
    deleteSaveStateAction,
    restoreSaveStateAction
  } = useEventStore();
  const [isReconnecting, setIsReconnecting] = useState(false);

  const [mediaExportProgress, setMediaExportProgress] = useState<string>('');
  const [isExportingMedia, setIsExportingMedia] = useState<boolean>(false);
  
  const [mediaImportProgress, setMediaImportProgress] = useState<string>('');
  const [isImportingMedia, setIsImportingMedia] = useState<boolean>(false);

  // Save States state variables
  const [saveStates, setSaveStates] = useState<{ id: string; name: string; createdTime: string; eventCount?: number; fileCount?: number }[]>([]);
  const [isLoadingSaveStates, setIsLoadingSaveStates] = useState(false);
  const [showSaveStateInput, setShowSaveStateInput] = useState(false);
  const [saveStateLabel, setSaveStateLabel] = useState('');
  const [isProcessingSaveState, setIsProcessingSaveState] = useState(false);
  const [saveStateProgress, setSaveStateProgress] = useState('');

  // Save State info popup — no async fetch needed, metadata is already local
  const [selectedState, setSelectedState] = useState<{ id: string; name: string; eventCount?: number; fileCount?: number } | null>(null);

  // Calculate sync statistics
  const stats = useMemo(() => {
    const total = events.length;
    const synced = events.filter(e => e.syncStatus === 'synced').length;
    const unsynced = total - synced;
    const hasUnsynced = unsynced > 0;
    
    return { total, synced, unsynced, hasUnsynced };
  }, [events]);

  const handleSyncNow = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'Please log in to sync with Google Drive.');
      return;
    }
    try {
      await syncEvents(user.uid);
      Alert.alert('Success', 'Google Drive sync completed successfully.');
    } catch (error: any) {
      console.error('Sync failed:', error);
      Alert.alert('Sync Failed', error?.message || 'Could not sync with Google Drive. Please check your internet connection.');
    }
  };

  const handleReconnect = async () => {
    if (isReconnecting) return;
    setIsReconnecting(true);
    try {
      const success = await reconnectGoogle();
      if (success) {
        Alert.alert('Success', 'Google Drive connection restored successfully.');
      } else {
        Alert.alert('Reconnection Failed', 'Could not re-authenticate. Please try again.');
      }
    } catch (error: any) {
      console.error('Reconnection failed:', error);
      Alert.alert('Error', error?.message || 'Failed to reconnect with Google Drive.');
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleClearLocalData = () => {
    Alert.alert(
      'Warning: Clear Local Data',
      'This will erase all timeline events from this device. If you have not synced or backed up your data, it will be permanently lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase Device Data',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation Required',
              'Are you absolutely sure you want to clear your local database?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Clear Everything',
                  style: 'destructive',
                  onPress: () => {
                    clearEvents();
                    Alert.alert('Cleared', 'All local events have been removed.');
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };
  const fetchSaveStatesList = React.useCallback(async () => {
    if (!user?.uid || needsReauth) return;
    setIsLoadingSaveStates(true);
    try {
      const list = await listSaveStatesAction();
      setSaveStates(list);
    } catch (err) {
      console.error('Failed to fetch save states:', err);
    } finally {
      setIsLoadingSaveStates(false);
    }
  }, [user, needsReauth, listSaveStatesAction]);

  useEffect(() => {
    fetchSaveStatesList();
  }, [fetchSaveStatesList]);

  const handleCreateSaveState = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'Please log in to use Save States.');
      return;
    }
    setShowSaveStateInput(false);
    setIsProcessingSaveState(true);
    setSaveStateProgress('Initializing...');
    try {
      const label = saveStateLabel.trim();
      setSaveStateLabel('');
      await createSaveStateAction(label || undefined, (msg) => {
        setSaveStateProgress(msg);
      });
      Alert.alert('Success', 'Save state created successfully on Google Drive.');
      await fetchSaveStatesList();
    } catch (err: any) {
      console.error('Create save state failed:', err);
      Alert.alert('Error', err?.message || 'Failed to create save state.');
    } finally {
      setIsProcessingSaveState(false);
      setSaveStateProgress('');
    }
  };

  const handleDeleteSaveState = async (id: string, name: string) => {
    const { label, formattedDate } = parseSaveStateName(name);
    const displayName = label ? `${label} (${formattedDate})` : formattedDate;
    Alert.alert(
      'Delete Save State',
      `Are you sure you want to permanently delete the save state "${displayName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsProcessingSaveState(true);
            setSaveStateProgress('Deleting save state folder...');
            try {
              await deleteSaveStateAction(id);
              Alert.alert('Deleted', 'Save state deleted successfully.');
              await fetchSaveStatesList();
            } catch (err: any) {
              console.error('Delete save state failed:', err);
              Alert.alert('Error', err?.message || 'Failed to delete save state.');
            } finally {
              setIsProcessingSaveState(false);
              setSaveStateProgress('');
            }
          }
        }
      ]
    );
  };

  const handleRestoreSaveState = async (id: string, name: string) => {
    const { label, formattedDate } = parseSaveStateName(name);
    const displayName = label ? `${label} (${formattedDate})` : formattedDate;
    Alert.alert(
      'Restore Save State',
      `Are you sure you want to restore the save state "${displayName}"?\n\nThis will replace your current timeline events and download missing media files. A safety backup of your current database will be created.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setIsProcessingSaveState(true);
            setSaveStateProgress('Starting restoration...');
            try {
              await restoreSaveStateAction(id, name, (msg) => {
                setSaveStateProgress(msg);
              });
              Alert.alert(
                'Restored Successfully',
                'Your timeline has been restored to the selected save state. Any deleted files from your previous state have been caught by the restore engine and can be found via the Home recovery banner.'
              );
              await fetchSaveStatesList();
            } catch (err: any) {
              console.error('Restore save state failed:', err);
              Alert.alert('Error', err?.message || 'Failed to restore save state.');
            } finally {
              setIsProcessingSaveState(false);
              setSaveStateProgress('');
            }
          }
        }
      ]
    );
  };

  /**
   * Parses a save state folder name into { label, formattedDate }.
   * The timestamp in the folder name is UTC (from toISOString()), so we append 'Z'
   * to ensure the Date constructor treats it as UTC and toLocaleString converts to local time.
   */
  const parseSaveStateName = (folderName: string): { label: string; formattedDate: string } => {
    const prefix = 'Timeliney_SaveState_';
    if (!folderName.startsWith(prefix)) return { label: folderName, formattedDate: '' };

    const content = folderName.substring(prefix.length);

    // Match timestamp (e.g. 2026-05-26T15-24-31-000Z) and optional label
    const match = content.match(/^(\d{4}-\d{2}-\d{2}[T_]\d{2}-\d{2}-\d{2}(?:-\d+)?Z?)(?:_(.*))?$/);
    if (!match) return { label: content, formattedDate: '' };

    const timestampStr = match[1];
    const labelStr = match[2] ? match[2].replace(/_/g, ' ') : '';

    let formattedDate = timestampStr;
    try {
      const separator = timestampStr.includes('T') ? 'T' : '_';
      const [datePart, timePart] = timestampStr.split(separator);
      if (datePart && timePart) {
        const timeParts = timePart.replace('Z', '').split('-');
        const hour = timeParts[0] || '00';
        const minute = timeParts[1] || '00';
        const second = timeParts[2] || '00';

        // Append 'Z' so Date parses this as UTC → toLocaleString gives local time
        const isoString = `${datePart}T${hour}:${minute}:${second}Z`;
        const dateObj = new Date(isoString);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
        }
      }
    } catch (e) {
      console.error('Error formatting save state date:', e);
    }

    return { label: labelStr, formattedDate };
  };

  const handleOpenStateInfo = useCallback((state: { id: string; name: string; eventCount?: number; fileCount?: number }) => {
    setSelectedState(state);
  }, []);

  const handleCloseStateInfo = () => {
    setSelectedState(null);
  };

  const handleInfoDelete = async () => {
    if (!selectedState) return;
    handleCloseStateInfo();
    await handleDeleteSaveState(selectedState.id, selectedState.name);
  };

  const handleInfoRestore = async () => {
    if (!selectedState) return;
    handleCloseStateInfo();
    await handleRestoreSaveState(selectedState.id, selectedState.name);
  };

  const handleExportJSON = async () => {
    try {
      const jsonStr = JSON.stringify(events, null, 2);
      const fileUri = `${FileSystem.documentDirectory}timeliney_export_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Timeliney JSON',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Export JSON error:', error);
      Alert.alert('Error', 'Failed to export JSON file.');
    }
  };

  const handleExportMediaZIP = async () => {
    if (isExportingMedia) return;
    
    // Collect all media/doc tasks
    const tasks: { eventId: string; title: string; fileId?: string; localUri?: string; name: string; isDoc: boolean }[] = [];
    
    events.forEach(event => {
      // Cloud media
      if (event.mediaUrls) {
        event.mediaUrls.forEach((url, i) => {
          if (url) {
            tasks.push({
              eventId: event.id,
              title: event.title,
              fileId: url,
              name: event.mediaNames?.[i] || `image_${i}.jpg`,
              isDoc: false
            });
          }
        });
      }
      // Local media (not yet uploaded)
      if (event.localMediaUris) {
        event.localMediaUris.forEach((uri, i) => {
          if (uri) {
            tasks.push({
              eventId: event.id,
              title: event.title,
              localUri: uri,
              name: event.localMediaNames?.[i] || `image_${i}.jpg`,
              isDoc: false
            });
          }
        });
      }
      // Cloud documents
      if (event.documentUrls) {
        event.documentUrls.forEach((url, i) => {
          if (url) {
            tasks.push({
              eventId: event.id,
              title: event.title,
              fileId: url,
              name: event.documentNames?.[i] || `doc_${i}`,
              isDoc: true
            });
          }
        });
      }
      // Local documents
      if (event.localDocumentUris) {
        event.localDocumentUris.forEach((uri, i) => {
          if (uri) {
            tasks.push({
              eventId: event.id,
              title: event.title,
              localUri: uri,
              name: event.localDocumentNames?.[i] || `doc_${i}`,
              isDoc: true
            });
          }
        });
      }
    });

    if (tasks.length === 0) {
      Alert.alert('Export Media', 'No media files or documents found to export.');
      return;
    }

    setIsExportingMedia(true);
    setMediaExportProgress('Preparing export folder...');

    const tempDir = `${FileSystem.cacheDirectory}export_media_temp_${Date.now()}/`;

    try {
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
      const accessToken = user?.accessToken;

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        setMediaExportProgress(`Processing file ${i + 1} of ${tasks.length}:\n${task.name}`);

        const eventDir = `${tempDir}${task.eventId}/`;
        await FileSystem.makeDirectoryAsync(eventDir, { intermediates: true });
        const destPath = `${eventDir}${task.name}`;

        try {
          if (task.localUri) {
            const fileInfo = await FileSystem.getInfoAsync(task.localUri);
            if (fileInfo.exists) {
              await FileSystem.copyAsync({
                from: task.localUri,
                to: destPath
              });
            }
          } else if (task.fileId && accessToken) {
            const driveService = new GoogleDriveService(accessToken);
            
            const downloadRes = await FileSystem.downloadAsync(
              driveService.getFileUrl(task.fileId),
              destPath,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                }
              }
            );

            if (downloadRes.status < 200 || downloadRes.status >= 400) {
              console.error(`Failed to download ${task.name}: HTTP status ${downloadRes.status}`);
            }
          }
        } catch (fileErr) {
          console.error(`Error adding file ${task.name} to export folder:`, fileErr);
        }
      }

      setMediaExportProgress('Generating ZIP package natively...');
      const exportPath = `${FileSystem.documentDirectory}timeliney_media_${Date.now()}.zip`;
      
      await zip(tempDir, exportPath);
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        setMediaExportProgress('Opening sharing dialog...');
        await Sharing.shareAsync(exportPath, {
          mimeType: 'application/zip',
          dialogTitle: 'Export Timeliney Media Folder',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (error: any) {
      console.error('Media zip export error:', error);
      Alert.alert('Error', `Failed to export media files: ${error?.message || error}`);
    } finally {
      try {
        await FileSystem.deleteAsync(tempDir, { idempotent: true });
      } catch (cleanupErr) {
        console.error('Error cleaning up temp export directory:', cleanupErr);
      }
      setIsExportingMedia(false);
      setMediaExportProgress('');
    }
  };

  const handleImportJSON = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const jsonContent = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsedData = JSON.parse(jsonContent);

      if (!Array.isArray(parsedData)) {
        Alert.alert('Error', 'Invalid data format. Expected an array of events.');
        return;
      }

      Alert.alert(
        'Import Data',
        `Found ${parsedData.length} events. Do you want to replace all current events or merge them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Replace All', 
            style: 'destructive',
            onPress: () => {
              const updatedEvents: LifeEvent[] = parsedData.map(event => ({
                ...event,
                userId: user?.uid || 'local-user',
                syncStatus: 'local'
              } as any));

              (async () => {
                setIsImportingMedia(true);
                setMediaImportProgress('Creating Google Drive safety backup...');
                await useEventStore.getState().backupAndDetectOverrides(updatedEvents, (msg) => {
                  setMediaImportProgress(msg);
                });
                setIsImportingMedia(false);
                setMediaImportProgress('');
                Alert.alert(
                  'Imported with Safety Backup', 
                  'All local data was replaced. A safety backup folder was created on Google Drive. Press "Sync Now" to push these changes.'
                );
              })();
            }
          },
          { 
            text: 'Merge', 
            onPress: () => {
              const currentEvents = useEventStore.getState().events;
              const existingIds = new Set(currentEvents.map(e => e.id));
              const merged: LifeEvent[] = [...currentEvents];
              let addedCount = 0;
              
              parsedData.forEach(event => {
                if (!existingIds.has(event.id)) {
                  merged.push({
                    ...event,
                    userId: user?.uid || 'local-user',
                    syncStatus: 'local'
                  } as any);
                  addedCount++;
                }
              });

              useEventStore.setState({ events: merged });
              Alert.alert('Imported', `Merged ${addedCount} new events. Press "Sync Now" to backup changes.`);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Import JSON error:', error);
      Alert.alert('Error', 'Failed to read or parse the JSON import file.');
    }
  };

  const handleImportMediaZIP = async () => {
    if (isImportingMedia) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setIsImportingMedia(true);
      setMediaImportProgress('Extracting ZIP file natively...');

      const zipUri = result.assets[0].uri;
      const importedCacheDir = `${FileSystem.documentDirectory}imported_media/`;
      
      // Clean up previous imports if any
      await FileSystem.deleteAsync(importedCacheDir, { idempotent: true });
      await FileSystem.makeDirectoryAsync(importedCacheDir, { intermediates: true });

      // Native unzip
      await unzip(zipUri, importedCacheDir);

      setMediaImportProgress('Mapping extracted files...');
      
      const currentEvents = [...useEventStore.getState().events] as LifeEvent[];
      const eventIdMap = new Map(currentEvents.map(e => [e.id, e]));

      let processedCount = 0;
      let linkedCount = 0;

      // Scan directories for event folders and files
      const eventIds = await FileSystem.readDirectoryAsync(importedCacheDir);
      for (const eventId of eventIds) {
        const eventDir = `${importedCacheDir}${eventId}/`;
        const dirInfo = await FileSystem.getInfoAsync(eventDir);
        if (!dirInfo.exists || !dirInfo.isDirectory) continue;

        const files = await FileSystem.readDirectoryAsync(eventDir);
        for (const fileName of files) {
          const destUri = `${eventDir}${fileName}`;
          processedCount++;

          const event = eventIdMap.get(eventId);
          if (event) {
            const isDoc = event.documentNames?.includes(fileName) || 
                          ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'].includes(fileName.split('.').pop()?.toLowerCase() || '');

            if (isDoc) {
              if (!event.localDocumentUris) event.localDocumentUris = [];
              if (!event.localDocumentNames) event.localDocumentNames = [];

              if (!event.localDocumentUris.includes(destUri)) {
                event.localDocumentUris.push(destUri);
                event.localDocumentNames.push(fileName);
              }
              event.documentUrls = [];
              event.documentNames = [];
            } else {
              if (!event.localMediaUris) event.localMediaUris = [];
              if (!event.localMediaNames) event.localMediaNames = [];

              if (!event.localMediaUris.includes(destUri)) {
                event.localMediaUris.push(destUri);
                event.localMediaNames.push(fileName);
              }
              event.mediaUrls = [];
              event.mediaNames = [];
            }
            
            event.syncStatus = 'local';
            event.updatedAt = new Date().toISOString();
            linkedCount++;
          }
        }
      }

      // Save mapped events back to state
      useEventStore.setState({ events: currentEvents });
      
      Alert.alert(
        'Success', 
        `Extracted ${processedCount} files. Successfully linked ${linkedCount} items to your timeline events. Run "Sync Now" to upload them to Google Drive.`
      );
    } catch (error: any) {
      console.error('Import ZIP error:', error);
      Alert.alert('Error', `Failed to read or extract the ZIP import archive: ${error?.message || error}`);
    } finally {
      setIsImportingMedia(false);
      setMediaImportProgress('');
    }
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      {/* Header */}
      <LinearGradient
        colors={['#6366f1', '#a855f7']}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup & Sync Settings</Text>
        <Text style={styles.headerSubtitle}>Keep your memories secure in Google Drive</Text>
      </LinearGradient>

      {/* Sync Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Status</Text>
        
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            {stats.hasUnsynced ? (
              <AlertTriangle size={32} color="#f59e0b" />
            ) : (
              <CheckCircle2 size={32} color="#10b981" />
            )}
            <View style={styles.statusInfo}>
              <Text style={styles.statusText}>
                {stats.hasUnsynced ? 'Unsynced Local Changes' : 'All Data Fully Synced'}
              </Text>
              <Text style={styles.emailText}>
                {user?.email ? `Logged in as: ${user.email}` : 'Not connected to Gmail'}
              </Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Events</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.synced}</Text>
              <Text style={styles.statLabel}>Synced</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: stats.hasUnsynced ? '#f59e0b' : '#64748b' }]}>
                {stats.unsynced}
              </Text>
              <Text style={styles.statLabel}>Unsynced</Text>
            </View>
          </View>

          {user?.uid ? (
            needsReauth ? (
              <View style={styles.reauthWarningContainer}>
                <View style={styles.reauthWarningHeader}>
                  <AlertTriangle size={24} color="#d97706" style={{ marginRight: 8 }} />
                  <Text style={styles.reauthWarningTitle}>Connection Required</Text>
                </View>
                <Text style={styles.reauthWarningText}>
                  Your Google Drive session has expired. Please reconnect to resume automatic backup and syncing.
                </Text>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.reconnectCardButton]} 
                  onPress={handleReconnect}
                  disabled={isReconnecting}
                >
                  {isReconnecting ? (
                    <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  ) : (
                    <RefreshCw size={20} color="#fff" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.actionButtonText}>
                    {isReconnecting ? 'Connecting...' : 'Reconnect Account'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.actionButton, styles.syncButton]} 
                onPress={handleSyncNow}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                ) : (
                  <RefreshCw size={20} color="#fff" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.actionButtonText}>
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={styles.loginWarningContainer}>
              <Text style={styles.loginWarningText}>
                Please log in with Google to enable cloud backups.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Answer & Explanation Card */}
      <View style={styles.section}>
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Info size={20} color="#6366f1" />
            <Text style={styles.infoCardTitle}>Will I lose my data on logout/uninstall?</Text>
          </View>
          <Text style={styles.infoCardText}>
            <Text style={{ fontWeight: '700', color: '#1e293b' }}>No, as long as it is Synced.</Text> Once your status shows as &quot;All Data Fully Synced,&quot; all your timeline events and media are safely stored in your personal Google Drive account.
            {"\n\n"}
            Logging out or uninstalling the app clears local files on your device for security, but logging back in with the same Gmail account will download and fully restore your timeline.
          </Text>
        </View>
      </View>

      {/* Manual Exports */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Backup (Export)</Text>
        <View style={styles.backupContainer}>
          <TouchableOpacity style={styles.backupItem} onPress={handleExportJSON}>
            <View style={styles.backupIconContainer}>
              <FileJson size={24} color="#6366f1" />
            </View>
            <View style={styles.backupTextContainer}>
              <Text style={styles.backupLabel}>Export Data JSON</Text>
              <Text style={styles.backupDesc}>Save a backup of your text timeline events</Text>
            </View>
            <Download size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.backupItem, isExportingMedia && { opacity: 0.7 }]} 
            onPress={handleExportMediaZIP}
            disabled={isExportingMedia}
          >
            <View style={styles.backupIconContainer}>
              <FolderArchive size={24} color="#a855f7" />
            </View>
            <View style={styles.backupTextContainer}>
              <Text style={styles.backupLabel}>Export Media Folder (ZIP)</Text>
              <Text style={styles.backupDesc}>Download and pack all photos and attachments</Text>
            </View>
            {isExportingMedia ? (
              <ActivityIndicator color="#6366f1" size="small" />
            ) : (
              <Download size={20} color="#cbd5e1" />
            )}
          </TouchableOpacity>

          {isExportingMedia && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>{mediaExportProgress}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Manual Imports */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Restore (Import)</Text>
        <View style={styles.backupContainer}>
          <TouchableOpacity style={styles.backupItem} onPress={handleImportJSON}>
            <View style={[styles.backupIconContainer, { backgroundColor: '#f0fdf4' }]}>
              <FileJson size={24} color="#10b981" />
            </View>
            <View style={styles.backupTextContainer}>
              <Text style={styles.backupLabel}>Import Data JSON</Text>
              <Text style={styles.backupDesc}>Restore events from a JSON backup file</Text>
            </View>
            <Upload size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.backupItem, { borderBottomWidth: 0 }, isImportingMedia && { opacity: 0.7 }]} 
            onPress={handleImportMediaZIP}
            disabled={isImportingMedia}
          >
            <View style={[styles.backupIconContainer, { backgroundColor: '#fdf2f8' }]}>
              <FolderArchive size={24} color="#db2777" />
            </View>
            <View style={styles.backupTextContainer}>
              <Text style={styles.backupLabel}>Import Media ZIP</Text>
              <Text style={styles.backupDesc}>Extract photos and map them back to events</Text>
            </View>
            {isImportingMedia ? (
              <ActivityIndicator color="#6366f1" size="small" />
            ) : (
              <Upload size={20} color="#cbd5e1" />
            )}
          </TouchableOpacity>

          {isImportingMedia && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>{mediaImportProgress}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Google Drive Save States Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Google Drive Save States (Max 3)</Text>
        <View style={styles.saveStatesCard}>
          {showSaveStateInput ? (
            <View style={styles.inlineForm}>
              <Text style={styles.formTitle}>Name your Save State</Text>
              <TextInput
                style={styles.formInput}
                value={saveStateLabel}
                onChangeText={setSaveStateLabel}
                placeholder="Optional label (e.g. Before Import)"
                placeholderTextColor="#94a3b8"
                maxLength={40}
              />
              <View style={styles.formButtons}>
                <TouchableOpacity 
                  style={[styles.formBtn, styles.formBtnCancel]}
                  onPress={() => {
                    setShowSaveStateInput(false);
                    setSaveStateLabel('');
                  }}
                >
                  <Text style={styles.formBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.formBtn, styles.formBtnSave]}
                  onPress={handleCreateSaveState}
                >
                  <Text style={styles.formBtnTextSave}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.createBtn}
              onPress={() => setShowSaveStateInput(true)}
              disabled={isProcessingSaveState || !user?.uid || needsReauth}
            >
              <Cloud size={20} color="#6366f1" style={{ marginRight: 8 }} />
              <Text style={styles.createBtnText}>Create New Save State</Text>
            </TouchableOpacity>
          )}

          {isProcessingSaveState && (
            <View style={styles.saveStateProgressContainer}>
              <ActivityIndicator color="#6366f1" size="small" style={{ marginBottom: 8 }} />
              <Text style={styles.saveStateProgressText}>{saveStateProgress}</Text>
            </View>
          )}

          {isLoadingSaveStates ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator color="#6366f1" size="small" />
              <Text style={styles.loaderText}>Loading saved states...</Text>
            </View>
          ) : !user?.uid ? (
            <View style={styles.emptyList}>
              <Text style={styles.emptyText}>Connect Google Drive to manage save states.</Text>
            </View>
          ) : saveStates.length === 0 ? (
            <View style={styles.emptyList}>
              <Text style={styles.emptyText}>No saved states found. Create one above to preserve your current timeline.</Text>
            </View>
          ) : (
            <View style={styles.statesList}>
              {saveStates.map((state, idx) => {
                const { label, formattedDate } = parseSaveStateName(state.name);
                return (
                  <TouchableOpacity
                    key={state.id}
                    style={[
                      styles.stateItem,
                      idx === saveStates.length - 1 && { borderBottomWidth: 0 }
                    ]}
                    onPress={() => handleOpenStateInfo(state)}
                    disabled={isProcessingSaveState}
                    activeOpacity={0.7}
                  >
                    <View style={styles.stateIconWrap}>
                      <Cloud size={20} color="#6366f1" />
                    </View>
                    <View style={styles.stateInfo}>
                      {label ? (
                        <Text style={styles.stateName} numberOfLines={1}>
                          {label}
                        </Text>
                      ) : null}
                      <Text style={label ? styles.stateDate : styles.stateName} numberOfLines={1}>
                        {formattedDate}
                      </Text>
                    </View>
                    <Info size={16} color="#94a3b8" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Danger Zone</Text>
        <View style={styles.dangerCard}>
          <View style={styles.dangerTextContainer}>
            <Text style={styles.dangerTitle}>Clear All Local Data</Text>
            <Text style={styles.dangerDesc}>
              Deletes all events from this device&apos;s memory. This does not delete backups in Google Drive.
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.dangerButton} 
            onPress={handleClearLocalData}
          >
            <Trash2 size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.dangerButtonText}>Clear Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>

    {/* Save State Info Modal */}
    <Modal
      visible={!!selectedState}
      transparent
      animationType="fade"
      onRequestClose={handleCloseStateInfo}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Cloud size={22} color="#6366f1" />
              <Text style={styles.modalTitle}>Save State</Text>
            </View>
            <TouchableOpacity onPress={handleCloseStateInfo} style={styles.modalCloseBtn}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Name / Date */}
          {selectedState && (() => {
            const { label, formattedDate } = parseSaveStateName(selectedState.name);
            return (
              <View style={styles.modalNameBlock}>
                {label ? (
                  <Text style={styles.modalStateName}>{label}</Text>
                ) : null}
                <Text style={label ? styles.modalStateDate : styles.modalStateName}>
                  {formattedDate}
                </Text>
              </View>
            );
          })()}


          {/* Stats — read instantly from local metadata, no network call */}
          {selectedState && (selectedState.eventCount !== undefined || selectedState.fileCount !== undefined) ? (
            <View style={styles.modalStats}>
              <View style={styles.modalStatBox}>
                <Text style={styles.modalStatValue}>{selectedState.eventCount ?? '—'}</Text>
                <Text style={styles.modalStatLabel}>Events</Text>
              </View>
              <View style={styles.modalStatDivider} />
              <View style={styles.modalStatBox}>
                <Text style={styles.modalStatValue}>{selectedState.fileCount ?? '—'}</Text>
                <Text style={styles.modalStatLabel}>Media Files</Text>
              </View>
            </View>
          ) : (
            <View style={styles.modalStatsLoading}>
              <Text style={styles.modalStatsLoadingText}>Details not available for older save states</Text>
            </View>
          )}


          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalRestoreBtn]}
              onPress={handleInfoRestore}
              disabled={isProcessingSaveState}
            >
              <RotateCcw size={16} color="#4f46e5" style={{ marginRight: 6 }} />
              <Text style={styles.modalRestoreBtnText}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalDeleteBtn]}
              onPress={handleInfoDelete}
              disabled={isProcessingSaveState}
            >
              <Trash2 size={16} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={styles.modalDeleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  emailText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  syncButton: {
    backgroundColor: '#6366f1',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loginWarningContainer: {
    padding: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    alignItems: 'center',
  },
  loginWarningText: {
    fontSize: 13,
    color: '#b45309',
    fontWeight: '600',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#e0e7ff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338ca',
  },
  infoCardText: {
    fontSize: 13,
    color: '#3730a3',
    lineHeight: 18,
  },
  backupContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backupIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  backupTextContainer: {
    flex: 1,
  },
  backupLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  backupDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  progressContainer: {
    padding: 12,
    backgroundColor: '#f8fafc',
    marginHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  progressText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dangerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
  dangerDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    lineHeight: 14,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  reauthWarningContainer: {
    padding: 16,
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
  },
  reauthWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reauthWarningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#78350f',
  },
  reauthWarningText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
    marginBottom: 12,
  },
  reconnectCardButton: {
    backgroundColor: '#d97706',
  },
  saveStatesCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },
  inlineForm: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  formBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  formBtnCancel: {
    backgroundColor: '#e2e8f0',
  },
  formBtnSave: {
    backgroundColor: '#6366f1',
  },
  formBtnTextCancel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  formBtnTextSave: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  saveStateProgressContainer: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveStateProgressText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  statesList: {
    marginTop: 8,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  stateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateInfo: {
    flex: 1,
    minWidth: 0,
  },
  stateName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  stateDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalNameBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  modalStateName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalStateDate: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  modalStatsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 20,
  },
  modalStatsLoadingText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '500',
  },
  modalStats: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  modalStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6366f1',
  },
  modalStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  modalStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalRestoreBtn: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  modalRestoreBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4f46e5',
  },
  modalDeleteBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  modalDeleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
});
