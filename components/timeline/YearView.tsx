import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { LifeEvent } from '../../types';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function YearView({ 
  events, onRefresh, isRefreshing, insets 
}: { 
  events: LifeEvent[], router: any, onRefresh: () => void, isRefreshing: boolean, insets: any 
}) {
  // Group by year
  const years = React.useMemo(() => {
    const map = new Map<number, LifeEvent[]>();
    events.forEach(e => {
      if (e.isDateUnknown) return;
      const year = new Date(e.eventDate).getFullYear();
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]); // Descending
  }, [events]);

  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  return (
    <ScrollView 
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
    >
      {years.map(([year, yearEvents], index) => {
        // Count events per month
        const monthCounts = new Array(12).fill(0);
        yearEvents.forEach(e => {
          const m = new Date(e.eventDate).getMonth();
          monthCounts[m]++;
        });
        
        const maxCount = Math.max(...monthCounts, 1);
        
        return (
          <Animated.View key={year} entering={FadeInDown.delay(index * 100).springify()} style={styles.yearCard}>
            <Text style={styles.yearTitle}>{year}</Text>
            <View style={styles.heatmapRow}>
              {monthCounts.map((count, mIndex) => {
                const intensity = count === 0 ? 0 : Math.max(0.3, count / maxCount);
                return (
                  <View key={mIndex} style={styles.monthCol}>
                    <View 
                      style={[
                        styles.heatBox, 
                        { 
                          backgroundColor: count > 0 ? `rgba(99, 102, 241, ${intensity})` : '#f1f5f9',
                          borderColor: count > 0 ? 'rgba(99, 102, 241, 0.1)' : '#e2e8f0'
                        }
                      ]} 
                    />
                    <Text style={styles.monthLabel}>{months[mIndex]}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.yearSummary}>{yearEvents.length} event{yearEvents.length !== 1 ? 's' : ''}</Text>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
  yearCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  yearTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  heatmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthCol: {
    alignItems: 'center',
    width: `${100 / 12}%`,
  },
  heatBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  monthLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  yearSummary: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'right',
  }
});
