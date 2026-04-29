import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageIcon, X, Plus } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { RenameModal } from '../common/RenameModal';

interface MediaPickerProps {
  media: { uri: string; name: string }[];
  onMediaChange: (media: { uri: string; name: string }[]) => void;
}

export function MediaPicker({ media, onMediaChange }: MediaPickerProps) {
  const [renameIndex, setRenameIndex] = React.useState<number | null>(null);
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newMedia = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.uri.split('/').pop() || `image_${Date.now()}`
      }));
      onMediaChange([...media, ...newMedia]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      onMediaChange([...media, {
        uri: asset.uri,
        name: asset.uri.split('/').pop() || `photo_${Date.now()}`
      }]);
    }
  };

  const removeImage = (index: number) => {
    const newMedia = [...media];
    newMedia.splice(index, 1);
    onMediaChange(newMedia);
  };

  const renameImage = (index: number) => {
    setRenameIndex(index);
  };

  const handleRenameSave = (newName: string) => {
    if (renameIndex !== null) {
      const currentName = media[renameIndex].name;
      const newMedia = [...media];
      // Ensure extension is preserved if not provided
      let finalName = newName.trim();
      const oldExt = currentName.split('.').pop();
      if (oldExt && !finalName.toLowerCase().endsWith('.' + oldExt.toLowerCase())) {
        finalName += '.' + oldExt;
      }
      newMedia[renameIndex].name = finalName;
      onMediaChange(newMedia);
      setRenameIndex(null);
    }
  };

  const handleAddPress = () => {
    Alert.alert(
      'Add Media',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <ImageIcon size={20} color="#64748b" />
          <Text style={styles.title}>Media</Text>
        </View>
        <Text style={styles.count}>{media.length} items</Text>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable 
          onPress={handleAddPress} 
          style={styles.addButton}
        >
          <Plus size={24} color="#64748b" />
          <Text style={styles.addText}>Add</Text>
        </Pressable>

        {media.map((item, index) => (
          <Animated.View 
            key={item.uri + index}
            entering={FadeIn}
            exiting={FadeOut}
            layout={Layout.springify()}
            style={styles.imageContainer}
          >
            <Pressable onPress={() => renameImage(index)} style={styles.imageWrapper}>
              <Image source={{ uri: item.uri }} style={styles.image} />
              <View style={styles.nameBadge}>
                <Text style={styles.nameBadgeText} numberOfLines={1}>{item.name}</Text>
              </View>
            </Pressable>
            <Pressable 
              onPress={() => removeImage(index)} 
              style={styles.removeButton}
            >
              <X size={14} color="#fff" />
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>

      <RenameModal
        visible={renameIndex !== null}
        initialValue={renameIndex !== null ? media[renameIndex].name : ''}
        title="Rename Media"
        onSave={handleRenameSave}
        onCancel={() => setRenameIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  count: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  scrollContent: {
    gap: 12,
    paddingRight: 24,
  },
  addButton: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  nameBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  nameBadgeText: {
    color: '#fff',
    fontSize: 8,
    textAlign: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
