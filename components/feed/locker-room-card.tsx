import { StyleSheet, Text, View } from 'react-native';

import { CARD_HEIGHT, CARD_WIDTH } from '@/components/feed/card-layout';
import { DARK_SURFACE, ON_DARK_SURFACE, ON_DARK_SURFACE_SECONDARY, RADII, WEIGHT } from '@/constants/style';
import type { FeedSession } from '@/lib/feed-sessions';

type Props = {
  nextSession: FeedSession;
};

// A single dark full-card transition shown between two session clusters —
// "UP NEXT", the following session's group + date, then a small accent
// line before the next session's cards begin.
export function LockerRoomCard({ nextSession }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.upNext}>UP NEXT</Text>
      <Text style={styles.groupName} numberOfLines={2}>
        {nextSession.groupEmoji} {nextSession.groupName}
      </Text>
      <Text style={styles.dateLabel}>{nextSession.dateLabel}</Text>
      <View style={styles.accentLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    marginTop: 20,
    borderRadius: RADII.lg,
    backgroundColor: DARK_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  upNext: {
    fontSize: 12,
    fontWeight: WEIGHT.bold,
    color: ON_DARK_SURFACE_SECONDARY,
    letterSpacing: 3,
  },
  groupName: {
    fontSize: 24,
    fontWeight: WEIGHT.bold,
    color: ON_DARK_SURFACE,
    textAlign: 'center',
    marginTop: 6,
  },
  dateLabel: { fontSize: 14, color: ON_DARK_SURFACE_SECONDARY },
  accentLine: {
    marginTop: 16,
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF5A36',
  },
});
