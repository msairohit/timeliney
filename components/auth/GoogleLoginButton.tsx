import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuthStore } from '../../store/authStore';
import { GOOGLE_CONFIG } from '../../constants/GoogleConfig';
import { useRouter } from 'expo-router';
import { LogIn } from 'lucide-react-native';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleLoginButton() {
  const router = useRouter();
  const { setUser, setLoading, isLoading } = useAuthStore();

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CONFIG.androidClientId,
    iosClientId: GOOGLE_CONFIG.iosClientId,
    webClientId: GOOGLE_CONFIG.webClientId,
    scopes: GOOGLE_CONFIG.scopes,
  }, {
    scheme: 'timeliney',
    useProxy: false,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleSignIn(authentication?.accessToken);
    } else if (response?.type === 'error') {
      Alert.alert('Authentication Error', response.error?.message || 'Failed to sign in with Google');
    }
  }, [response]);

  const handleGoogleSignIn = async (accessToken: string | undefined) => {
    if (!accessToken) return;

    setLoading(true);
    try {
      // Fetch user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await userInfoResponse.json();

      setUser({
        uid: userInfo.id,
        email: userInfo.email,
        username: userInfo.name,
        accessToken: accessToken,
      });

      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      Alert.alert('Error', 'Failed to fetch user info from Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => promptAsync()}
      disabled={!request || isLoading}
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
