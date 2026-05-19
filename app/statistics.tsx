import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, PieChart, BarChart3, MapPin, CalendarRange } from 'lucide-react-native';
import { useEventStore } from '../store/eventStore';
import { TAG_THEMES } from '../constants/themes';
import { TagId } from '../types';
import { PieChart as RNPieChart } from 'react-native-chart-kit';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Custom Bar Chart Component for rich aesthetics and type safety
interface CustomBarChartProps {
  labels: string[];
  data: number[];
  onPress: (label: string) => void;
}

const CustomBarChart = ({ labels, data, onPress }: CustomBarChartProps) => {
  const maxVal = Math.max(...data, 1);

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.chartArea}>
        {data.map((val, index) => {
          const label = labels[index];
          const barHeightPercent = (val / maxVal) * 100;
          
          return (
            <Pressable
              key={label}
              style={chartStyles.column}
              onPress={() => onPress(label)}
            >
              <View style={chartStyles.barContainer}>
                <Text style={chartStyles.valueText}>{val}</Text>
                <View style={chartStyles.barWrapper}>
                  <View style={[chartStyles.bar, { height: `${barHeightPercent}%` }]}>
                    <LinearGradient
                      colors={['#818cf8', '#4f46e5']}
                      style={StyleSheet.absoluteFillObject}
                    />
                  </View>
                </View>
              </View>
              <Text style={chartStyles.labelText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const events = useEventStore((state) => state.events);

  const {
    eventsPerYear,
    tagDistribution,
    topPlaces,
    longestEvent,
    summaryStats,
  } = useMemo(() => {
    // 1. Events per year
    const yearCounts: Record<string, number> = {};
    // 2. Most-used tags
    const tagCounts: Record<string, number> = {};
    // 3. Events by location
    const placeCounts: Record<string, number> = {};
    // 4. Longest date-range event
    let longest = { id: '', title: '', days: 0 };
    
    let firstEventDate = new Date();
    let lastEventDate = new Date(0);

    events.forEach(event => {
      // Year
      if (!event.isDateUnknown) {
        const year = new Date(event.eventDate).getFullYear().toString();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
        
        const eDate = new Date(event.eventDate);
        if (eDate < firstEventDate) firstEventDate = eDate;
        if (eDate > lastEventDate) lastEventDate = eDate;
      }

      // Tags
      event.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      // Place
      if (event.place) {
        placeCounts[event.place] = (placeCounts[event.place] || 0) + 1;
      }

      // Date Range
      if (event.endDate && !event.isEndDateUnknown) {
        const start = new Date(event.eventDate);
        const end = new Date(event.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (days > longest.days) {
          longest = { id: event.id, title: event.title, days };
        }
      }
    });

    const sortedYears = Object.keys(yearCounts).sort();
    const barData = {
      labels: sortedYears.slice(-5), // last 5 years
      data: sortedYears.slice(-5).map(y => yearCounts[y]),
    };

    const pieData = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => {
        const theme = TAG_THEMES[tag as TagId] || TAG_THEMES.other;
        return {
          name: theme.label,
          population: count,
          color: theme.primary,
          legendFontColor: '#475569',
          legendFontSize: 12,
          tagId: tag
        };
      });

    const topPlacesList = Object.entries(placeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const timeSpanYears = events.length > 0 
      ? Math.max(1, lastEventDate.getFullYear() - firstEventDate.getFullYear() + 1)
      : 0;

    return {
      eventsPerYear: barData,
      tagDistribution: pieData,
      topPlaces: topPlacesList,
      longestEvent: longest.days > 0 ? longest : null,
      summaryStats: {
        totalEvents: events.length,
        totalPlaces: Object.keys(placeCounts).length,
        timeSpanYears,
      }
    };
  }, [events]);

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
  };

  const navigateToTimeline = (params: Record<string, string>) => {
    // using search params for drill down
    router.push({ pathname: '/timeline' as any, params });
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#0f172a" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Life Statistics</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        
        {/* Summary */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.summaryGrid}>
          <LinearGradient colors={['#4f46e5', '#818cf8']} style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summaryStats.totalEvents}</Text>
            <Text style={styles.summaryLabel}>Total Events</Text>
          </LinearGradient>
          <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summaryStats.totalPlaces}</Text>
            <Text style={styles.summaryLabel}>Places Visited</Text>
          </LinearGradient>
          <LinearGradient colors={['#ec4899', '#f472b6']} style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summaryStats.timeSpanYears}</Text>
            <Text style={styles.summaryLabel}>Years Span</Text>
          </LinearGradient>
        </Animated.View>

        {/* Events per Year */}
        {eventsPerYear.labels.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <BarChart3 size={20} color="#6366f1" />
              <Text style={styles.sectionTitle}>Events per Year</Text>
            </View>
            <CustomBarChart
              labels={eventsPerYear.labels}
              data={eventsPerYear.data}
              onPress={(year) => navigateToTimeline({ year })}
            />
            <Text style={styles.hintText}>Tap a bar to see events from that year</Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <BarChart3 size={20} color="#6366f1" />
              <Text style={styles.sectionTitle}>Events per Year</Text>
            </View>
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Add events with dates to see statistics</Text>
            </View>
          </Animated.View>
        )}

        {/* Top Tags */}
        {tagDistribution.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <PieChart size={20} color="#ec4899" />
              <Text style={styles.sectionTitle}>Most Used Tags</Text>
            </View>
            <View style={styles.chartContainer}>
              <RNPieChart
                data={tagDistribution}
                width={width - 48}
                height={200}
                chartConfig={chartConfig}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
              />
            </View>
            <View style={styles.tagList}>
              {tagDistribution.map((t) => (
                <Pressable 
                  key={t.name}
                  style={[styles.tagRow, { borderLeftColor: t.color }]}
                  onPress={() => navigateToTimeline({ tag: t.tagId })}
                >
                  <Text style={styles.tagRowName}>{t.name}</Text>
                  <Text style={styles.tagRowCount}>{t.population} {t.population === 1 ? 'event' : 'events'}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Top Places */}
        {topPlaces.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={20} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Top Locations</Text>
            </View>
            <View style={styles.placesList}>
              {topPlaces.map(([place, count], index) => (
                <Pressable 
                  key={place} 
                  style={styles.placeItem}
                  onPress={() => navigateToTimeline({ search: place })}
                >
                  <View style={styles.placeIndex}>
                    <Text style={styles.placeIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.placeName} numberOfLines={1}>{place}</Text>
                  <Text style={styles.placeCount}>{count} {count === 1 ? 'event' : 'events'}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Longest Event */}
        {longestEvent && (
          <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <CalendarRange size={20} color="#10b981" />
              <Text style={styles.sectionTitle}>Longest Event</Text>
            </View>
            <Pressable 
              style={styles.longestCard}
              onPress={() => router.push(`/event/${longestEvent.id}` as any)}
            >
              <View style={styles.longestIcon}>
                <CalendarRange color="#10b981" size={24} />
              </View>
              <View style={styles.longestInfo}>
                <Text style={styles.longestTitle}>{longestEvent.title}</Text>
                <Text style={styles.longestDuration}>{longestEvent.days} days duration</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  content: {
    padding: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  hintText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  tagList: {
    marginTop: 16,
    gap: 8,
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  tagRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  tagRowCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  placesList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  placeIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  placeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  placeCount: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  longestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  longestIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  longestInfo: {
    flex: 1,
  },
  longestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  longestDuration: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
});

const chartStyles = StyleSheet.create({
  container: {
    height: 220,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  chartArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  barWrapper: {
    height: '80%',
    width: 24,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 8,
  },
});
