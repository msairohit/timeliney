import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '../../store/authStore';
import { GOOGLE_CONFIG } from '../../constants/GoogleConfig';
import { useRouter } from 'expo-router';
import { LogIn } from 'lucide-react-native';

GoogleSignin.configure({
  webClientId: GOOGLE_CONFIG.webClientId,
  iosClientId: GOOGLE_CONFIG.iosClientId,
  scopes: GOOGLE_CONFIG.scopes,
});

export default function GoogleLoginButton() {
  const router = useRouter();
  const { setUser, setLoading, isLoading } = useAuthStore();

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      
      if (response.type === 'success') {
        const userInfo = response.data;
        
        // We need the actual accessToken for Google Drive API, not the idToken
        const { accessToken } = await GoogleSignin.getTokens();
        
        setUser({
          uid: userInfo.user.id,
          email: userInfo.user.email,
          username: userInfo.user.name || '',
          displayName: userInfo.user.name,
          photo: userInfo.user.photo,
          accessToken: accessToken || '',
        });
        router.replace('/');
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
        Alert.alert('Sign in in progress', 'Please wait...');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // play services not available or outdated
        Alert.alert('Error', 'Google Play Services are not available');
      } else {
        // some other error
        Alert.alert('Error', 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#1e293b" />
      ) : (
        <>
          <LogIn size={20} color="#1e293b" style={styles.icon} />
          <Text style={styles.text}>Sign in with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    height: 56,
    marginTop: 12,
  },
  icon: {
    marginRight: 12,
  },
  text: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: '600',
  },
});
