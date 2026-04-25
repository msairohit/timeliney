import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { auth } from '../../constants/FirebaseConfig';
import { signOut } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { User, Mail, LogOut, Shield, Bell, CircleHelp as HelpCircle, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            logout();
            router.replace('/(auth)/login');
          } catch (error) {
            Alert.alert('Error', 'Failed to logout');
          }
        }
      },
    ]);
  };

  const ProfileItem = ({ icon: Icon, label, value, onPress, destructive = false }: any) => (
    <TouchableOpacity style={styles.item} onPress={onPress} disabled={!onPress}>
      <View style={[styles.itemIcon, destructive && styles.destructiveIcon]}>
        <Icon size={20} color={destructive ? '#ef4444' : '#6366f1'} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemLabel}>{label}</Text>
        {value && <Text style={styles.itemValue}>{value}</Text>}
      </View>
      {onPress && <ChevronRight size={20} color="#cbd5e1" />}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#6366f1', '#a855f7']}
        style={styles.header}
      >
        <View style={styles.avatarContainer}>
          <User size={40} color="#fff" />
        </View>
        <Text style={styles.userName}>{user?.username || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <ProfileItem icon={User} label="Username" value={user?.username} />
        <ProfileItem icon={Mail} label="Email Address" value={user?.email} />
        <ProfileItem icon={Shield} label="Security" onPress={() => {}} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <ProfileItem icon={Bell} label="Notifications" onPress={() => {}} />
        <ProfileItem icon={HelpCircle} label="Help & Support" onPress={() => {}} />
      </View>

      <View style={styles.section}>
        <ProfileItem 
          icon={LogOut} 
          label="Logout" 
          onPress={handleLogout} 
          destructive 
        />
      </View>

      <Text style={styles.version}>Timeliney v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  destructiveIcon: {
    backgroundColor: '#fef2f2',
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  itemValue: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  version: {
    textAlign: 'center',
    color: '#cbd5e1',
    fontSize: 12,
    marginVertical: 32,
  },
});
