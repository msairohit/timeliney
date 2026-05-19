import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform, TextInput, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, Calendar, MapPin, Search, Filter, X, ArrowLeft, LayoutList, List, CalendarDays, Grid3X3, Users } from 'lucide-react-native';
import { useEventStore } from '../store/eventStore';
import { useAuthStore } from '../store/authStore';
import { TAG_THEMES, TAGS_LIST } from '../constants/themes';
import { LifeEvent, TagId } from '../types';
import Animated, { FadeInDown, FadeIn, Layout } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Image as ExpoImage } from 'expo-image';
import DriveImage from '../components/ui/DriveImage';
import { formatDuration, formatDateRange } from '../utils/duration';
import CompactView from '../components/timeline/CompactView';
import CalendarView from '../components/timeline/CalendarView';
import YearView from '../components/timeline/YearView';

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string, tag?: string, search?: string }>();
  const events = useEventStore((state) => state.events);
  const [viewMode, setViewMode] = useState<'default' | 'compact' | 'calendar' | 'year'>('default');
  const [activeTags, setActiveTags] = useState<TagId[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const user = useAuthStore((state) => state.user);
  const fetchEvents = useEventStore((state) => state.fetchEvents);

  React.useEffect(() => {
    if (params.tag) {
      setActiveTags([params.tag as TagId]);
    }
    if (params.search) {
      setSearchQuery(params.search);
      setIsSearching(true);
    }
    if (params.year) {
      const yearStart = new Date(`${params.year}-01-01T00:00:00`);
      const yearEnd = new Date(`${params.year}-12-31T23:59:59`);
      setStartDate(yearStart);
      setEndDate(yearEnd);
      setShowDateFilters(true);
    }
  }, [params.year, params.tag, params.search]);

  const onRefresh = React.useCallback(async () => {
    if (user) {
      setIsRefreshing(true);
      await fetchEvents(user.uid);
      setIsRefreshing(false);
    }
  }, [user, fetchEvents]);

  const sortedEvents = [...events]
    .filter((e) => (activeTags.length > 0 ? e.tags.some(t => activeTags.includes(t)) : true))
    .filter((e) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.place && e.place.toLowerCase().includes(q)) ||
        (e.people && e.people.some(p => p.toLowerCase().includes(q)))
      );
    })
    .filter((e) => {
      if (!startDate && !endDate) return true;
      if (e.isDateUnknown) return false; 
      
      const eventStart = e.eventDate;
      const eventEnd = e.endDate || e.eventDate; // range events: check overlap
      
      if (startDate) {
        const startStr = format(startDate, 'yyyy-MM-dd');
        if (eventEnd < startStr) return false;
      }
      if (endDate) {
        const endStr = format(endDate, 'yyyy-MM-dd');
        if (eventStart > endStr) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isDateUnknown && b.isDateUnknown) return 0;
      if (a.isDateUnknown) return 1;
      if (b.isDateUnknown) return -1;
      
      const dateCompare = new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
      if (dateCompare !== 0) return dateCompare;

      // Same date, sort by index ascending (1, 2, 3...)
      // Since timeline is newest first, for same day we show Sitting 1, then Sitting 2? 
      // Actually, usually you want Sitting 1 then Sitting 2 on the same day.
      return (a.occurrenceIndex || 0) - (b.occurrenceIndex || 0);
    });

  const activeTheme = activeTags.length === 1 ? TAG_THEMES[activeTags[0]] : null;
  const headerBg = activeTheme ? activeTheme.background : '#ffffff';
  const headerText = activeTheme ? activeTheme.primary : '#0f172a';

  const toggleTag = (tagId: TagId) => {
    setActiveTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: headerBg }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={headerText} size={24} />
          </Pressable>
          {isSearching ? (
            <View style={styles.searchContainer}>
              <TextInput
                style={[styles.searchInput, { color: headerText, borderColor: activeTheme ? 'rgba(255,255,255,0.3)' : '#e2e8f0' }]}
                placeholder="Search events..."
                placeholderTextColor={activeTheme ? 'rgba(255,255,255,0.7)' : '#94a3b8'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <Pressable onPress={() => { setIsSearching(false); setSearchQuery(''); }} style={styles.closeSearchButton}>
                <Text style={{ color: headerText, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[styles.headerTitle, { color: headerText }]}>My Timeline</Text>
              <View style={styles.headerIcons}>
                <Pressable 
                  style={[styles.iconButton, isSearching && styles.iconButtonActive]} 
                  onPress={() => setIsSearching(true)}
                >
                  <Search color={headerText} size={22} />
                </Pressable>
                <Pressable 
                  style={[
                    styles.iconButton, 
                    showDateFilters && styles.iconButtonActive,
                    (startDate || endDate) && { backgroundColor: activeTheme ? 'rgba(255,255,255,0.2)' : '#eff6ff' }
                  ]} 
                  onPress={() => setShowDateFilters(!showDateFilters)}
                >
                  <Filter color={(startDate || endDate) ? '#2563eb' : headerText} size={22} />
                </Pressable>
                <Pressable 
                  style={styles.iconButton} 
                  onPress={() => {
                    const modes: ('default' | 'compact' | 'calendar' | 'year')[] = ['default', 'compact', 'calendar', 'year'];
                    const nextMode = modes[(modes.indexOf(viewMode) + 1) % modes.length];
                    setViewMode(nextMode);
                  }}
                >
                  {viewMode === 'default' && <List color={headerText} size={22} />}
                  {viewMode === 'compact' && <LayoutList color={headerText} size={22} />}
                  {viewMode === 'calendar' && <CalendarDays color={headerText} size={22} />}
                  {viewMode === 'year' && <Grid3X3 color={headerText} size={22} />}
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* Date Range Filters */}
        {showDateFilters && (
          <Animated.View 
            entering={FadeInDown.duration(300)} 
            layout={Layout.springify()}
            style={styles.dateFilterContainer}
          >
            <View style={styles.datePickerRow}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>From</Text>
                <Pressable 
                  style={[styles.dateButton, startDate && styles.dateButtonSelected]} 
                  onPress={() => {
                    setShowStartDatePicker(!showStartDatePicker);
                    setShowEndDatePicker(false);
                  }}
                >
                  <Calendar size={14} color={startDate ? '#2563eb' : '#64748b'} />
                  <Text style={[styles.dateButtonText, startDate && styles.dateButtonTextSelected]}>
                    {startDate ? startDate.toLocaleDateString() : 'Pick date'}
                  </Text>
                  {startDate && (
                    <Pressable onPress={() => setStartDate(null)} hitSlop={10}>
                      <X size={14} color="#94a3b8" />
                    </Pressable>
                  )}
                </Pressable>
              </View>

              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>To</Text>
                <Pressable 
                  style={[styles.dateButton, endDate && styles.dateButtonSelected]} 
                  onPress={() => {
                    setShowEndDatePicker(!showEndDatePicker);
                    setShowStartDatePicker(false);
                  }}
                >
                  <Calendar size={14} color={endDate ? '#2563eb' : '#64748b'} />
                  <Text style={[styles.dateButtonText, endDate && styles.dateButtonTextSelected]}>
                    {endDate ? endDate.toLocaleDateString() : 'Pick date'}
                  </Text>
                  {endDate && (
                    <Pressable onPress={() => setEndDate(null)} hitSlop={10}>
                      <X size={14} color="#94a3b8" />
                    </Pressable>
                  )}
                </Pressable>
              </View>
            </View>

            {(startDate || endDate) && (
              <Pressable 
                style={styles.resetButton} 
                onPress={() => {
                  setStartDate(null);
                  setEndDate(null);
                  setShowStartDatePicker(false);
                  setShowEndDatePicker(false);
                }}
              >
                <Text style={styles.resetButtonText}>Reset Dates</Text>
              </Pressable>
            )}

            {(showStartDatePicker || showEndDatePicker) && Platform.OS === 'android' && (
              <DateTimePicker
                value={showStartDatePicker ? (startDate || new Date()) : (endDate || new Date())}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  if (showStartDatePicker) {
                    setShowStartDatePicker(false);
                    if (event.type === 'set' && date) setStartDate(date);
                  } else {
                    setShowEndDatePicker(false);
                    if (event.type === 'set' && date) setEndDate(date);
                  }
                }}
              />
            )}

            {Platform.OS === 'ios' && (
              <View style={styles.iosDatePickers}>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={startDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(event, date) => date && setStartDate(date)}
                    style={styles.iosDatePicker}
                  />
                )}
                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(event, date) => date && setEndDate(date)}
                    style={styles.iosDatePicker}
                  />
                )}
              </View>
            )}
          </Animated.View>
        )}

        {/* Tag Filters */}
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={TAGS_LIST}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const isActive = activeTags.includes(item.id);
              const Icon = item.icon;
              return (
                <Animated.View entering={FadeIn.delay(index * 50)} layout={Layout.springify()}>
                  <Pressable
                    style={[
                      styles.filterChip,
                      isActive && { backgroundColor: item.primary, borderColor: item.primary },
                    ]}
                    onPress={() => toggleTag(item.id)}
                  >
                    <Icon size={16} color={isActive ? '#fff' : '#64748b'} />
                    <Text style={[styles.filterText, isActive && { color: '#fff' }]}>{item.label}</Text>
                  </Pressable>
                </Animated.View>
              );
            }}
            contentContainerStyle={styles.filterList}
          />
        </View>
      </Animated.View>

      {/* Timeline List */}
      {viewMode === 'compact' ? (
        <CompactView events={sortedEvents} router={router} onRefresh={onRefresh} isRefreshing={isRefreshing} insets={insets} />
      ) : viewMode === 'calendar' ? (
        <CalendarView events={sortedEvents} router={router} onRefresh={onRefresh} isRefreshing={isRefreshing} insets={insets} />
      ) : viewMode === 'year' ? (
        <YearView events={sortedEvents} router={router} onRefresh={onRefresh} isRefreshing={isRefreshing} insets={insets} />
      ) : (
        <FlatList
          data={sortedEvents}
          keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Calendar size={64} color="#cbd5e1" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptySubtitle}>Start documenting your life's journey by adding your first event.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#6366f1']} // Android
            tintColor="#6366f1" // iOS
          />
        }
        renderItem={({ item, index }) => {
          const matchedTagId = activeTags.length > 0 
            ? item.tags.find(t => activeTags.includes(t)) || item.tags[0]
            : item.tags[0];
          const primaryTag = matchedTagId ? TAG_THEMES[matchedTagId] : TAG_THEMES.other;
          const isRange = !!(item.endDate || item.isEndDateUnknown);
          
          const currentYear = item.isDateUnknown ? 'Unknown' : new Date(item.eventDate).getFullYear();
          const prevYear = index > 0 
            ? (sortedEvents[index - 1].isDateUnknown ? 'Unknown' : new Date(sortedEvents[index - 1].eventDate).getFullYear())
            : null;
          const showYearDivider = currentYear !== prevYear;

          return (
            <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
              {showYearDivider && (
                <View style={styles.yearDividerContainer}>
                  <View style={styles.yearDividerLine} />
                  <View style={styles.yearBadge}>
                    <Text style={styles.yearText}>{currentYear}</Text>
                  </View>
                  <View style={styles.yearDividerLine} />
                </View>
              )}
              
              <Pressable
                onPress={() => router.push(`/event/${item.id}`)}
                style={styles.cardContainer}
              >
                {/* Connector Line & Dot — Span bar for range events */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.dot, { backgroundColor: primaryTag.primary }]} />
                  {isRange ? (
                    <View style={[styles.spanBar, { backgroundColor: primaryTag.primary + '30' }]}>
                      <View style={[styles.spanBarInner, { backgroundColor: primaryTag.primary }]} />
                    </View>
                  ) : (
                    <View style={[styles.line, { backgroundColor: primaryTag.cardBorder }]} />
                  )}
                  {isRange && (
                    <View style={[styles.dot, { backgroundColor: primaryTag.primary, marginTop: 0 }]} />
                  )}
                  {!isRange && null}
                </View>
                
                {/* Card */}
                <View style={[
                  styles.card, 
                  { borderColor: primaryTag.cardBorder, backgroundColor: primaryTag.background },
                  isRange && { borderLeftWidth: 3, borderLeftColor: primaryTag.primary }
                ]}>
                  {/* Date display */}
                  {isRange ? (
                    <View style={styles.dateRangeRow}>
                      <Text style={styles.cardDate}>
                        {item.isDateUnknown 
                          ? 'Unknown' 
                          : formatDateRange(item.eventDate, item.endDate, item.isEndDateUnknown)}
                      </Text>
                      <View style={[styles.durationPill, { backgroundColor: primaryTag.primary + '20' }]}>
                        <Text style={[styles.durationPillText, { color: primaryTag.primary }]}>
                          {item.isEndDateUnknown 
                            ? 'Ongoing' 
                            : formatDuration(item.eventDate, item.endDate)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.cardDate}>
                      {item.isDateUnknown 
                        ? 'Unknown Date' 
                        : new Date(item.eventDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {item.isTimeUnknown ? ' • Unknown Time' : (item.eventTime && ` • ${item.eventTime}`)}
                    </Text>
                  )}
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, { color: primaryTag.badgeText }]}>{item.title}</Text>
                    {item.groupId && (
                      <View style={[styles.groupIndicator, { backgroundColor: primaryTag.badgeBackground }]}>
                        <Text style={[styles.groupIndicatorText, { color: primaryTag.primary }]}>
                          #{item.occurrenceIndex}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {item.place && (
                    <View style={styles.placeRow}>
                      <MapPin size={14} color={primaryTag.primary} />
                      <Text style={[styles.cardPlace, { color: primaryTag.primary }]}>{item.place}</Text>
                    </View>
                  )}
                  
                  {((item.localMediaUris && item.localMediaUris.length > 0) || (item.mediaUrls && item.mediaUrls.length > 0)) && (
                    <View style={styles.cardMediaPreview}>
                      <DriveImage 
                        fileId={item.mediaUrls?.[0]} 
                        fallbackUri={item.localMediaUris?.[0]}
                        style={styles.cardThumbnail}
                        contentFit="cover"
                      />
                      {(item.localMediaUris?.length || 0) + (item.mediaUrls?.length || 0) > 1 && (
                        <View style={styles.mediaCountBadge}>
                          <Text style={styles.mediaCountText}>+{(item.localMediaUris?.length || 0) + (item.mediaUrls?.length || 0) - 1}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  <View style={styles.tagsRow}>
                    {item.tags.map(tagId => {
                      const tagInfo = TAG_THEMES[tagId];
                      const TagIcon = tagInfo.icon;
                      return (
                        <View key={tagId} style={[styles.badge, { backgroundColor: tagInfo.badgeBackground }]}>
                          <TagIcon size={12} color={tagInfo.primary} />
                          <Text style={[styles.badgeText, { color: tagInfo.primary }]}>{tagInfo.label}</Text>
                        </View>
                      );
                    })}
                    {item.people?.map((person, idx) => (
                      <View key={`person-${idx}`} style={[styles.badge, { backgroundColor: '#f1f5f9' }]}>
                        <Users size={12} color="#475569" />
                        <Text style={[styles.badgeText, { color: '#475569' }]}>{person}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />
      )}

      {/* FAB */}
      <Pressable 
        style={({pressed}) => [
          styles.fab, 
          { bottom: insets.bottom + 20, transform: [{ scale: pressed ? 0.95 : 1 }] }
        ]} 
        onPress={() => router.push('/event/new')}
      >
        <Plus size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  iconButtonActive: {
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  closeSearchButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  filterContainer: {
    height: 40,
  },
  filterList: {
    paddingHorizontal: 24,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  dateFilterContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dateInputGroup: {
    flex: 1,
    gap: 6,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dateButtonSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  dateButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  dateButtonTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  iosDatePickers: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iosDatePicker: {
    height: 120,
  },
  resetButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    padding: 24,
  },
  cardContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLeft: {
    width: 30,
    alignItems: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 8,
    borderWidth: 3,
    borderColor: '#fff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 8,
    borderRadius: 1,
  },
  spanBar: {
    width: 8,
    flex: 1,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spanBarInner: {
    width: 3,
    height: '100%',
    borderRadius: 2,
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  durationPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  durationPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  card: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginLeft: 10,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  cardPlace: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardMediaPreview: {
    marginTop: 4,
    marginBottom: 12,
    position: 'relative',
    width: '100%',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1f5f9',
  },
  mediaCountBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mediaCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#334155',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },
  yearDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  yearDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  yearBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  yearText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  groupIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  groupIndicatorText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
