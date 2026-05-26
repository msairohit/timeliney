import * as FileSystem from 'expo-file-system/legacy';
import { LifeEvent } from '../types';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';

export class GoogleDriveService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private get authHeader() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  private get jsonHeaders() {
    return {
      ...this.authHeader,
      'Content-Type': 'application/json',
    };
  }

  private async safeFetch(url: string, options: RequestInit) {
    const response = await fetch(url, options);
    if (response.status === 401) {
      throw new Error('GOOGLE_DRIVE_UNAUTHORIZED');
    }
    return response;
  }

  async findFile(name: string): Promise<string | null> {
    if (!this.accessToken) {
      console.error('Error finding file: No access token provided');
      return null;
    }

    try {
      const query = encodeURIComponent(`name = '${name}' and trashed = false`);
      const url = `${DRIVE_API_URL}?q=${query}&spaces=drive&fields=files(id, name)`;

      const response = await this.safeFetch(url, {
        method: 'GET',
        headers: this.authHeader,
      });

      const data = await response.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
      return null;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error finding file on Google Drive:', error);
      return null;
    }
  }

  /**
   * Create or update the JSON data file
   */
  async saveAppData(events: LifeEvent[]): Promise<boolean> {
    try {
      const fileName = 'timeliney_data.json';
      const fileId = await this.findFile(fileName);
      const content = JSON.stringify(events);

      if (fileId) {
        // Update existing file - Use simple media upload for JSON content
        const response = await this.safeFetch(`${UPLOAD_API_URL}/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: this.jsonHeaders,
          body: content,
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Error updating app data:', errorData);
          return false;
        }
        return true;
      } else {
        // Create new file
        const metadata = {
          name: fileName,
          mimeType: 'application/json',
        };

        // React Native fetch doesn't handle Blob/FormData with Google Drive Multipart well.
        // We manually construct the multipart body.
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const close_delim = `\r\n--${boundary}--`;

        const body =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          content +
          close_delim;

        const response = await this.safeFetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: body,
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Error creating app data file:', errorData);
          return false;
        }
        return true;
      }
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error saving app data to Google Drive:', error);
      return false;
    }
  }

  /**
   * Fetch app data from Google Drive
   */
  async fetchAppData(): Promise<LifeEvent[] | null> {
    try {
      const fileId = await this.findFile('timeliney_data.json');
      if (!fileId) return null;

      const response = await this.safeFetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
        headers: this.authHeader,
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error fetching app data from Google Drive:', error);
      return null;
    }
  }

  /**
   * Find a folder by name and parent
   */
  async findFolder(name: string, parentId?: string): Promise<string | null> {
    try {
      let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }
      const encodedQuery = encodeURIComponent(query);
      const response = await this.safeFetch(`${DRIVE_API_URL}?q=${encodedQuery}&spaces=drive&fields=files(id, name)`, {
        headers: this.authHeader,
      });
      const data = await response.json();

      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
      return null;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error finding folder on Google Drive:', error);
      return null;
    }
  }

  /**
   * Create a folder if it doesn't exist
   */
  async getOrCreateFolder(name: string, parentId?: string): Promise<string | null> {
    try {
      const existingId = await this.findFolder(name, parentId);
      if (existingId) return existingId;

      // Create folder
      const folderMetadata: any = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
      };
      if (parentId) {
        folderMetadata.parents = [parentId];
      }

      const createResponse = await this.safeFetch(DRIVE_API_URL, {
        method: 'POST',
        headers: this.jsonHeaders,
        body: JSON.stringify(folderMetadata),
      });
      const folderData = await createResponse.json();
      return folderData.id;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error getting/creating folder on Google Drive:', error);
      return null;
    }
  }

  /**
   * Find a file by name inside a specific folder
   */
  async findFileInFolder(name: string, folderId: string): Promise<string | null> {
    try {
      const query = encodeURIComponent(`name = '${name}' and '${folderId}' in parents and trashed = false`);
      const url = `${DRIVE_API_URL}?q=${query}&spaces=drive&fields=files(id, name)`;

      const response = await this.safeFetch(url, {
        method: 'GET',
        headers: this.authHeader,
      });

      if (!response.ok) return null;
      const data = await response.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
      return null;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error finding file in folder:', error);
      return null;
    }
  }

  /**
   * Upload a media file
   */
  async uploadMedia(uri: string, fileName: string, subFolderName?: string): Promise<string | null> {
    try {
      let folderId = await this.getOrCreateFolder('Timeliney_Media');

      if (subFolderName && folderId) {
        folderId = await this.getOrCreateFolder(subFolderName, folderId);
      }

      if (folderId) {
        // Check if file already exists in this folder to avoid duplicates
        const existingFileId = await this.findFileInFolder(fileName, folderId);
        if (existingFileId) {
          console.log(`File "${fileName}" already exists in folder (ID: ${existingFileId}). Skipping upload.`);
          return existingFileId;
        }
      }

      // Read file as base64 using expo-file-system
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      let mimeType = 'image/jpeg';
      if (extension === 'png') mimeType = 'image/png';
      else if (extension === 'gif') mimeType = 'image/gif';
      else if (extension === 'pdf') mimeType = 'application/pdf';
      else if (extension === 'txt') mimeType = 'text/plain';
      else if (['mp4', 'mov', 'avi', 'm4v'].includes(extension)) mimeType = 'video/mp4';
      else if (['mp3', 'wav', 'm4a'].includes(extension)) mimeType = 'audio/mpeg';

      const metadata = {
        name: fileName,
        parents: folderId ? [folderId] : [],
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;

      const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + mimeType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64 +
        close_delim;

      const uploadResponse = await this.safeFetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        console.error('Error uploading media:', errorData);
        return null;
      }

      const uploadData = await uploadResponse.json();
      return uploadData.id;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error uploading media to Google Drive:', error);
      return null;
    }
  }

  /**
   * Get a URL for a file that can be used with Image components (needs headers)
   */
  getFileUrl(fileId: string): string {
    return `${DRIVE_API_URL}/${fileId}?alt=media`;
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const response = await this.safeFetch(`${DRIVE_API_URL}/${fileId}`, {
        method: 'DELETE',
        headers: this.authHeader,
      });
      return response.ok;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error deleting file from Google Drive:', error);
      return false;
    }
  }

  /**
   * Move a file to a different folder
   */
  async moveFile(fileId: string, newFolderId: string): Promise<boolean> {
    try {
      // Get current parents to remove them
      const infoResponse = await this.safeFetch(`${DRIVE_API_URL}/${fileId}?fields=parents`, {
        headers: this.authHeader,
      });
      const info = await infoResponse.json();
      const oldParents = (info.parents || []).join(',');

      let url = `${DRIVE_API_URL}/${fileId}?addParents=${newFolderId}`;
      if (oldParents) {
        url += `&removeParents=${oldParents}`;
      }

      const response = await this.safeFetch(url, {
        method: 'PATCH',
        headers: this.authHeader,
        body: JSON.stringify({}), // Empty body required for some fetch implementations with PATCH
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Move file failed (${response.status}):`, errorText);
      }

      return response.ok;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error moving file on Google Drive:', error);
      return false;
    }
  }
  /**
   * Rename a file or folder on Google Drive
   */
  async renameFile(fileId: string, newName: string): Promise<boolean> {
    try {
      const response = await this.safeFetch(`${DRIVE_API_URL}/${fileId}`, {
        method: 'PATCH',
        headers: this.jsonHeaders,
        body: JSON.stringify({ name: newName }),
      });
      return response.ok;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error renaming file/folder on Google Drive:', error);
      return false;
    }
  }

  /**
   * List files in a specific folder
   */
  async listFilesInFolder(folderId: string): Promise<string[]> {
    try {
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const url = `${DRIVE_API_URL}?q=${query}&fields=files(id)`;

      const response = await this.safeFetch(url, {
        method: 'GET',
        headers: this.authHeader,
      });

      if (!response.ok) return [];

      const data = await response.json();
      return (data.files || []).map((f: any) => f.id);
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error listing files in folder:', error);
      return [];
    }
  }

  /**
   * List files (ID and Name) in a specific folder
   */
  async listFilesAndNamesInFolder(folderId: string): Promise<{ id: string; name: string }[]> {
    try {
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const url = `${DRIVE_API_URL}?q=${query}&fields=files(id, name)`;

      const response = await this.safeFetch(url, {
        method: 'GET',
        headers: this.authHeader,
      });

      if (!response.ok) return [];

      const data = await response.json();
      return (data.files || []).map((f: any) => ({ id: f.id, name: f.name }));
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error listing files in folder:', error);
      return [];
    }
  }

  /**
   * Backup the entire Timeliney_Media folder and timeliney_data.json in Google Drive
   */
  async backupEntireMediaFolder(): Promise<string | null> {
    try {
      const rootFolderId = await this.findFolder('Timeliney_Media');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFolderName = `Timeliney_Media_Backup_${timestamp}`;
      const backupFolderId = await this.getOrCreateFolder(backupFolderName);
      if (!backupFolderId) return null;

      // 1. If Timeliney_Media exists, back up its subfolders and files
      if (rootFolderId) {
        // List all subfolders under Timeliney_Media
        const query = encodeURIComponent(`'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
        const url = `${DRIVE_API_URL}?q=${query}&fields=files(id, name)`;
        const response = await this.safeFetch(url, { headers: this.authHeader });
        
        if (response.ok) {
          const foldersData = await response.json();
          const subFolders = foldersData.files || [];

          for (const subFolder of subFolders) {
            // Create corresponding subfolder in backup
            const backupSubFolderId = await this.getOrCreateFolder(subFolder.name, backupFolderId);
            if (!backupSubFolderId) continue;

            // List files in the original subfolder
            const fileQuery = encodeURIComponent(`'${subFolder.id}' in parents and trashed = false`);
            const fileUrl = `${DRIVE_API_URL}?q=${fileQuery}&fields=files(id, name)`;
            const fileResponse = await this.safeFetch(fileUrl, { headers: this.authHeader });
            
            if (fileResponse.ok) {
              const filesData = await fileResponse.json();
              const files = filesData.files || [];

              for (const file of files) {
                // Copy the file to the new backup subfolder (server-side copy)
                await this.safeFetch(`${DRIVE_API_URL}/${file.id}/copy`, {
                  method: 'POST',
                  headers: this.jsonHeaders,
                  body: JSON.stringify({
                    name: file.name,
                    parents: [backupSubFolderId]
                  })
                });
              }
            }
          }
        }
      }

      // 2. Backup the timeliney_data.json file if it exists
      const dataFileId = await this.findFile('timeliney_data.json');
      if (dataFileId) {
        await this.safeFetch(`${DRIVE_API_URL}/${dataFileId}/copy`, {
          method: 'POST',
          headers: this.jsonHeaders,
          body: JSON.stringify({
            name: `timeliney_data_backup_${timestamp}.json`,
            parents: [backupFolderId]
          })
        });
      }

      console.log(`Safety backup created: "${backupFolderName}"`);
      return backupFolderName;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error backing up Google Drive folder:', error);
      return null;
    }
  }

  /**
   * Helper to upload a JSON file to a specific folder on Google Drive
   */
  async uploadJsonToFolder(folderId: string, content: string, fileName: string): Promise<string | null> {
    try {
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;

      const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        close_delim;

      const response = await this.safeFetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error uploading JSON to folder:', errorText);
        return null;
      }
      const data = await response.json();
      return data.id;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error in uploadJsonToFolder:', error);
      return null;
    }
  }

  /**
   * List all user-initiated save states on Google Drive (sorted newest first)
   */
  async listSaveStates(): Promise<{ id: string; name: string; createdTime: string }[]> {
    try {
      const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and name contains 'Timeliney_SaveState_' and trashed = false");
      const url = `${DRIVE_API_URL}?q=${query}&fields=files(id, name, createdTime)&orderBy=name desc`;
      const response = await this.safeFetch(url, { headers: this.authHeader });
      if (!response.ok) return [];
      const data = await response.json();
      return data.files || [];
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error listing save states:', error);
      return [];
    }
  }

  /**
   * Recursively delete all files and subfolders in a folder, then delete the folder itself.
   * This avoids orphaned files taking up Google Drive space.
   */
  async deleteFolderRecursively(folderId: string): Promise<boolean> {
    try {
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const url = `${DRIVE_API_URL}?q=${query}&fields=files(id, mimeType)`;
      const response = await this.safeFetch(url, { headers: this.authHeader });
      
      if (response.ok) {
        const data = await response.json();
        const items = data.files || [];
        for (const item of items) {
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            await this.deleteFolderRecursively(item.id);
          } else {
            await this.deleteFile(item.id);
          }
        }
      }
      return await this.deleteFile(folderId);
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error deleting folder recursively:', error);
      return false;
    }
  }

  /**
   * Create a Google Drive save state (copies media files server-side and writes the active DB state).
   * Enforces a maximum of 3 save states by deleting the oldest ones recursively.
   * Returns { folderId, folderName, deletedIds } so the caller can update local metadata.
   */
  async createSaveState(
    events: LifeEvent[], 
    customName?: string, 
    onProgress?: (msg: string) => void
  ): Promise<{ folderId: string; folderName: string; deletedIds: string[] } | null> {
    try {
      if (onProgress) onProgress('Locating media folder...');
      const rootFolderId = await this.findFolder('Timeliney_Media');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cleanCustomName = customName ? `_${customName.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
      const saveStateFolderName = `Timeliney_SaveState_${timestamp}${cleanCustomName}`;
      
      if (onProgress) onProgress('Creating save state folder...');
      const saveStateFolderId = await this.getOrCreateFolder(saveStateFolderName);
      if (!saveStateFolderId) return null;

      if (rootFolderId) {
        if (onProgress) onProgress('Listing event subfolders...');
        const query = encodeURIComponent(`'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
        const url = `${DRIVE_API_URL}?q=${query}&fields=files(id, name)`;
        const response = await this.safeFetch(url, { headers: this.authHeader });
        
        if (response.ok) {
          const foldersData = await response.json();
          const subFolders = foldersData.files || [];

          for (let i = 0; i < subFolders.length; i++) {
            const subFolder = subFolders[i];
            if (onProgress) onProgress(`Backing up folder ${i + 1} of ${subFolders.length}: ${subFolder.name}`);
            
            const backupSubFolderId = await this.getOrCreateFolder(subFolder.name, saveStateFolderId);
            if (!backupSubFolderId) continue;

            const fileQuery = encodeURIComponent(`'${subFolder.id}' in parents and trashed = false`);
            const fileUrl = `${DRIVE_API_URL}?q=${fileQuery}&fields=files(id, name)`;
            const fileResponse = await this.safeFetch(fileUrl, { headers: this.authHeader });
            
            if (fileResponse.ok) {
              const filesData = await fileResponse.json();
              const files = filesData.files || [];

              for (const file of files) {
                await this.safeFetch(`${DRIVE_API_URL}/${file.id}/copy`, {
                  method: 'POST',
                  headers: this.jsonHeaders,
                  body: JSON.stringify({
                    name: file.name,
                    parents: [backupSubFolderId]
                  })
                });
              }
            }
          }
        }
      }

      if (onProgress) onProgress('Saving database state...');
      const jsonContent = JSON.stringify(events);
      await this.uploadJsonToFolder(saveStateFolderId, jsonContent, 'timeliney_data.json');

      if (onProgress) onProgress('Enforcing 3 saved states limit...');
      const states = await this.listSaveStates();
      const deletedIds: string[] = [];
      if (states.length > 3) {
        const toDelete = states.slice(3);
        for (const stateToDelete of toDelete) {
          if (onProgress) onProgress(`Cleaning up oldest backup: ${stateToDelete.name}`);
          await this.deleteFolderRecursively(stateToDelete.id);
          deletedIds.push(stateToDelete.id);
        }
      }

      console.log(`Save state created successfully: "${saveStateFolderName}"`);
      return { folderId: saveStateFolderId, folderName: saveStateFolderName, deletedIds };
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error creating save state:', error);
      return null;
    }
  }

  /**
   * Restore a save state: downloads the saved timeline JSON, scans saved subfolders,
   * copies missing media files back server-side to active folders, maps references, and returns the events.
   */
  async restoreSaveState(
    saveStateFolderId: string, 
    onProgress?: (msg: string) => void
  ): Promise<LifeEvent[] | null> {
    try {
      if (onProgress) onProgress('Locating database file...');
      const fileId = await this.findFileInFolder('timeliney_data.json', saveStateFolderId);
      if (!fileId) {
        console.error('timeliney_data.json not found in save state folder');
        return null;
      }

      if (onProgress) onProgress('Downloading database file...');
      const response = await this.safeFetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
        headers: this.authHeader,
      });
      if (!response.ok) return null;
      const restoredEvents: LifeEvent[] = await response.json();

      if (onProgress) onProgress('Preparing main media folder...');
      const activeRootId = await this.getOrCreateFolder('Timeliney_Media');
      if (!activeRootId) return restoredEvents;

      const query = encodeURIComponent(`'${saveStateFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
      const url = `${DRIVE_API_URL}?q=${query}&fields=files(id, name)`;
      const subFoldersRes = await this.safeFetch(url, { headers: this.authHeader });
      
      if (subFoldersRes.ok) {
        const subFoldersData = await subFoldersRes.json();
        const backupSubFolders = subFoldersData.files || [];

        for (let i = 0; i < backupSubFolders.length; i++) {
          const backupSubFolder = backupSubFolders[i];
          if (onProgress) onProgress(`Restoring files for folder ${i + 1} of ${backupSubFolders.length}: ${backupSubFolder.name}`);
          
          const activeSubFolderId = await this.getOrCreateFolder(backupSubFolder.name, activeRootId);
          if (!activeSubFolderId) continue;

          const backupFiles = await this.listFilesAndNamesInFolder(backupSubFolder.id);
          const activeFiles = await this.listFilesAndNamesInFolder(activeSubFolderId);

          const activeFileMap = new Map(activeFiles.map(f => [f.name, f.id]));
          const fileIdMapping = new Map<string, string>();

          for (const backupFile of backupFiles) {
            if (activeFileMap.has(backupFile.name)) {
              fileIdMapping.set(backupFile.id, activeFileMap.get(backupFile.name)!);
            } else {
              const copyRes = await this.safeFetch(`${DRIVE_API_URL}/${backupFile.id}/copy`, {
                method: 'POST',
                headers: this.jsonHeaders,
                body: JSON.stringify({
                  name: backupFile.name,
                  parents: [activeSubFolderId]
                })
              });
              if (copyRes.ok) {
                const copyData = await copyRes.json();
                fileIdMapping.set(backupFile.id, copyData.id);
              }
            }
          }

          restoredEvents.forEach(event => {
            if (event.title === backupSubFolder.name) {
              if (event.mediaUrls) {
                event.mediaUrls = event.mediaUrls.map(id => fileIdMapping.get(id) || id);
              }
              if (event.documentUrls) {
                event.documentUrls = event.documentUrls.map(id => fileIdMapping.get(id) || id);
              }
            }
          });
        }
      }

      return restoredEvents;
    } catch (error: any) {
      if (error.message === 'GOOGLE_DRIVE_UNAUTHORIZED') throw error;
      console.error('Error restoring save state:', error);
      return null;
    }
  }
}

