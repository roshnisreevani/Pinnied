import { useRouter } from 'expo-router';
import { Flag, Pencil, Users } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CARD_WIDTH } from '@/components/feed/card-layout';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';

// The designed stopping point at the end of all sessions — no infinite
// scroll, no "load more" trick, just an honest "you're caught up" with
// somewhere useful to go next.
export function FeedEndCard() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Flag size={26} color={colors.textSecondary} strokeWidth={1.5} />
      <Text style={styles.title}>Caught up for now</Text>
      <Text style={styles.subtitle}>Start a session, post a recap, or check your groups.</Text>

      <View style={styles.actions}>
        <AnimatedPressable style={styles.actionButton} onPress={() => router.push('/create-post')}>
          <Pencil size={15} color={colors.text} strokeWidth={1.75} />
          <Text style={styles.actionButtonText}>Create Post</Text>
        </AnimatedPressable>
        <AnimatedPressable style={styles.actionButton} onPress={() => router.push('/(tabs)/groups')}>
          <Users size={15} color={colors.text} strokeWidth={1.75} />
          <Text style={styles.actionButtonText}>Browse Groups</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // Compact rectangle, unlike the tall CARD_HEIGHT post cards — width
    // capped and no fixed height, so it hugs its content.
    card: {
      width: CARD_WIDTH,
      maxWidth: 420,
      alignSelf: 'center',
      marginTop: 20,
      marginBottom: 40,
      borderRadius: RADII.lg,
      backgroundColor: colors.borderSoft,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    title: { fontSize: 18, fontWeight: WEIGHT.bold, color: colors.text, marginTop: 2 },
    subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
    // flexWrap lets the two pills sit side by side where they fit and stack
    // vertically on narrow screens instead of squishing.
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
      marginTop: 10,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    actionButtonText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.text },
  });
}
