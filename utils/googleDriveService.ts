import { LifeEvent } from '../types';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';

export class GoogleDriveService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Find a file by name
   */
  async findFile(name: string): Promise<string | null> {
    try {
      const query = encodeURIComponent(`name = '${name}' and trashed = false`);
      const response = await fetch(`${DRIVE_API_URL}?q=${query}&spaces=drive&fields=files(id, name)`, {
        headers: this.headers,
      });
      const data = await response.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
      return null;
    } catch (error) {
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
        // Update existing file
        await fetch(`${UPLOAD_API_URL}/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            ...this.headers,
            'Content-Type': 'application/json',
          },
          body: content,
        });
      } else {
        // Create new file
        const metadata = {
          name: fileName,
          mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'application/json' }));

        await fetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: form,
        });
      }
      return true;
    } catch (error) {
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

      const response = await fetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
        headers: this.headers,
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching app data from Google Drive:', error);
      return null;
    }
  }

  /**
   * Create a folder if it doesn't exist
   */
  async getOrCreateFolder(name: string): Promise<string | null> {
    try {
      const query = encodeURIComponent(`name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
      const response = await fetch(`${DRIVE_API_URL}?q=${query}&spaces=drive&fields=files(id, name)`, {
        headers: this.headers,
      });
      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }

      // Create folder
      const folderMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
      };

      const createResponse = await fetch(DRIVE_API_URL, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(folderMetadata),
      });
      const folderData = await createResponse.json();
      return folderData.id;
    } catch (error) {
      console.error('Error getting/creating folder on Google Drive:', error);
      return null;
    }
  }

  /**
   * Upload a media file
   */
  async uploadMedia(uri: string, fileName: string): Promise<string | null> {
    try {
      const folderId = await this.getOrCreateFolder('Timeliney_Media');
      
      const response = await fetch(uri);
      const blob = await response.blob();

      const metadata = {
        name: fileName,
        parents: folderId ? [folderId] : [],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const uploadResponse = await fetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: form,
      });
      
      const uploadData = await uploadResponse.json();
      return uploadData.id; // Returns the file ID
    } catch (error) {
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
}
