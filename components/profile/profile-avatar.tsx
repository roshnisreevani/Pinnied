import { Camera } from 'lucide-react-native';
import { Image, StyleSheet, View } from 'react-native';

import { InitialsAvatar } from '@/components/profile/initials-avatar';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { useThemeColors } from '@/contexts/theme-context';

type Props = {
  name: string;
  photoUri: string | null;
  size?: number;
  editable?: boolean;
  onPress?: () => void;
};

const RING_WIDTH = 3;
const RING_GAP = 3;

export function ProfileAvatar({ name, photoUri, size = 76, editable, onPress }: Props) {
  const colors = useThemeColors();

  const content = photoUri ? (
    <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <InitialsAvatar name={name} size={size} />
  );

  const ringSize = size + (RING_WIDTH + RING_GAP) * 2;

  const avatar = (
    <View
      style={[
        styles.ring,
        { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colors.coral },
      ]}>
      {content}
    </View>
  );

  if (!editable) return avatar;

  return (
    <AnimatedPressable onPress={onPress} hitSlop={6}>
      {avatar}
      <View style={[styles.badge, { backgroundColor: colors.text, borderColor: colors.background }]}>
        <Camera size={13} color={colors.background} strokeWidth={2} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: RING_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
