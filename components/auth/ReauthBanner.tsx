import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';

export default function ReauthBanner() {
  const { needsReauth, reconnectGoogle } = useAuthStore();
  const [isReconnecting, setIsReconnecting] = useState(false);

  if (!needsReauth) return null;

  const handleReconnect = async () => {
    if (isReconnecting) return;
    setIsReconnecting(true);
    try {
      const success = await reconnectGoogle();
      if (success) {
        Alert.alert('Reconnected', 'Google Drive connection restored successfully.');
      } else {
        Alert.alert('Reconnection Failed', 'Could not re-authenticate. Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred during reconnection.');
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <AlertTriangle size={24} color="#d97706" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Google Drive Action Required</Text>
        <Text style={styles.description}>
          Your Google session has expired. Re-authenticate to keep your timeline synced and secure.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleReconnect}
        disabled={isReconnecting}
      >
        {isReconnecting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <RefreshCw size={14} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Reconnect</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#b45309',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350f',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d97706',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
