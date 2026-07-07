import { StyleSheet, Text, View } from 'react-native';

import { ON_ACCENT, RADII, WEIGHT } from '@/constants/style';

type Props = {
  streak: number;
};

// "🔥 on a 5 streak" — shown near the current user's own reactions on posts
// they've reacted to, once their consecutive-fire-reaction streak clears the
// display threshold (see lib/feed-streak.ts).
export function StreakBadge({ streak }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>🔥 on a {streak} streak</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,90,54,0.92)',
    borderRadius: RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontSize: 11, fontWeight: WEIGHT.bold, color: ON_ACCENT },
});
