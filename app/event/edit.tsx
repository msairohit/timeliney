import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Platform, KeyboardAvoidingView, Switch, Alert } from 'react-native';
import { useRouter as useExpoRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Calendar as CalendarIcon, MapPin, Tag, Clock, ArrowRight, Bell } from 'lucide-react-native';
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
import { scheduleEventNotification, cancelNotification } from '../../utils/notifications';
import { PeopleInput } from '../../components/event/PeopleInput';

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
  const [people, setPeople] = useState<string[]>([]);

  // Date range state
  const [isDateRange, setIsDateRange] = useState(false);
  const [endDate, setEndDate] = useState(new Date());
  const [isEndDateUnknown, setIsEndDateUnknown] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Reminder state
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(1);
  const [reminderTime, setReminderTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [notificationId, setNotificationId] = useState<string | undefined>(undefined);

  const pickerReminderTimeValue = React.useMemo(() => {
    return (reminderTime instanceof Date && !isNaN(reminderTime.getTime())) ? reminderTime : new Date();
  }, [reminderTime]);

  const pickerEndDateValue = React.useMemo(() => {
    return (endDate instanceof Date && !isNaN(endDate.getTime())) ? endDate : new Date();
  }, [endDate]);

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
        setHasReminder(!!event.hasReminder);
        setReminderDaysBefore(event.reminderDaysBefore ?? 1);
        setNotificationId(event.notificationId);

        if (event.reminderTime) {
          const match = event.reminderTime.match(/(\d+)[:.](\d+)\s*(AM|PM)?/i);
          if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const modifier = match[3]?.toUpperCase();

            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;

            const t = new Date();
            t.setHours(hours, minutes, 0, 0);
            setReminderTime(t);
          }
        }
        
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
        
        setSelectedTags(event.tags || []);
        setPeople(event.people || []);
        
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
        const localDocNames = event.localDocumentNames || [];
        const cloudDocUrls = event.documentUrls || [];
        
        const combinedDocs: { uri: string; name: string }[] = [];
        
        // Add local documents
        localDocUris.forEach((uri, i) => {
          combinedDocs.push({
            uri,
            name: localDocNames[i] || uri.split('/').pop() || `doc_${i}`
          });
        });
        
        // Add cloud documents
        cloudDocUrls.forEach((uri, i) => {
          combinedDocs.push({
            uri,
            name: docNames[i] || uri.split('/').pop() || `doc_${i}`
          });
        });
        
        setDocuments(combinedDocs);
        setGroupId(event.groupId);

        // Load date range fields
        if (event.endDate !== undefined || event.isEndDateUnknown) {
          setIsDateRange(true);
          setIsEndDateUnknown(!!event.isEndDateUnknown);
          if (event.endDate && event.endDate !== '') {
            const [ey, em, ed] = event.endDate.split('-').map(Number);
            if (!isNaN(ey) && !isNaN(em) && !isNaN(ed)) {
              setEndDate(new Date(ey, em - 1, ed));
            }
          }
        }

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

    // Detect renamed cloud files
    const renamedFiles: { id: string; name: string }[] = [];
    allMedia.forEach(m => {
      if (!isLocal(m.uri)) {
        const originalIdx = originalEvent?.mediaUrls?.indexOf(m.uri);
        if (originalIdx !== undefined && originalIdx !== -1) {
          const originalName = originalEvent?.mediaNames?.[originalIdx];
          if (originalName && originalName !== m.name) {
            renamedFiles.push({ id: m.uri, name: m.name });
          }
        }
      }
    });
    
    documents.forEach(d => {
      if (!isLocal(d.uri)) {
        const originalIdx = originalEvent?.documentUrls?.indexOf(d.uri);
        if (originalIdx !== undefined && originalIdx !== -1) {
          const originalName = originalEvent?.documentNames?.[originalIdx];
          if (originalName && originalName !== d.name) {
            renamedFiles.push({ id: d.uri, name: d.name });
          }
        }
      }
    });

    const saveChanges = async (deleteMedia: boolean = false) => {
      const updatedData = {
        title: title.trim(),
        description: description.trim(),
        eventDate: isDateUnknown ? '' : format(eventDate, 'yyyy-MM-dd'),
        isDateUnknown,
        place: place.trim(),
        eventTime: isTimeUnknown ? '' : format(eventTime, 'hh:mm a'),
        isTimeUnknown,
        // Date range fields
        endDate: isDateRange ? (isEndDateUnknown ? '' : format(endDate, 'yyyy-MM-dd')) : undefined,
        isEndDateUnknown: isDateRange ? isEndDateUnknown : undefined,
        tags: selectedTags,
        people,
        localMediaUris: allMedia.filter(m => isLocal(m.uri)).map(m => m.uri),
        localMediaNames: allMedia.filter(m => isLocal(m.uri)).map(m => m.name),
        mediaUrls: allMedia.filter(m => !isLocal(m.uri)).map(m => m.uri),
        mediaNames: allMedia.filter(m => !isLocal(m.uri)).map(m => m.name),
        documentNames: documents.filter(d => !isLocal(d.uri)).map(d => d.name),
        localDocumentUris: documents.filter(d => isLocal(d.uri)).map(d => d.uri),
        localDocumentNames: documents.filter(d => isLocal(d.uri)).map(d => d.name),
        documentUrls: documents.filter(d => !isLocal(d.uri)).map(d => d.uri),
        groupId: groupId || (isRecurring ? uuidv4() : undefined),
        groupTitle: (groupId || isRecurring) ? title.trim() : undefined,
        occurrenceIndex: occurrenceIndex || (isRecurring ? 0 : undefined),
        hasReminder,
        reminderDaysBefore: hasReminder ? reminderDaysBefore : undefined,
        reminderTime: hasReminder ? format(reminderTime, 'hh:mm a') : undefined,
        notificationId: notificationId, // Will update below if needed
        updatedAt: new Date().toISOString(),
      };

      // Process notification
      if (originalEvent?.notificationId && (!hasReminder || originalEvent.eventDate !== updatedData.eventDate || originalEvent.eventTime !== updatedData.eventTime || originalEvent.reminderDaysBefore !== updatedData.reminderDaysBefore || originalEvent.reminderTime !== updatedData.reminderTime)) {
        await cancelNotification(originalEvent.notificationId);
        updatedData.notificationId = undefined;
      }

      if (hasReminder && !updatedData.isDateUnknown) {
        if (!updatedData.notificationId || originalEvent?.eventDate !== updatedData.eventDate || originalEvent?.eventTime !== updatedData.eventTime || originalEvent?.reminderDaysBefore !== updatedData.reminderDaysBefore || originalEvent?.reminderTime !== updatedData.reminderTime) {
          const newNotificationId = await scheduleEventNotification(
            id,
            updatedData.title,
            updatedData.eventDate,
            updatedData.eventTime,
            reminderDaysBefore,
            updatedData.reminderTime
          );
          if (newNotificationId) {
            updatedData.notificationId = newNotificationId;
          }
        }
      }

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
        // We don't necessarily need to await cleanup for the folder rename safety,
        // but it's good practice to keep it consistent.
        useEventStore.getState().cleanupMedia(originalEvent?.title || title, removedDriveIds, { deleteMedia });
      }
      
      // Rename files on Drive if needed
      for (const file of renamedFiles) {
        useEventStore.getState().renameDriveFile(file.id, file.name);
      }

      if (originalEvent && originalEvent.title !== title.trim()) {
        // MUST await rename before syncing new media to avoid duplicate folders
        await useEventStore.getState().renameEventFolder(originalEvent.title, title.trim());
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
            onPress: () => {
              Alert.alert(
                'Double Confirmation Required',
                'Are you absolutely sure you want to permanently delete these removed files from Google Drive? This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Yes, Delete Permanently',
                    style: 'destructive',
                    onPress: () => saveChanges(true)
                  }
                ]
              );
            } 
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
                    date.setSeconds(0, 0);
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

        {/* Date Range Toggle */}
        <Animated.View entering={FadeInUp.delay(130)} style={styles.dateRangeSection}>
          <View style={styles.dateRangeHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ArrowRight size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>Date Range / Period</Text>
            </View>
            <Switch
              value={isDateRange}
              onValueChange={(val) => {
                setIsDateRange(val);
                if (!val) {
                  setIsEndDateUnknown(false);
                }
              }}
              trackColor={{ false: "#e2e8f0", true: "#0f172a" }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.dateRangeHint}>
            Enable for events spanning a period (e.g. school, college, job)
          </Text>

          {isDateRange && (
            <View style={styles.endDateContainer}>
              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <CalendarIcon size={20} color={isEndDateUnknown ? "#cbd5e1" : "#64748b"} />
                </View>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={pickerEndDateValue}
                    mode="date"
                    display="compact"
                    onChange={(event, date) => date && setEndDate(date)}
                    style={[styles.datePickerIos, isEndDateUnknown && { opacity: 0.3 }]}
                    disabled={isEndDateUnknown}
                  />
                ) : (
                  <Pressable
                    onPress={() => !isEndDateUnknown && setShowEndDatePicker(true)}
                    style={[styles.dateInputWrapper, isEndDateUnknown && { opacity: 0.3 }]}
                  >
                    <Text style={styles.dateText}>{format(endDate, 'PPP')}</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.unknownToggle}>
                <Text style={styles.unknownText}>Ongoing / Unknown End</Text>
                <Switch
                  value={isEndDateUnknown}
                  onValueChange={setIsEndDateUnknown}
                  trackColor={{ false: "#e2e8f0", true: "#0f172a" }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          )}
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

        <Animated.View entering={FadeInUp.delay(175)} style={styles.reminderSection}>
          <View style={styles.reminderHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Bell size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>Remind Me</Text>
            </View>
            <Switch
              value={hasReminder}
              onValueChange={setHasReminder}
              trackColor={{ false: "#e2e8f0", true: "#0f172a" }}
              thumbColor="#fff"
              disabled={isDateUnknown}
            />
          </View>
          
          {hasReminder && (
            <View style={styles.reminderOptions}>
              <Text style={styles.reminderHint}>Notify me about this event:</Text>
              <View style={styles.reminderChips}>
                {[0, 1, 3, 7].map((days) => (
                  <Pressable
                    key={days}
                    onPress={() => setReminderDaysBefore(days)}
                    style={[
                      styles.reminderChip,
                      reminderDaysBefore === days && styles.reminderChipActive
                    ]}
                  >
                    <Text style={[
                      styles.reminderChipText,
                      reminderDaysBefore === days && styles.reminderChipTextActive
                    ]}>
                      {days === 0 ? 'On day' : `${days} day${days > 1 ? 's' : ''} before`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.reminderTimeContainer}>
                <Text style={styles.reminderHint}>At time:</Text>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={pickerReminderTimeValue}
                    mode="time"
                    display="compact"
                    onChange={(event, date) => {
                      if (date) {
                        date.setSeconds(0, 0);
                        setReminderTime(date);
                      }
                    }}
                    style={styles.datePickerIos}
                  />
                ) : (
                  <Pressable 
                    onPress={() => setShowReminderTimePicker(true)} 
                    style={styles.reminderTimeButton}
                  >
                    <Text style={styles.dateText}>{format(reminderTime, 'hh:mm a')}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
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

        <Animated.View entering={FadeInUp.delay(275)}>
          <PeopleInput people={people} onPeopleChange={setPeople} />
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
              date.setSeconds(0, 0);
              setEventTime(date);
            }
          }}
        />
      )}
      {showEndDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerEndDateValue}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowEndDatePicker(false);
            if (event.type === 'set' && date) {
              setEndDate(date);
            }
          }}
        />
      )}
      {showReminderTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerReminderTimeValue}
          mode="time"
          display="default"
          onChange={(event, date) => {
            setShowReminderTimePicker(false);
            if (event.type === 'set' && date) {
              date.setSeconds(0, 0);
              setReminderTime(date);
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
  dateRangeSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  dateRangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRangeHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '400',
    lineHeight: 16,
  },
  endDateContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#bae6fd',
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
  reminderSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderOptions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
  },
  reminderHint: {
    fontSize: 14,
    color: '#92400e',
    marginBottom: 12,
  },
  reminderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  reminderChipActive: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  reminderChipText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
  },
  reminderChipTextActive: {
    color: '#fff',
  },
  reminderTimeContainer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderTimeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
});
