import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Platform, KeyboardAvoidingView, Switch, Alert } from 'react-native';
import { useRouter as useExpoRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Calendar as CalendarIcon, MapPin, Tag, Clock } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useEventStore } from '../../store/eventStore';
import { useAuthStore } from '../../store/authStore';
import { TAGS_LIST } from '../../constants/themes';
import { TagId } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MediaPicker } from '../../components/event/MediaPicker';
import { DocumentPicker } from '../../components/event/DocumentPicker';

export default function EditEventScreen() {
  const router = useExpoRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  
  const getEventById = useEventStore((state) => state.getEventById);
  const updateEvent = useEventStore((state) => state.updateEvent);
  const user = useAuthStore(state => state.user);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [eventTime, setEventTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagId[]>([]);
  const [isDateUnknown, setIsDateUnknown] = useState(false);
  const [isTimeUnknown, setIsTimeUnknown] = useState(false);
  const [allMedia, setAllMedia] = useState<{ uri: string; name: string }[]>([]);
  const [documents, setDocuments] = useState<{ uri: string; name: string }[]>([]);
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [occurrenceIndex, setOccurrenceIndex] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [additionalDates, setAdditionalDates] = useState<Date[]>([]);
  const [showAdditionalDatePicker, setShowAdditionalDatePicker] = useState(false);
  const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);
  const allEvents = useEventStore(state => state.events);
  const initialLoadDone = React.useRef(false);

  // Calculate series info
  const existingInGroup = React.useMemo(() => 
    groupId ? allEvents.filter(e => e.groupId === groupId) : [],
    [allEvents, groupId]
  );
  
  const maxIndex = React.useMemo(() => 
    Math.max(...existingInGroup.map(e => e.occurrenceIndex || 0), 0),
    [existingInGroup]
  );

  const pickerDateValue = React.useMemo(() => {
    return (eventDate instanceof Date && !isNaN(eventDate.getTime())) ? eventDate : new Date();
  }, [eventDate]);

  const pickerTimeValue = React.useMemo(() => {
    return (eventTime instanceof Date && !isNaN(eventTime.getTime())) ? eventTime : new Date();
  }, [eventTime]);

  useEffect(() => {
    if (id && !initialLoadDone.current) {
      const event = getEventById(id);
      if (event) {
        setTitle(event.title);
        setDescription(event.description || '');
        setPlace(event.place || '');
        setIsDateUnknown(!!event.isDateUnknown);
        setIsTimeUnknown(!!event.isTimeUnknown);
        
        if (event.eventDate && event.eventDate !== '') {
          const [y, m, d] = event.eventDate.split('-').map(Number);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            setEventDate(new Date(y, m - 1, d));
          }
        }
        
        if (event.eventTime && !event.isTimeUnknown) {
          // Robust parsing for various time formats (hh:mm a, HH:mm, hh.mm a)
          const timeStr = event.eventTime.toUpperCase();
          const match = timeStr.match(/(\d+)[:.](\d+)\s*(AM|PM)?/);
          if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const modifier = match[3];

            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;

            const t = new Date();
            t.setHours(hours, minutes, 0, 0);
            setEventTime(t);
          }
        }
        
        setSelectedTags(event.tags);
        
        // Load Media with names
        const mediaNames = event.mediaNames || [];
        const localMediaUris = event.localMediaUris || [];
        const localMediaNames = event.localMediaNames || [];
        const cloudMediaUrls = event.mediaUrls || [];
        
        const combinedMedia: { uri: string; name: string }[] = [];
        
        // Add local media
        localMediaUris.forEach((uri, i) => {
          combinedMedia.push({
            uri,
            name: localMediaNames[i] || uri.split('/').pop() || `image_${i}`
          });
        });
        
        // Add cloud media
        cloudMediaUrls.forEach((uri, i) => {
          combinedMedia.push({
            uri,
            name: mediaNames[i] || uri.split('/').pop() || `image_${i}`
          });
        });
        
        setAllMedia(combinedMedia);
        
        const docNames = event.documentNames || [];
        const localDocUris = event.localDocumentUris || [];
        const cloudDocUrls = event.documentUrls || [];
        
        // Combine and deduplicate documents
        const syncedDocs = docNames.map((name, i) => {
          const local = localDocUris[i];
          const cloud = cloudDocUrls[i];
          return {
            name,
            uri: local || cloud || ''
          };
        });

        setDocuments(syncedDocs);
        setGroupId(event.groupId);
        initialLoadDone.current = true;
        setLoading(false);
      } else {
        // If event not found after some time, stop loading
        const timer = setTimeout(() => {
          if (!initialLoadDone.current) setLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [id, getEventById]);

  const toggleTag = (tagId: TagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const addAdditionalDate = () => {
    setAdditionalDates([...additionalDates, new Date()]);
  };

  const removeAdditionalDate = (index: number) => {
    setAdditionalDates(additionalDates.filter((_, i) => i !== index));
  };

  const updateAdditionalDate = (index: number, date: Date) => {
    const newDates = [...additionalDates];
    newDates[index] = date;
    setAdditionalDates(newDates);
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    if (!id) return;

    const isLocal = (uri: string) => uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/');
    
    const originalEvent = getEventById(id);
    const originalDriveIds = [
      ...(originalEvent?.mediaUrls || []),
      ...(originalEvent?.documentUrls || [])
    ];
    
    const currentDriveIds = [
      ...allMedia.filter(m => !isLocal(m.uri)).map(m => m.uri),
      ...documents.filter(d => !isLocal(d.uri)).map(d => d.uri)
    ];
    
    const removedDriveIds = originalDriveIds.filter(fid => !currentDriveIds.includes(fid));

    const saveChanges = (deleteMedia: boolean = false) => {
      const updatedData = {
        title: title.trim(),
        description: description.trim(),
        eventDate: isDateUnknown ? '' : format(eventDate, 'yyyy-MM-dd'),
        isDateUnknown,
        place: place.trim(),
        eventTime: isTimeUnknown ? '' : format(eventTime, 'hh:mm a'),
        isTimeUnknown,
        tags: selectedTags,
        localMediaUris: allMedia.filter(m => isLocal(m.uri)).map(m => m.uri),
        localMediaNames: allMedia.filter(m => isLocal(m.uri)).map(m => m.name),
        mediaUrls: allMedia.filter(m => !isLocal(m.uri)).map(m => m.uri),
        mediaNames: allMedia.filter(m => !isLocal(m.uri)).map(m => m.name),
        documentNames: documents.map(d => d.name),
        localDocumentUris: documents.filter(d => isLocal(d.uri)).map(d => d.uri),
        localDocumentNames: documents.filter(d => isLocal(d.uri)).map(d => d.name),
        documentUrls: documents.filter(d => !isLocal(d.uri)).map(d => d.uri),
        groupId: groupId || (isRecurring ? uuidv4() : undefined),
        groupTitle: (groupId || isRecurring) ? title.trim() : undefined,
        occurrenceIndex: occurrenceIndex || (isRecurring ? 0 : undefined),
        updatedAt: new Date().toISOString(),
      };

      updateEvent(id, updatedData);

      // Create additional occurrences if any
      if (additionalDates.length > 0) {
        additionalDates.forEach((date, index) => {
          const occurrenceEvent = {
            ...updatedData,
            id: uuidv4(),
            eventDate: format(date, 'yyyy-MM-dd'),
            occurrenceIndex: 0, // Will be reordered
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncStatus: 'local' as const,
          };
          useEventStore.getState().addEvent(occurrenceEvent as any);
        });
      }
      
      if (updatedData.groupId) {
        useEventStore.getState().reorderGroupEvents(updatedData.groupId);
      }
      
      // Cleanup removed media if any
      if (removedDriveIds.length > 0) {
        useEventStore.getState().cleanupMedia(originalEvent?.title || title, removedDriveIds, { deleteMedia });
      }

      // Trigger sync once at the end
      if (user && user.uid) {
        useEventStore.getState().syncEvents(user.uid);
      }
      
      router.back();
    };

    if (removedDriveIds.length > 0) {
      Alert.alert(
        'Media Removed',
        'You removed some files from this event. Would you like to keep them as a backup or delete them from Google Drive?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Backup Files', 
            onPress: () => saveChanges(false) 
          },
          { 
            text: 'Delete Files', 
            style: 'destructive', 
            onPress: () => saveChanges(true) 
          },
        ]
      );
    } else {
      saveChanges();
    }
  };

  if (loading) return null;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.iconButton}>
          <X size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Event</Text>
        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <Animated.View entering={FadeInUp.delay(50)}>
          <TextInput
            style={styles.titleInput}
            placeholder="Event Title"
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)} style={styles.inputGroupContainer}>
          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <CalendarIcon size={20} color={isDateUnknown ? "#cbd5e1" : "#64748b"} />
            </View>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={pickerDateValue}
                mode="date"
                display="compact"
                onChange={(event, date) => date && setEventDate(date)}
                style={[styles.datePickerIos, isDateUnknown && { opacity: 0.3 }]}
                disabled={isDateUnknown}
              />
            ) : (
              <Pressable 
                onPress={() => !isDateUnknown && setShowDatePicker(true)} 
                style={[styles.dateInputWrapper, isDateUnknown && { opacity: 0.3 }]}
              >
                <Text style={styles.dateText}>{format(eventDate, 'PPP')}</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.unknownToggle}>
            <Text style={styles.unknownText}>Unknown Date</Text>
            <Switch
              value={isDateUnknown}
              onValueChange={setIsDateUnknown}
              trackColor={{ false: "#e2e8f0", true: "#0f172a" }}
              thumbColor="#fff"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(125)} style={styles.inputGroupContainer}>
          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <Clock size={20} color={isTimeUnknown ? "#cbd5e1" : "#64748b"} />
            </View>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={pickerTimeValue}
                mode="time"
                display="compact"
                onChange={(event, date) => {
                  if (date) {
                    date.setSeconds(0, 0, 0);
                    setEventTime(date);
                  }
                }}
                style={[styles.datePickerIos, isTimeUnknown && { opacity: 0.3 }]}
                disabled={isTimeUnknown}
              />
            ) : (
              <Pressable 
                onPress={() => !isTimeUnknown && setShowTimePicker(true)} 
                style={[styles.dateInputWrapper, isTimeUnknown && { opacity: 0.3 }]}
              >
                <Text style={styles.dateText}>{format(eventTime, 'hh:mm a')}</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.unknownToggle}>
            <Text style={styles.unknownText}>Unknown Time</Text>
            <Switch
              value={isTimeUnknown}
              onValueChange={setIsTimeUnknown}
              trackColor={{ false: "#e2e8f0", true: "#0f172a" }}
              thumbColor="#fff"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(135)} style={styles.recurringSection}>
          <View style={styles.recurringHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CalendarIcon size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>
                {groupId ? 'Series Part' : 'Multiple Occurrences / Series'}
              </Text>
            </View>
            {!groupId && (
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: "#e2e8f0", true: "#0f172a" }}
                thumbColor="#fff"
              />
            )}
          </View>
          
          {(isRecurring || groupId) && (
            <View style={styles.occurrencesList}>
              <Text style={styles.occurrenceLabel}>
                {groupId ? `Occurrence ${occurrenceIndex}` : 'Occurrence 1'}: {eventDate.toLocaleDateString()}
              </Text>
              
              {additionalDates.map((date, index) => (
                <View key={index} style={styles.occurrenceItem}>
                  <Text style={styles.occurrenceLabel}>Occurrence {maxIndex + index + 1}:</Text>
                  {Platform.OS === 'ios' ? (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display="compact"
                      onChange={(event, d) => d && updateAdditionalDate(index, d)}
                      style={styles.additionalDatePicker}
                    />
                  ) : (
                    <Pressable 
                      onPress={() => {
                        setEditingDateIndex(index);
                        setShowAdditionalDatePicker(true);
                      }} 
                      style={styles.androidDateButton}
                    >
                      <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => removeAdditionalDate(index)} style={styles.removeDateButton}>
                    <X size={16} color="#ef4444" />
                  </Pressable>
                </View>
              ))}

              {showAdditionalDatePicker && Platform.OS === 'android' && editingDateIndex !== null && (
                <DateTimePicker
                  value={additionalDates[editingDateIndex]}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowAdditionalDatePicker(false);
                    if (event.type === 'set' && date) updateAdditionalDate(editingDateIndex, date);
                    setEditingDateIndex(null);
                  }}
                />
              )}

              <Pressable onPress={addAdditionalDate} style={styles.addDateButton}>
                <Text style={styles.addDateButtonText}>+ Add Another Part to Series</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150)} style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <MapPin size={20} color="#64748b" />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Location (optional)"
            placeholderTextColor="#94a3b8"
            value={place}
            onChangeText={setPlace}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200)} style={[styles.inputGroup, styles.textAreaGroup]}>
          <TextInput
            style={styles.textArea}
            placeholder="Add notes, memories, or a description..."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(250)} style={styles.tagsSection}>
          <View style={styles.tagsHeader}>
            <Tag size={20} color="#64748b" />
            <Text style={styles.tagsTitle}>Tags</Text>
          </View>
          <View style={styles.tagsContainer}>
            {TAGS_LIST.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              const TagIcon = tag.icon;
              return (
                <Pressable
                  key={tag.id}
                  onPress={() => toggleTag(tag.id)}
                  style={[
                    styles.tagChip,
                    isSelected && { backgroundColor: tag.primary, borderColor: tag.primary }
                  ]}
                >
                  <TagIcon size={14} color={isSelected ? '#fff' : '#64748b'} />
                  <Text style={[styles.tagText, isSelected && { color: '#fff' }]}>
                    {tag.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300)}>
          <MediaPicker media={allMedia} onMediaChange={setAllMedia} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350)}>
          <DocumentPicker 
            documents={documents} 
            onDocumentsChange={setDocuments} 
          />
        </Animated.View>
      </ScrollView>

      {/* Android Pickers (Outside ScrollView for stability) */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDateValue}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (event.type === 'set' && date) setEventDate(date);
          }}
        />
      )}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerTimeValue}
          mode="time"
          display="default"
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (event.type === 'set' && date) {
              date.setSeconds(0, 0, 0);
              setEventTime(date);
            }
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#f8fafc',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderRadius: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  titleInput: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 32,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  inputGroupContainer: {
    marginBottom: 24,
  },
  unknownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: -8,
    gap: 8,
  },
  unknownText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  inputIcon: {
    width: 32,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  datePickerIos: {
    flex: 1,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  textAreaGroup: {
    borderBottomWidth: 0,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  textArea: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
    minHeight: 120,
  },
  tagsSection: {
    marginBottom: 32,
  },
  tagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  tagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  recurringSection: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
  },
  recurringHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  occurrencesList: {
    marginTop: 16,
    gap: 12,
  },
  occurrenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  occurrenceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    minWidth: 80,
  },
  additionalDatePicker: {
    flex: 1,
  },
  androidDateButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  removeDateButton: {
    padding: 8,
  },
  addDateButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
  },
  addDateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
});
