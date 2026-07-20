import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { HOT_THRESHOLD } from '@/lib/reactions';

type Props = {
  fireCount: number;
};

/**
 * Live meter driven solely by 🔥 reaction count against HOT_THRESHOLD —
 * replaces the old static "🔥 HOT" text badge, which was decorative (tied
 * to *total* reactions of any type, not the emoji it displayed). Renders
 * nothing at 0 fires so it doesn't clutter posts nobody's reacted to yet.
 */
export function HeatMeter({ fireCount }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const pct = Math.min(100, Math.round((fireCount / HOT_THRESHOLD) * 100));
  const width = useSharedValue(pct);

  useEffect(() => {
    width.value = withTiming(pct, { duration: 350 });
  }, [pct, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  if (fireCount === 0) return null;

  const label = pct >= 100 ? 'HOT' : pct >= 70 ? 'heating up' : 'warming up';

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.heatLabel}>heat</Text>
        <Text style={[styles.stateLabel, pct >= 100 && styles.stateLabelHot]}>{label}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, pct >= 100 && styles.fillHot, fillStyle]} />
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: 4, marginTop: 6 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    heatLabel: { fontSize: 10, color: colors.textSecondary },
    stateLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: WEIGHT.semibold },
    stateLabelHot: { color: colors.coral },
    track: { height: 5, borderRadius: RADII.pill, backgroundColor: colors.borderSoft, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: RADII.pill, backgroundColor: colors.coral },
    fillHot: { backgroundColor: colors.danger },
  });
}
