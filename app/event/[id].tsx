import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Trash2, 
  Edit2, 
  Clock, 
  Tag as TagIcon, 
  Image as ImageIcon, 
  FileText, 
  MoreVertical,
  Share2,
  ExternalLink,
  X
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { Modal } from 'react-native';
import { useEventStore } from '../../store/eventStore';
import { TAG_THEMES } from '../../constants/themes';
import Animated, { 
  FadeInDown, 
  FadeInRight, 
  interpolate, 
  useAnimatedScrollHandler, 
  useAnimatedStyle, 
  useSharedValue 
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  
  const allEvents = useEventStore((state) => state.events);
  const event = useEventStore((state) => state.getEventById(id as string));
  const deleteEvent = useEventStore((state) => state.deleteEvent);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);

  const groupEvents = React.useMemo(() => {
    if (!event?.groupId) return [];
    return allEvents
      .filter(e => e.groupId === event.groupId)
      .sort((a, b) => {
        if (a.occurrenceIndex && b.occurrenceIndex) return a.occurrenceIndex - b.occurrenceIndex;
        return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      });
  }, [allEvents, event?.groupId]);

  if (!event) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Event not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#0f172a', fontWeight: 'bold' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const primaryTag = event.tags[0] ? TAG_THEMES[event.tags[0]] : TAG_THEMES.other;
  const EventIcon = primaryTag.icon;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: `rgba(255, 255, 255, ${interpolate(scrollY.value, [0, 100], [0, 1])})`,
      borderBottomWidth: interpolate(scrollY.value, [80, 100], [0, 1]),
      borderBottomColor: '#e2e8f0',
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [120, 150], [0, 1]),
      transform: [{ translateY: interpolate(scrollY.value, [120, 150], [10, 0]) }],
    };
  });

  const iconScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: interpolate(scrollY.value, [-100, 0, 100], [1.2, 1, 0.8]) },
        { translateY: interpolate(scrollY.value, [0, 100], [0, -20]) }
      ],
      opacity: interpolate(scrollY.value, [0, 150], [1, 0]),
    };
  });

  const handleDelete = () => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: () => {
          deleteEvent(event.id);
          router.back();
        } 
      },
    ]);
  };

  const formatDate = (dateStr: string, isUnknown?: boolean) => {
    if (isUnknown || !dateStr) return 'Unknown Date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getMimeType = (uri: string) => {
    const ext = uri.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'doc': return 'application/msword';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'txt': return 'text/plain';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      default: return '*/*';
    }
  };

  const handleOpenDocument = async (uri: string) => {
    try {
      if (Platform.OS === 'android') {
        console.log('Phase 1: Attempting direct Open (Intent)...');
        let contentUri = uri;
        
        if (uri.startsWith('file://') || uri.startsWith('/')) {
          // Try to get content URI
          contentUri = await FileSystem.getContentUriAsync(uri);
        }
        
        const mimeType = getMimeType(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1 | 2 | 64, // READ | WRITE | PERSISTABLE
          type: mimeType,
        });
      } else {
        // iOS: Quick Look preview is effectively an "Open"
        await Sharing.shareAsync(uri);
      }
    } catch (error) {
      console.log('Phase 1 failed, attempting Phase 2 (Sharing)...', error);
      try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, { 
            mimeType: getMimeType(uri),
            dialogTitle: 'Open Document' 
          });
        } else {
          // Final fallback
          const WebBrowser = require('expo-web-browser');
          await WebBrowser.openBrowserAsync(uri);
        }
      } catch (shareError) {
        console.error('Final fallback failed:', shareError);
        Alert.alert('Error', 'Could not open or share this document.');
      }
    }
  };

  const handleOpenImage = (uri: string) => {
    setSelectedImage(uri);
  };

  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.header, headerStyle, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <ArrowLeft size={24} color="#1e293b" />
          </Pressable>
          
          <Animated.Text style={[styles.headerTitle, titleStyle]} numberOfLines={1}>
            {event.title}
          </Animated.Text>

          <View style={styles.headerActions}>
            <Pressable 
              onPress={() => router.push({ pathname: '/event/edit', params: { id: event.id } })}
              style={styles.headerButton}
            >
              <Edit2 size={20} color="#1e293b" />
            </Pressable>
            <Pressable onPress={handleDelete} style={[styles.headerButton, styles.deleteButton]}>
              <Trash2 size={20} color="#ef4444" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: primaryTag.background }]}>
          <Animated.View style={[styles.iconContainer, iconScaleStyle, { backgroundColor: '#fff' }]}>
            <EventIcon size={48} color={primaryTag.primary} strokeWidth={2.5} />
          </Animated.View>
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.duration(600).delay(200)}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{event.title}</Text>
              <View style={[styles.tagBadge, { backgroundColor: primaryTag.badgeBackground, borderColor: primaryTag.cardBorder }]}>
                <TagIcon size={14} color={primaryTag.primary} />
                <Text style={[styles.tagText, { color: primaryTag.primary }]}>{primaryTag.label}</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={[styles.infoCard, { borderColor: primaryTag.cardBorder }]}>
                <View style={[styles.infoIconWrapper, { backgroundColor: primaryTag.badgeBackground }]}>
                  <Calendar size={18} color={primaryTag.primary} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={[styles.infoValue, { color: primaryTag.badgeText }]}>
                    {formatDate(event.eventDate, event.isDateUnknown)}
                  </Text>
                </View>
              </View>

              {(event.eventTime || event.isTimeUnknown) && (
                <View style={[styles.infoCard, { borderColor: primaryTag.cardBorder }]}>
                  <View style={[styles.infoIconWrapper, { backgroundColor: primaryTag.badgeBackground }]}>
                    <Clock size={18} color={primaryTag.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>Time</Text>
                    <Text style={[styles.infoValue, { color: primaryTag.badgeText }]}>
                      {event.isTimeUnknown ? 'Unknown Time' : event.eventTime}
                    </Text>
                  </View>
                </View>
              )}

              {event.place && (
                <View style={[styles.infoCard, { borderColor: primaryTag.cardBorder }]}>
                  <View style={[styles.infoIconWrapper, { backgroundColor: primaryTag.badgeBackground }]}>
                    <MapPin size={18} color={primaryTag.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>Location</Text>
                    <Text style={[styles.infoValue, { color: primaryTag.badgeText }]}>{event.place}</Text>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>

          {event.description && (
            <Animated.View entering={FadeInDown.duration(600).delay(400)} style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <View style={[
                styles.descriptionCard, 
                { backgroundColor: primaryTag.background, borderColor: primaryTag.cardBorder }
              ]}>
                <Text style={[styles.descriptionText, { color: primaryTag.badgeText }]}>{event.description}</Text>
              </View>
            </Animated.View>
          )}

          {/* Group/Series Section */}
          {groupEvents.length > 1 && (
            <Animated.View entering={FadeInDown.duration(600).delay(500)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Series Occurrences</Text>
                <Pressable 
                  onPress={() => router.push({
                    pathname: '/event/new',
                    params: { 
                      groupId: event.groupId, 
                      groupTitle: event.groupTitle || event.title,
                      tags: event.tags.join(','),
                      place: event.place,
                      description: event.description
                    }
                  })}
                  style={[styles.addOccurrenceButton, { backgroundColor: primaryTag.badgeBackground }]}
                >
                  <Text style={[styles.addOccurrenceText, { color: primaryTag.primary }]}>+ Add New</Text>
                </Pressable>
              </View>
              <View style={styles.groupList}>
                {groupEvents.map((item) => (
                  <Pressable 
                    key={item.id} 
                    onPress={() => router.push(`/event/${item.id}`)}
                    style={[
                      styles.groupItem, 
                      item.id === event.id && { backgroundColor: primaryTag.badgeBackground, borderColor: primaryTag.primary },
                      { borderColor: primaryTag.cardBorder }
                    ]}
                  >
                    <View style={styles.groupItemContent}>
                      <Text style={[styles.occurrenceIndex, { color: primaryTag.primary }]}>
                        #{item.occurrenceIndex || '?'}
                      </Text>
                      <View>
                        <Text style={[styles.groupItemDate, item.id === event.id && { color: primaryTag.primary }]}>
                          {formatDate(item.eventDate, item.isDateUnknown)}
                        </Text>
                        {item.id === event.id && (
                          <Text style={styles.currentLabel}>Currently Viewing</Text>
                        )}
                      </View>
                    </View>
                    <ArrowLeft size={16} color={primaryTag.primary} style={{ transform: [{ rotate: '180deg' }] }} />
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Media Section */}
          {((event.localMediaUris && event.localMediaUris.length > 0) || (event.mediaUrls && event.mediaUrls.length > 0)) && (
            <Animated.View entering={FadeInDown.duration(600).delay(600)} style={styles.section}>
              <Text style={styles.sectionTitle}>Media</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaContainer}>
                {[...(event.localMediaUris || []), ...(event.mediaUrls || [])].map((uri, index) => (
                  <Pressable key={uri + index} onPress={() => handleOpenImage(uri)}>
                    <ExpoImage 
                      source={{ uri }}
                      style={styles.mediaImage}
                      contentFit="cover"
                      transition={200}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Documents Section */}
          {((event.localDocumentUris && event.localDocumentUris.length > 0) || (event.documentUrls && event.documentUrls.length > 0)) && (
            <Animated.View entering={FadeInDown.duration(600).delay(700)} style={styles.section}>
              <Text style={styles.sectionTitle}>Documents</Text>
              <View style={styles.docsList}>
                {event.documentNames.map((name, index) => {
                  const uri = (event.localDocumentUris && event.localDocumentUris[index]) || (event.documentUrls && event.documentUrls[index]);
                  return (
                    <Pressable 
                      key={name + index} 
                      style={[styles.docItem, { borderColor: primaryTag.cardBorder }]}
                      onPress={() => uri && handleOpenDocument(uri)}
                    >
                      <View style={[styles.docIconWrapper, { backgroundColor: primaryTag.badgeBackground }]}>
                        <FileText size={20} color={primaryTag.primary} />
                      </View>
                      <Text style={styles.docName} numberOfLines={1}>{name}</Text>
                      <ExternalLink size={16} color="#94a3b8" />
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Floating Action for Share or More */}
      <Animated.View entering={FadeInDown.duration(600).delay(800)} style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}>
        <Pressable style={styles.fab}>
          <Share2 size={24} color="#fff" />
        </Pressable>
      </Animated.View>

      {/* Full Screen Image Modal */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        onRequestClose={() => setSelectedImage(null)}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <Pressable 
            style={styles.modalCloseButton} 
            onPress={() => setSelectedImage(null)}
          >
            <X size={28} color="#fff" />
          </Pressable>
          {selectedImage && (
            <ExpoImage
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              contentFit="contain"
            />
          )}
          <Pressable 
            style={styles.modalShareButton}
            onPress={() => selectedImage && handleOpenDocument(selectedImage)}
          >
            <Share2 size={20} color="#fff" />
            <Text style={styles.modalShareText}>Share</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: Platform.OS === 'ios' ? 110 : 90,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  deleteButton: {
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginHorizontal: 12,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  heroSection: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
      android: { elevation: 10 },
    }),
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  titleContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  infoGrid: {
    gap: 16,
    marginBottom: 32,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  infoIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  descriptionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#334155',
  },
  mediaContainer: {
    gap: 12,
    marginTop: 16,
  },
  mediaImage: {
    width: 200,
    height: 150,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
  },
  docsList: {
    gap: 12,
    marginTop: 16,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  docIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  fabContainer: {
    position: 'absolute',
    right: 24,
    zIndex: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: width,
    height: width * 1.5,
    maxHeight: '80%',
  },
  modalShareButton: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  modalShareText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  groupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  groupList: {
    gap: 10,
    marginTop: 8,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  groupItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  occurrenceIndex: {
    fontSize: 16,
    fontWeight: '800',
    width: 32,
  },
  groupItemDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  currentLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  addOccurrenceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addOccurrenceText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

