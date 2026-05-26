import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Calendar, Clock } from 'lucide-react-native';
import { TAG_THEMES } from '../../constants/themes';
import { LifeEvent } from '../../types';
import { formatDuration, formatDateRange } from '../../utils/duration';

function darkenColor(hex: string, amount: number = 50): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

interface ShareCardProps {
  event: LifeEvent;
  imageUri?: string | null;
}

export const ShareCard = React.forwardRef<View, ShareCardProps>(
  ({ event, imageUri }, ref) => {
    const primaryTag = event.tags[0] ? TAG_THEMES[event.tags[0]] : TAG_THEMES.other;
    const EventIcon = primaryTag.icon;
    const isRange = !!(event.endDate || event.isEndDateUnknown);

    const dateText = event.isDateUnknown
      ? 'Unknown Date'
      : isRange
        ? formatDateRange(event.eventDate, event.endDate, event.isEndDateUnknown, true)
        : new Date(event.eventDate).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          });

    const durationText = isRange
      ? event.isEndDateUnknown
        ? `${formatDuration(event.eventDate)} · Ongoing`
        : event.endDate ? formatDuration(event.eventDate, event.endDate) : null
      : null;

    const InfoContent = ({ light }: { light: boolean }) => (
      <View style={s.info}>
        <Text style={[s.title, light && s.white]} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={[s.sep, { backgroundColor: light ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)' }]} />

        <View style={s.row}>
          <Calendar size={14} color={light ? 'rgba(255,255,255,0.75)' : '#64748b'} />
          <Text style={[s.rowText, light && s.white]}>{dateText}</Text>
        </View>

        {durationText && (
          <View style={[s.durationBadge, { backgroundColor: light ? 'rgba(255,255,255,0.15)' : primaryTag.badgeBackground }]}>
            <Text style={[s.durationText, { color: light ? '#fff' : primaryTag.primary }]}>
              {durationText}
            </Text>
          </View>
        )}

        {event.eventTime && !event.isTimeUnknown && (
          <View style={s.row}>
            <Clock size={14} color={light ? 'rgba(255,255,255,0.75)' : '#64748b'} />
            <Text style={[s.rowText, light && s.white]}>{event.eventTime}</Text>
          </View>
        )}

        {event.place ? (
          <View style={s.row}>
            <MapPin size={14} color={light ? 'rgba(255,255,255,0.75)' : '#64748b'} />
            <Text style={[s.rowText, light && s.white]}>{event.place}</Text>
          </View>
        ) : null}

        {event.description ? (
          <Text style={[s.desc, light && { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={4}>
            {event.description}
          </Text>
        ) : null}

        <View style={s.tags}>
          {event.tags.slice(0, 3).map(tagId => {
            const tag = TAG_THEMES[tagId];
            return (
              <View
                key={tagId}
                style={[
                  s.tagChip,
                  { backgroundColor: light ? 'rgba(255,255,255,0.18)' : tag.badgeBackground },
                ]}
              >
                <Text style={[s.tagLabel, { color: light ? '#fff' : tag.primary }]}>
                  {tag.label}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={[s.brand, light && { color: 'rgba(255,255,255,0.4)' }]}>
          timeliney
        </Text>
      </View>
    );

    if (imageUri) {
      return (
        <View ref={ref} style={s.card} collapsable={false}>
          <Image source={{ uri: imageUri }} style={s.hero} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.3, 0.75]}
            style={s.overlay}
          >
            <InfoContent light />
          </LinearGradient>
        </View>
      );
    }

    return (
      <View ref={ref} style={s.card} collapsable={false}>
        <LinearGradient
          colors={[primaryTag.primary, darkenColor(primaryTag.primary, 60)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.gradientCard}
        >
          <View style={s.iconCircle}>
            <EventIcon size={36} color="#fff" strokeWidth={2} />
          </View>
          <InfoContent light />
        </LinearGradient>
      </View>
    );
  }
);

ShareCard.displayName = 'ShareCard';

const s = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  // Photo variant
  hero: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    minHeight: 420,
    justifyContent: 'flex-end',
  },
  // Gradient variant (no photo)
  gradientCard: {
    minHeight: 380,
    justifyContent: 'flex-end',
    paddingTop: 40,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 24,
    marginBottom: 16,
  },
  // Shared content
  info: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  white: { color: '#fff' },
  sep: {
    height: 2,
    width: 40,
    borderRadius: 1,
    marginVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  rowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  durationBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  desc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
    marginTop: 10,
    fontStyle: 'italic',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(0,0,0,0.15)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 20,
  },
});
