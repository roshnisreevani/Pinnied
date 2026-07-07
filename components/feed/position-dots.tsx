import { StyleSheet, Text, View } from 'react-native';

import { ON_ACCENT, WEIGHT } from '@/constants/style';

type Props = {
  count: number;
  activeIndex: number;
};

// Above this, individual dots stop being useful (Feed is now one continuous
// sequence across every post, not a small per-session cluster) — fall back
// to a compact "12 / 340" label instead of cramming in that many dots.
const MAX_DOTS = 10;

// Small progress indicator tracking position within Feed's swipeable
// sequence. Rendered on top of the card (light on a photo/dark background),
// so it intentionally uses fixed light colors rather than the theme palette.
export function PositionDots({ count, activeIndex }: Props) {
  if (count <= 1) return null;

  if (count > MAX_DOTS) {
    return (
      <View pointerEvents="none">
        <Text style={styles.countText}>
          {activeIndex + 1} / {count}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignSelf: 'center' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: ON_ACCENT,
    width: 16,
  },
  countText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: 'rgba(255,255,255,0.85)' },
});
