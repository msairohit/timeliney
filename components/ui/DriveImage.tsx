import React from 'react';
import { Image as ExpoImage, ImageProps } from 'expo-image';
import { useAuthStore } from '../../store/authStore';
import { GoogleDriveService } from '../../utils/googleDriveService';

interface DriveImageProps extends Omit<ImageProps, 'source'> {
  fileId?: string;
  fallbackUri?: string;
}

export default function DriveImage({ fileId, fallbackUri, ...props }: DriveImageProps) {
  const user = useAuthStore((state) => state.user);
  
  const source = React.useMemo(() => {
    if (fallbackUri) return { uri: fallbackUri };
    if (fileId && user?.accessToken) {
      const driveService = new GoogleDriveService(user.accessToken);
      return {
        uri: driveService.getFileUrl(fileId),
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
      };
    }
    return null;
  }, [fileId, fallbackUri, user?.accessToken]);

  if (!source) return null;

  return <ExpoImage source={source} {...props} />;
}
