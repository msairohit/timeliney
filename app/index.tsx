import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Dimensions, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Calendar, Clock, Image as ImageIcon, MapPin, TrendingUp, Heart, Star, Layout, User as UserIcon, History, Bell, CalendarClock } from 'lucide-react-native';
import { useEventStore } from '../store/eventStore';
import { useAuthStore } from '../store/authStore';
import Animated, { FadeInDown, FadeInRight, FadeInLeft } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import DriveImage from '../components/ui/DriveImage';
import { LifeEvent } from '../types';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const events = useEventStore((state) => state.events);
  const isSyncing = useEventStore((state) => state.isSyncing);
  const user = useAuthStore((state) => state.user);

  const recentEvents = [...events]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 3);

  const stats = [
    { label: 'Moments', value: new Set(events.map(e => e.groupId || e.id)).size, icon: Calendar, color: '#6366f1' },
    { label: 'Places', value: new Set(events.map(e => e.place).filter(Boolean)).size, icon: MapPin, color: '#f59e0b' },
    { label: 'Media', value: events.reduce((acc, e) => acc + (e.mediaUrls?.length || 0) + (e.localMediaUris?.length || 0) + (e.documentUrls?.length || 0) + (e.localDocumentUris?.length || 0), 0), icon: ImageIcon, color: '#ec4899' },
  ];

  const insights = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();

    const parseEventDateTime = (dateStr: string, timeStr?: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      if (timeStr) {
        const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3];
          
          if (ampm) {
            if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
            if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
          }
          date.setHours(hours, minutes, 0, 0);
        }
      } else {
        date.setHours(23, 59, 59, 999);
      }
      return date;
    };

    const onThisDay = events.filter(event => {
      const [year, month, day] = event.eventDate.split('-').map(Number);
      return (month - 1) === todayMonth && 
             day === todayDay &&
             year < today.getFullYear();
    }).map(e => ({
      ...e,
      yearsAgo: today.getFullYear() - new Date(e.eventDate).getFullYear(),
      insightType: 'memory' as const
    }));

    const upcoming = events.filter(event => {
      const eDate = parseEventDateTime(event.eventDate, event.eventTime);
      const now = new Date();
      
      const [year, month, day] = event.eventDate.split('-').map(Number);
      const isPastEvent = year < today.getFullYear();

      // Future event logic
      if (eDate >= now) {
        const diffTime = eDate.getTime() - today.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 14;
      }

      // Anniversary logic (for past events)
      if (isPastEvent) {
        const anniversaryDate = new Date(today.getFullYear(), month - 1, day);
        // If the anniversary this year has already passed, check next year (though we only care about next 14 days)
        const diffTime = anniversaryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 14; // Tomorrow onwards for anniversaries
      }

      return false;
    }).map(e => {
      const [year, month, day] = e.eventDate.split('-').map(Number);
      const anniversaryDate = new Date(today.getFullYear(), month - 1, day);
      const isAnniversary = year < today.getFullYear();
      
      const targetDate = isAnniversary ? anniversaryDate : parseEventDateTime(e.eventDate);
      targetDate.setHours(0, 0, 0, 0);
      
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...e,
        daysTo: diffDays,
        yearsAgo: isAnniversary ? today.getFullYear() - year : undefined,
        insightType: 'upcoming' as const
      };
    }).sort((a, b) => (a.daysTo || 0) - (b.daysTo || 0));

    const flashback = events.length > 0 
      ? [events[Math.floor(Math.random() * events.length)]].map(e => ({
          ...e,
          insightType: 'flashback' as const
        }))
      : [];

    const milestones = events
      .filter(e => e.tags?.includes('milestone'))
      .sort((a, b) => {
        const aDate = new Date(a.eventDate);
        const bDate = new Date(b.eventDate);
        const now = new Date();
        
        // Prioritize future milestones (closest first)
        const aFuture = aDate >= now;
        const bFuture = bDate >= now;
        
        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;
        
        if (aFuture && bFuture) return aDate.getTime() - bDate.getTime();
        // If both past, latest first
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 1)
      .map(e => ({
        ...e,
        insightType: 'milestone' as const
      }));

    return [...onThisDay, ...upcoming, ...flashback, ...milestones] as (LifeEvent & { 
      insightType: 'memory' | 'upcoming' | 'flashback' | 'milestone';
      yearsAgo?: number;
      daysTo?: number;
    })[];
  }, [events]);

  const lifeSummary = React.useMemo(() => {
    if (events.length === 0) return null;
    
    const eventYears = events.map(e => new Date(e.eventDate).getFullYear());
    const span = Math.max(...eventYears) - Math.min(...eventYears) + 1;
    
    const tagCounts = events.reduce((acc, e) => {
      e.tags?.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    
    const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    
    return {
      span,
      topTag: topTag ? topTag.charAt(0).toUpperCase() + topTag.slice(1) : 'None',
      totalEvents: new Set(events.map(e => e.groupId || e.id)).size
    };
  }, [events]);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#4f46e5', '#818cf8']}
        style={[styles.header, { paddingTop: insets.top + 40 }]}
      >
        <View style={styles.headerTop}>
          <Animated.View entering={FadeInDown.duration(800)} style={{ flex: 1 }}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.displayName || user?.username || 'Adventurer'}</Text>
          </Animated.View>
          
          <Animated.View entering={FadeInDown.duration(800).delay(200)}>
            <Pressable 
              onPress={() => router.push('/profile')}
              style={styles.profileImageContainer}
            >
              {user?.photo ? (
                <Image source={{ uri: user.photo }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileImageFallback}>
                  <UserIcon size={24} color="#4f46e5" />
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>

        {isSyncing && (
          <Animated.View 
            entering={FadeInDown}
            style={styles.syncIndicator}
          >
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.syncText}>Syncing with Drive...</Text>
          </Animated.View>
        )}
        
        <Pressable 
          onPress={() => router.push('/statistics' as any)}
          style={styles.headerStats}
        >
          {stats.map((stat, index) => (
            <Animated.View 
              key={stat.label} 
              entering={FadeInDown.delay(200 + index * 100).duration(800)}
              style={styles.headerStatItem}
            >
              <stat.icon size={20} color="rgba(255,255,255,0.8)" />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Animated.View>
          ))}
        </Pressable>
      </LinearGradient>

      <View style={styles.content}>
        {/* Insights Section */}
        {insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Story Highlights</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.insightsScroll}
            >
              {insights.map((insight, index) => (
                <Animated.View 
                  key={`${insight.insightType}-${insight.id}`}
                  entering={FadeInRight.delay(200 + index * 100)}
                >
                  <Pressable 
                    style={styles.insightCard}
                    onPress={() => router.push(`/event/${insight.id}`)}
                  >
                    <LinearGradient
                      colors={
                        insight.insightType === 'memory' ? ['#6366f1', '#4f46e5'] : 
                        insight.insightType === 'upcoming' ? ['#f59e0b', '#d97706'] :
                        insight.insightType === 'flashback' ? ['#ec4899', '#be185d'] :
                        ['#10b981', '#059669']
                      }
                      style={styles.insightGradient}
                    >
                      {(insight.mediaUrls?.[0] || insight.localMediaUris?.[0]) && (
                        <View style={styles.insightImageContainer}>
                          <DriveImage 
                            fileId={insight.mediaUrls?.[0]} 
                            fallbackUri={insight.localMediaUris?.[0]}
                            style={styles.insightImage}
                          />
                          <View style={styles.insightImageOverlay} />
                        </View>
                      )}
                      
                      <View style={styles.insightContent}>
                        <View style={styles.insightHeader}>
                          {insight.insightType === 'memory' ? (
                            <History size={16} color="#fff" />
                          ) : insight.insightType === 'upcoming' ? (
                            <Bell size={16} color="#fff" />
                          ) : insight.insightType === 'flashback' ? (
                            <Star size={16} color="#fff" />
                          ) : (
                            <TrendingUp size={16} color="#fff" />
                          )}
                          <Text style={styles.insightLabel}>
                            {insight.insightType === 'memory' ? 'ON THIS DAY' : 
                             insight.insightType === 'upcoming' ? 'COMING UP' :
                             insight.insightType === 'flashback' ? 'RANDOM RECALL' : 
                             new Date(insight.eventDate) >= new Date() ? 'UPCOMING MILESTONE' : 'RECENT MILESTONE'}
                          </Text>
                        </View>
                        
                        <Text style={styles.insightTitle} numberOfLines={2}>
                          {insight.title}
                        </Text>
                        
                        <View style={styles.insightFooter}>
                          <Text style={styles.insightValue}>
                            {insight.insightType === 'memory' 
                              ? `${insight.yearsAgo} year${insight.yearsAgo === 1 ? '' : 's'} ago`
                              : insight.insightType === 'upcoming'
                              ? insight.yearsAgo 
                                ? `${insight.yearsAgo} year${insight.yearsAgo === 1 ? '' : 's'} ago ${insight.daysTo === 1 ? 'tomorrow' : `in ${insight.daysTo} days`}`
                                : insight.daysTo === 0 ? 'Today' : insight.daysTo === 1 ? 'Tomorrow' : `In ${insight.daysTo} days`
                              : insight.insightType === 'flashback'
                              ? 'From your story'
                              : new Date(insight.eventDate) >= new Date() ? 'Next big thing' : 'Recent milestone'
                            }
                          </Text>
                          <CalendarClock size={14} color="rgba(255,255,255,0.7)" />
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <Pressable 
              style={styles.actionCard}
              onPress={() => router.push('/event/new')}
            >
              <LinearGradient colors={['#eff6ff', '#dbeafe']} style={styles.actionIconBg}>
                <Plus color="#2563eb" size={24} />
              </LinearGradient>
              <Text style={styles.actionLabel}>Add Event</Text>
            </Pressable>
            
            <Pressable 
              style={styles.actionCard}
              onPress={() => router.push('/timeline')}
            >
              <LinearGradient colors={['#fef2f2', '#fee2e2']} style={styles.actionIconBg}>
                <Layout color="#dc2626" size={24} />
              </LinearGradient>
              <Text style={styles.actionLabel}>Timeline</Text>
            </Pressable>

            <Pressable 
              style={styles.actionCard}
              onPress={() => router.push('/profile')}
            >
              <LinearGradient colors={['#f0fdf4', '#dcfce7']} style={styles.actionIconBg}>
                <Star color="#16a34a" size={24} />
              </LinearGradient>
              <Text style={styles.actionLabel}>Profile</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Recent Memories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Memories</Text>
            <Pressable onPress={() => router.push('/timeline')}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>

          {recentEvents.length === 0 ? (
            <View style={styles.emptyRecent}>
              <Clock size={40} color="#cbd5e1" />
              <Text style={styles.emptyRecentText}>No recent events yet</Text>
            </View>
          ) : (
            recentEvents.map((event, index) => (
              <Animated.View 
                key={event.id} 
                entering={FadeInRight.delay(700 + index * 100)}
              >
                <Pressable 
                  style={styles.recentCard}
                  onPress={() => router.push(`/event/${event.id}`)}
                >
                  <DriveImage 
                    fileId={event.mediaUrls?.[0]} 
                    fallbackUri={event.localMediaUris?.[0]}
                    style={styles.recentImage}
                  />
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.recentDate}>
                      {new Date(event.eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    {event.place && (
                      <View style={styles.recentPlace}>
                        <MapPin size={12} color="#64748b" />
                        <Text style={styles.recentPlaceText} numberOfLines={1}>{event.place}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ))
          )}
        </View>

        {/* Life Progress Placeholder/Motivation */}
        {lifeSummary && (
          <Animated.View entering={FadeInDown.delay(1000)} style={styles.motivationCard}>
            <LinearGradient
              colors={['#1e293b', '#334155']}
              style={styles.motivationGradient}
            >
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{lifeSummary.span}</Text>
                  <Text style={styles.summaryLabel}>Years</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{lifeSummary.topTag}</Text>
                  <Text style={styles.summaryLabel}>Focus</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{lifeSummary.totalEvents}</Text>
                  <Text style={styles.summaryLabel}>Moments</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(1200)} style={styles.motivationCard}>
          <LinearGradient
            colors={['#4f46e5', '#6366f1']}
            style={styles.motivationGradient}
          >
            <TrendingUp color="#fff" size={32} />
            <View style={styles.motivationContent}>
              <Text style={styles.motivationTitle}>Keep Documenting</Text>
              <Text style={styles.motivationSubtitle}>Every moment matters in the story of your life.</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    position: 'relative',
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  syncText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  userName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStats: {
    flexDirection: 'row',
    marginTop: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
  },
  headerStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontWeight: '600',
  },
  content: {
    padding: 24,
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
    color: '#1e293b',
    marginBottom: 16,
  },
  viewAllText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: (width - 48 - 32) / 3,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  actionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  recentCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  recentImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  recentInfo: {
    flex: 1,
    marginLeft: 16,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  recentDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  recentPlace: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  recentPlaceText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyRecent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  emptyRecentText: {
    marginTop: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  motivationCard: {
    marginTop: 8,
    borderRadius: 24,
    overflow: 'hidden',
  },
  motivationGradient: {
    flexDirection: 'row',
    padding: 24,
    alignItems: 'center',
  },
  motivationContent: {
    marginLeft: 20,
    flex: 1,
  },
  motivationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  motivationSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    lineHeight: 20,
  },
  insightsScroll: {
    paddingRight: 24,
    gap: 16,
  },
  insightCard: {
    width: 200,
    height: 140,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  insightGradient: {
    flex: 1,
  },
  insightImageContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  insightImage: {
    width: '100%',
    height: '100%',
  },
  insightImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  insightContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  insightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flex: 1,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
