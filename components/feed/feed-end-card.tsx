import { Flag } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { CARD_HEIGHT, CARD_WIDTH } from '@/components/feed/card-layout';
import { DARK_SURFACE, ON_DARK_SURFACE, ON_DARK_SURFACE_SECONDARY, RADII, WEIGHT } from '@/constants/style';

// The designed stopping point at the end of all sessions — no infinite
// scroll, no "load more" trick, just an honest "you're caught up."
export function FeedEndCard() {
  return (
    <View style={styles.card}>
      <Flag size={36} color={ON_DARK_SURFACE_SECONDARY} strokeWidth={1.75} />
      <Text style={styles.title}>That's the game.</Text>
      <Text style={styles.subtitle}>You're caught up. Go outside, or start your own session.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 40,
    borderRadius: RADII.lg,
    backgroundColor: DARK_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 30,
  },
  title: { fontSize: 20, fontWeight: WEIGHT.bold, color: ON_DARK_SURFACE, marginTop: 4 },
  subtitle: { fontSize: 14, color: ON_DARK_SURFACE_SECONDARY, textAlign: 'center', lineHeight: 20 },
});
