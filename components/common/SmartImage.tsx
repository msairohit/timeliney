import React, { useState, useEffect } from 'react';
import { Image as ExpoImage, ImageProps } from 'expo-image';
import { checkLocalUri, getCachedFile } from '../../utils/cacheManager';
import { useAuthStore } from '../../store/authStore';
import { GoogleDriveService } from '../../utils/googleDriveService';

interface SmartImageProps extends Omit<ImageProps, 'source'> {
  localUri?: string;
  cloudUrl?: string;
  fallbackSource?: any;
}

export const SmartImage: React.FC<SmartImageProps> = ({ 
  localUri, 
  cloudUrl, 
  fallbackSource,
  style,
  ...props 
}) => {
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [headers, setHeaders] = useState<Record<string, string> | undefined>(undefined);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    let isMounted = true;

    const resolveSource = async () => {
      // 1. Try local URI first
      if (localUri) {
        const exists = await checkLocalUri(localUri);
        if (exists) {
          if (isMounted) {
            setDisplayUri(localUri);
            setHeaders(undefined);
          }
          return;
        }
      }

      // 2. If local fails or doesn't exist, try cloud URL (Drive ID)
      if (cloudUrl && user?.accessToken) {
        // If cloudUrl doesn't look like a full URL, it's likely a Drive ID
        if (!cloudUrl.startsWith('http')) {
          const driveService = new GoogleDriveService(user.accessToken);
          if (isMounted) {
            setDisplayUri(driveService.getFileUrl(cloudUrl));
            setHeaders({ Authorization: `Bearer ${user.accessToken}` });
          }
        } else {
          // Standard URL (could be from old Firebase data or external)
          const cached = await getCachedFile(cloudUrl);
          if (isMounted) {
            setDisplayUri(cached);
            setHeaders(undefined);
          }
        }
        return;
      }

      // 3. Last fallback
      if (isMounted) {
        setDisplayUri(null);
        setHeaders(undefined);
      }
    };

    resolveSource();

    return () => { isMounted = false; };
  }, [localUri, cloudUrl, user?.accessToken]);

  return (
    <ExpoImage
      source={displayUri ? { uri: displayUri, headers } : fallbackSource}
      style={style}
      {...props}
    />
  );
};
