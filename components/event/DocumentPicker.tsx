import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import * as ExpoDocumentPicker from 'expo-document-picker';
import { FileText, X, Plus, File } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { RenameModal } from '../common/RenameModal';

interface DocumentPickerProps {
  documents: { uri: string; name: string }[];
  onDocumentsChange: (documents: { uri: string; name: string }[]) => void;
}

export function DocumentPicker({ documents, onDocumentsChange }: DocumentPickerProps) {
  const [renameIndex, setRenameIndex] = React.useState<number | null>(null);
  const pickDocument = async () => {
    try {
      const result = await ExpoDocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        multiple: true,
      });

      if (!result.canceled) {
        const newDocs = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
        }));
        onDocumentsChange([...documents, ...newDocs]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
      console.error(error);
    }
  };

  const removeDocument = (index: number) => {
    const newDocs = [...documents];
    newDocs.splice(index, 1);
    onDocumentsChange(newDocs);
  };

  const renameDocument = (index: number) => {
    setRenameIndex(index);
  };

  const handleRenameSave = (newName: string) => {
    if (renameIndex !== null) {
      const currentName = documents[renameIndex].name;
      const newDocs = [...documents];
      // Ensure extension is preserved if not provided
      let finalName = newName.trim();
      const oldExt = currentName.split('.').pop();
      if (oldExt && !finalName.toLowerCase().endsWith('.' + oldExt.toLowerCase())) {
        finalName += '.' + oldExt;
      }
      newDocs[renameIndex].name = finalName;
      onDocumentsChange(newDocs);
      setRenameIndex(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <FileText size={20} color="#64748b" />
          <Text style={styles.title}>Documents</Text>
        </View>
        <Text style={styles.count}>{documents.length} items</Text>
      </View>

      <View style={styles.docsList}>
        {documents.map((doc, index) => (
          <Animated.View 
            key={doc.uri + index}
            entering={FadeIn}
            exiting={FadeOut}
            layout={Layout.springify()}
            style={styles.docItem}
          >
            <View style={styles.docIconContainer}>
              <File size={20} color="#6366f1" />
            </View>
            <Pressable 
              onPress={() => renameDocument(index)} 
              style={styles.docNameContainer}
            >
              <Text style={styles.docName} numberOfLines={1}>
                {doc.name}
              </Text>
              <Text style={styles.renameHint}>Tap to rename</Text>
            </Pressable>
            <Pressable 
              onPress={() => removeDocument(index)} 
              style={styles.removeButton}
            >
              <X size={18} color="#94a3b8" />
            </Pressable>
          </Animated.View>
        ))}

        <Pressable 
          onPress={pickDocument} 
          style={styles.addButton}
        >
          <Plus size={20} color="#6366f1" />
          <Text style={styles.addText}>Add Document</Text>
        </Pressable>
      </View>

      <RenameModal
        visible={renameIndex !== null}
        initialValue={renameIndex !== null ? documents[renameIndex].name : ''}
        title="Rename Document"
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
  docsList: {
    gap: 12,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  docIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  docNameContainer: {
    flex: 1,
  },
  docName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  renameHint: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    borderStyle: 'dashed',
    gap: 8,
  },
  addText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
});
