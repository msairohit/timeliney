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
   * Create a folder if it doesn't exist
   */
  async getOrCreateFolder(name: string, parentId?: string): Promise<string | null> {
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
   * Upload a media file
   */
  async uploadMedia(uri: string, fileName: string, subFolderName?: string): Promise<string | null> {
    try {
      let folderId = await this.getOrCreateFolder('Timeliney_Media');

      if (subFolderName && folderId) {
        folderId = await this.getOrCreateFolder(subFolderName, folderId);
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
}

