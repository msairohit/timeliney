import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon, X, Plus, Camera } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

interface MediaPickerProps {
  uris: string[];
  onUrisChange: (uris: string[]) => void;
}

export function MediaPicker({ uris, onUrisChange }: MediaPickerProps) {
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
      const newUris = result.assets.map(asset => asset.uri);
      onUrisChange([...uris, ...newUris]);
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
      onUrisChange([...uris, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    const newUris = [...uris];
    newUris.splice(index, 1);
    onUrisChange(newUris);
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
        <Text style={styles.count}>{uris.length} items</Text>
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

        {uris.map((uri, index) => (
          <Animated.View 
            key={uri + index}
            entering={FadeIn}
            exiting={FadeOut}
            layout={Layout.springify()}
            style={styles.imageContainer}
          >
            <Image source={{ uri }} style={styles.image} />
            <Pressable 
              onPress={() => removeImage(index)} 
              style={styles.removeButton}
            >
              <X size={14} color="#fff" />
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
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
  image: {
    width: '100%',
    height: '100%',
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
