import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';

export type ContentTabKey = 'pickThree' | 'walkupSong';

type Props = {
  active: ContentTabKey;
  onChange: (key: ContentTabKey) => void;
};

const TABS: { key: ContentTabKey; label: string }[] = [
  { key: 'pickThree', label: 'Pick Your 3' },
  { key: 'walkupSong', label: 'Walk-up Song' },
];

export function ContentTabs({ active, onChange }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <AnimatedPressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 8 },
    label: { fontSize: 14, fontWeight: WEIGHT.medium, color: colors.textSecondary },
    labelActive: { color: colors.text, fontWeight: WEIGHT.bold },
    indicator: { height: 2.5, width: '60%', borderRadius: RADII.pill, backgroundColor: 'transparent' },
    indicatorActive: { backgroundColor: colors.coral },
  });
}
