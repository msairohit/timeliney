import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { LifeEvent } from '../../types';
import { TAG_THEMES } from '../../constants/themes';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatDateRange } from '../../utils/duration';

export default function CompactView({ 
  events, router, onRefresh, isRefreshing, insets 
}: { 
  events: LifeEvent[], router: any, onRefresh: () => void, isRefreshing: boolean, insets: any 
}) {
  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      renderItem={({ item, index }) => {
        const primaryTag = TAG_THEMES[item.tags[0]] || TAG_THEMES.other;
        const isRange = !!(item.endDate || item.isEndDateUnknown);
        
        return (
          <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            <Pressable
              onPress={() => router.push(`/event/${item.id}`)}
              style={[styles.card, { borderLeftColor: primaryTag.primary }]}
            >
              <View style={styles.leftCol}>
                <Text style={styles.date} numberOfLines={1}>
                  {isRange 
                    ? formatDateRange(item.eventDate, item.endDate, item.isEndDateUnknown)
                    : (item.isDateUnknown ? 'Unknown Date' : new Date(item.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
                  }
                </Text>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              </View>
              {item.place && (
                <Text style={styles.place} numberOfLines={1}>{item.place}</Text>
              )}
            </Pressable>
          </Animated.View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderRightColor: '#e2e8f0',
    borderTopColor: '#e2e8f0',
    borderBottomColor: '#e2e8f0',
  },
  leftCol: {
    flex: 1,
    marginRight: 12,
  },
  date: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  place: {
    fontSize: 12,
    color: '#64748b',
    maxWidth: 100,
  }
});
