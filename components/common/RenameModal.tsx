import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable, Platform, KeyboardAvoidingView } from 'react-native';

interface RenameModalProps {
  visible: boolean;
  initialValue: string;
  title: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
}

export function RenameModal({ visible, initialValue, title, onSave, onCancel }: RenameModalProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  const handleSave = () => {
    if (value.trim()) {
      onSave(value.trim());
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            autoFocus
            selectTextOnFocus
            placeholder="Enter name"
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.button, styles.cancelButton]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={[styles.button, styles.saveButton]}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  saveButton: {
    backgroundColor: '#0f172a',
  },
  cancelText: {
    color: '#64748b',
    fontWeight: '600',
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
  },
});
