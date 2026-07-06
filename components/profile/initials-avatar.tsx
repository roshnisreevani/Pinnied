import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/contexts/theme-context';
import { WEIGHT } from '@/constants/style';

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Props = {
  name: string;
  size?: number;
};

export function InitialsAvatar({ name, size = 76 }: Props) {
  const colors = useThemeColors();
  const initials = initialsForName(name);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.text },
      ]}>
      <Text style={[styles.text, { fontSize: size * 0.34, color: colors.background }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: WEIGHT.bold },
});
