import { StyleSheet, Text, View } from 'react-native';

import { DARK_SURFACE, ON_DARK_SURFACE, ON_DARK_SURFACE_SECONDARY, RADII, WEIGHT } from '@/constants/style';
import { sessionStatLine, type FeedSession } from '@/lib/feed-sessions';

type Props = {
  session: FeedSession;
};

// Dark block preceding each session cluster — group, relative date, and a
// quick stat line ("3 posts · 46 reactions"). Deliberately theme-independent
// (see DARK_SURFACE) so it reads as a consistent "session break" regardless
// of light/dark mode.
export function SessionHeader({ session }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.groupName} numberOfLines={1}>
        {session.groupEmoji} {session.groupName}
      </Text>
      <Text style={styles.dateLabel}>{session.dateLabel}</Text>
      <Text style={styles.stats}>{sessionStatLine(session)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: DARK_SURFACE,
    borderRadius: RADII.lg,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 20,
    gap: 3,
  },
  groupName: { fontSize: 17, fontWeight: WEIGHT.bold, color: ON_DARK_SURFACE },
  dateLabel: { fontSize: 13, fontWeight: WEIGHT.semibold, color: ON_DARK_SURFACE_SECONDARY },
  stats: { fontSize: 12, color: ON_DARK_SURFACE_SECONDARY, marginTop: 4 },
});
