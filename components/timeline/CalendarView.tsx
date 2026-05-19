import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Platform } from 'react-native';
import { LifeEvent } from '../../types';
import { TAG_THEMES } from '../../constants/themes';
import Animated, { FadeInDown } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, addMonths, subMonths, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

export default function CalendarView({ 
  events, router, onRefresh, isRefreshing, insets 
}: { 
  events: LifeEvent[], router: any, onRefresh: () => void, isRefreshing: boolean, insets: any 
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate))
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // map events by date string YYYY-MM-DD
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, LifeEvent[]>();
    events.forEach(e => {
      if (e.isDateUnknown) return;
      const dateStr = format(new Date(e.eventDate), 'yyyy-MM-dd');
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(e);
    });
    return map;
  }, [events]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <ScrollView 
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
    >
      <View style={styles.calendarCard}>
        <View style={styles.header}>
          <Pressable onPress={prevMonth} style={styles.navButton}>
            <ChevronLeft color="#334155" size={24} />
          </Pressable>
          <Pressable onPress={() => setShowDatePicker(true)}>
            <Text style={styles.monthTitle}>{format(currentDate, 'MMMM yyyy')}</Text>
          </Pressable>
          <Pressable onPress={nextMonth} style={styles.navButton}>
            <ChevronRight color="#334155" size={24} />
          </Pressable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={currentDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowDatePicker(Platform.OS === 'ios'); // On iOS keep it open until handled if inline, but for modal usually it auto closes? Wait, for iOS display="spinner" it doesn't have a built in 'set' button. But display="default" or "compact" might. Let's handle generic way:
              if (Platform.OS === 'android') {
                setShowDatePicker(false);
              }
              if (event.type === 'set' && date) {
                setCurrentDate(date);
              }
            }}
          />
        )}
        
        {Platform.OS === 'ios' && showDatePicker && (
           <Pressable style={styles.closePickerBtn} onPress={() => setShowDatePicker(false)}>
             <Text style={styles.closePickerText}>Done</Text>
           </Pressable>
        )}

        <View style={styles.weekRow}>
          {weekDays.map(day => (
            <Text key={day} style={styles.weekDayText}>{day}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {daysInMonth.map((date, i) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateStr) || [];
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isTodayDate = isToday(date);
            
            return (
              <View key={i} style={styles.dayCell}>
                <View style={[
                  styles.dayNumberContainer, 
                  isTodayDate && styles.todayContainer
                ]}>
                  <Text style={[
                    styles.dayText, 
                    !isCurrentMonth && styles.dayTextDisabled,
                    isTodayDate && styles.todayText
                  ]}>
                    {format(date, 'd')}
                  </Text>
                </View>
                
                {dayEvents.length > 0 && (
                  <View style={styles.dotsRow}>
                    {dayEvents.slice(0, 3).map((e, idx) => {
                      const tagTheme = TAG_THEMES[e.tags[0]] || TAG_THEMES.other;
                      return (
                        <View 
                          key={idx} 
                          style={[styles.eventDot, { backgroundColor: tagTheme.primary }]} 
                        />
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <View style={styles.moreDot} />
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.eventsList}>
        <Text style={styles.listTitle}>Events in {format(currentDate, 'MMMM')}</Text>
        {events
          .filter(e => !e.isDateUnknown && isSameMonth(new Date(e.eventDate), currentDate))
          .map((e, index) => {
            const tagTheme = TAG_THEMES[e.tags[0]] || TAG_THEMES.other;
            return (
              <Animated.View key={e.id} entering={FadeInDown.delay(index * 50).springify()}>
                <Pressable
                  onPress={() => router.push(`/event/${e.id}`)}
                  style={[styles.eventCard, { borderLeftColor: tagTheme.primary }]}
                >
                  <Text style={styles.eventDate}>{format(new Date(e.eventDate), 'MMM d, yyyy')}</Text>
                  <Text style={styles.eventTitle}>{e.title}</Text>
                </Pressable>
              </Animated.View>
            );
          })
        }
        {events.filter(e => !e.isDateUnknown && isSameMonth(new Date(e.eventDate), currentDate)).length === 0 && (
          <Text style={styles.emptyText}>No events this month.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closePickerBtn: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 8,
  },
  closePickerText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  dayNumberContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginBottom: 4,
  },
  todayContainer: {
    backgroundColor: '#6366f1',
  },
  dayText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  dayTextDisabled: {
    color: '#cbd5e1',
  },
  todayText: {
    color: '#fff',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  moreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  eventsList: {
    marginTop: 8,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  eventCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRightColor: '#e2e8f0',
    borderTopColor: '#e2e8f0',
    borderBottomColor: '#e2e8f0',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 12,
  }
});
