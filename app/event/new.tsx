import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Platform, KeyboardAvoidingView, Switch } from 'react-native';
import { useRouter as useExpoRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Calendar as CalendarIcon, MapPin, Tag, Clock } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useEventStore } from '../../store/eventStore';
import { useAuthStore } from '../../store/authStore';
import { TAGS_LIST } from '../../constants/themes';
import { TagId } from '../../types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MediaPicker } from '../../components/event/MediaPicker';
import { DocumentPicker } from '../../components/event/DocumentPicker';

export default function CreateEventScreen() {
  const router = useExpoRouter();
  const params = useLocalSearchParams<{ 
    groupId?: string; 
    groupTitle?: string;
    tags?: string;
    place?: string;
    description?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { events, addEvent } = useEventStore();
  const user = useAuthStore(state => state.user);

  const [title, setTitle] = useState(params.groupTitle || '');
  const [description, setDescription] = useState(params.description || '');
  const [place, setPlace] = useState(params.place || '');
  const [eventDate, setEventDate] = useState(new Date());
  const [eventTime, setEventTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagId[]>(
    params.tags ? (params.tags.split(',') as TagId[]) : []
  );
  const [isDateUnknown, setIsDateUnknown] = useState(false);
  const [isTimeUnknown, setIsTimeUnknown] = useState(false);
  const [localMediaUris, setLocalMediaUris] = useState<string[]>([]);
  const [documents, setDocuments] = useState<{ uri: string; name: string }[]>([]);
  
  // Multiple occurrences state
  const [isRecurring, setIsRecurring] = useState(false);
  const [additionalDates, setAdditionalDates] = useState<Date[]>([]);
  const [showAdditionalDatePicker, setShowAdditionalDatePicker] = useState(false);
  const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);

  const toggleTag = (id: TagId) => {
    setSelectedTags(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    const finalGroupId = params.groupId || (isRecurring ? uuidv4() : undefined);
    const existingInGroup = params.groupId ? events.filter(e => e.groupId === params.groupId) : [];
    const baseIndex = params.groupId ? existingInGroup.length + 1 : 1;

    const baseEvent = {
      userId: user?.uid || 'local-user',
      title: title.trim(),
      description: description.trim(),
      place: place.trim(),
      isDateUnknown,
      eventTime: isTimeUnknown ? '' : eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isTimeUnknown,
      tags: selectedTags,
      mediaUrls: [],
      localMediaUris: localMediaUris,
      documentUrls: [],
      documentNames: documents.map(d => d.name),
      localDocumentUris: documents.map(d => d.uri),
      customFields: {},
      syncStatus: 'local' as const,
      groupId: finalGroupId,
      groupTitle: (params.groupId || isRecurring) ? (params.groupTitle || title.trim()) : undefined,
    };

    if (isRecurring || params.groupId) {
      // Create primary event
      const primaryEvent = {
        ...baseEvent,
        id: uuidv4(),
        eventDate: isDateUnknown ? '' : format(eventDate, 'yyyy-MM-dd'),
        occurrenceIndex: baseIndex,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addEvent(primaryEvent as any);

      // Create additional occurrences if any
      additionalDates.forEach((date, index) => {
        const occurrenceEvent = {
          ...baseEvent,
          id: uuidv4(),
          eventDate: format(date, 'yyyy-MM-dd'),
          occurrenceIndex: baseIndex + index + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addEvent(occurrenceEvent as any);
      });
    } else {
      const newEvent = {
        ...baseEvent,
        id: uuidv4(),
        eventDate: isDateUnknown ? '' : format(eventDate, 'yyyy-MM-dd'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addEvent(newEvent as any);
    }

    router.back();
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

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.iconButton}>
          <X size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>New Event</Text>
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
                value={eventDate}
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
                <Text style={styles.dateText}>{eventDate.toLocaleDateString()}</Text>
              </Pressable>
            )}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={eventDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (event.type === 'set' && date) setEventDate(date);
                }}
              />
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
                value={eventTime}
                mode="time"
                display="compact"
                onChange={(event, date) => date && setEventTime(date)}
                style={[styles.datePickerIos, isTimeUnknown && { opacity: 0.3 }]}
                disabled={isTimeUnknown}
              />
            ) : (
              <Pressable 
                onPress={() => !isTimeUnknown && setShowTimePicker(true)} 
                style={[styles.dateInputWrapper, isTimeUnknown && { opacity: 0.3 }]}
              >
                <Text style={styles.dateText}>{eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </Pressable>
            )}
            {showTimePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={eventTime}
                mode="time"
                display="default"
                onChange={(event, date) => {
                  setShowTimePicker(false);
                  if (event.type === 'set' && date) setEventTime(date);
                }}
              />
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
                {params.groupId ? 'Series Part' : 'Multiple Occurrences / Series'}
              </Text>
            </View>
            {!params.groupId && (
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: "#e2e8f0", true: "#0f172a" }}
                thumbColor="#fff"
              />
            )}
          </View>
          
          {(isRecurring || params.groupId) && (
            <View style={styles.occurrencesList}>
              <Text style={styles.occurrenceLabel}>
                {params.groupId ? 'New Occurrence' : 'Occurrence 1'}: {eventDate.toLocaleDateString()}
              </Text>
              
              {additionalDates.map((date, index) => (
                <View key={index} style={styles.occurrenceItem}>
                  <Text style={styles.occurrenceLabel}>Occurrence {params.groupId ? index + 2 : index + 2}:</Text>
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
                <Text style={styles.addDateButtonText}>+ Add Another Part</Text>
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
          <MediaPicker uris={localMediaUris} onUrisChange={setLocalMediaUris} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350)}>
          <DocumentPicker 
            documents={documents} 
            onDocumentsChange={setDocuments} 
          />
        </Animated.View>
      </ScrollView>
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
