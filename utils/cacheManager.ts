import * as FileSystem from 'expo-file-system/legacy';

const CACHE_DIR = `${FileSystem.cacheDirectory}timeliney_cache/`;

// Ensure cache directory exists
const ensureCacheDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
};

/**
 * Gets a local URI for a cloud URL or Drive ID. 
 * If it's already cached, returns the cached URI.
 * If not, downloads it and returns the new local URI.
 */
export const getCachedFile = async (url: string, fileName?: string, accessToken?: string): Promise<string> => {
  if (!url) return url;

  // If it's not a full URL, it might be a Drive ID. 
  // We should construct the Drive API URL if accessToken is provided.
  let downloadUrl = url;
  if (!url.startsWith('http') && accessToken) {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${url}?alt=media`;
  }

  if (!downloadUrl.startsWith('http')) return url;

  await ensureCacheDir();

  // Create a unique filename based on the URL or provided name
  const name = fileName || url.split('/').pop()?.split('?')[0] || `file_${Date.now()}`;
  const localUri = `${CACHE_DIR}${name}`;

  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (fileInfo.exists) {
    return localUri;
  }

  try {
    console.log(`Downloading ${downloadUrl} to ${localUri}...`);
    const { uri } = await FileSystem.downloadAsync(downloadUrl, localUri, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    return uri;
  } catch (error) {
    console.error("Failed to download/cache file:", error);
    return downloadUrl; // Fallback to constructed URL
  }
};

/**
 * Checks if a local URI still exists on the device.
 */
export const checkLocalUri = async (uri: string): Promise<boolean> => {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
};
