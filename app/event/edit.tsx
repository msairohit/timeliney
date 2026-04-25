import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Platform, KeyboardAvoidingView, Switch } from 'react-native';
import { useRouter as useExpoRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Calendar as CalendarIcon, MapPin, Tag, Clock } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useEventStore } from '../../store/eventStore';
import { TAGS_LIST } from '../../constants/themes';
import { TagId } from '../../types';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MediaPicker } from '../../components/event/MediaPicker';
import { DocumentPicker } from '../../components/event/DocumentPicker';

export default function EditEventScreen() {
  const router = useExpoRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  
  const getEventById = useEventStore((state) => state.getEventById);
  const updateEvent = useEventStore((state) => state.updateEvent);

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
  const [localMediaUris, setLocalMediaUris] = useState<string[]>([]);
  const [documents, setDocuments] = useState<{ uri: string; name: string }[]>([]);
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [occurrenceIndex, setOccurrenceIndex] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const event = getEventById(id);
      if (event) {
        setTitle(event.title);
        setDescription(event.description || '');
        setPlace(event.place || '');
        setIsDateUnknown(!!event.isDateUnknown);
        setIsTimeUnknown(!!event.isTimeUnknown);
        
        if (event.eventDate) {
          setEventDate(new Date(event.eventDate));
        }
        
        if (event.eventTime && !event.isTimeUnknown) {
          const [hours, minutes, modifier] = event.eventTime.split(/[: ]/);
          let hoursInt = parseInt(hours, 10);
          if (modifier === 'PM' && hoursInt < 12) hoursInt += 12;
          if (modifier === 'AM' && hoursInt === 12) hoursInt = 0;
          const t = new Date();
          t.setHours(hoursInt, parseInt(minutes, 10), 0);
          setEventTime(t);
        }
        
        setSelectedTags(event.tags);
        setLocalMediaUris(event.localMediaUris || []);
        
        const docNames = event.documentNames || [];
        const docUris = event.localDocumentUris || [];
        const docs = docNames.map((name, i) => ({ name, uri: docUris[i] }));
        setDocuments(docs);
        setGroupId(event.groupId);
        setOccurrenceIndex(event.occurrenceIndex);
      }
    }
    setLoading(false);
  }, [id, getEventById]);

  const toggleTag = (tagId: TagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    if (!id) return;

    const updatedData = {
      title: title.trim(),
      description: description.trim(),
      eventDate: isDateUnknown ? '' : format(eventDate, 'yyyy-MM-dd'),
      isDateUnknown,
      place: place.trim(),
      eventTime: isTimeUnknown ? '' : eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isTimeUnknown,
      tags: selectedTags,
      localMediaUris: localMediaUris,
      documentNames: documents.map(d => d.name),
      localDocumentUris: documents.map(d => d.uri),
      groupId,
      occurrenceIndex,
      updatedAt: new Date().toISOString(),
    };

    updateEvent(id, updatedData);
    router.back();
  };

  if (loading) return null;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
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
});
