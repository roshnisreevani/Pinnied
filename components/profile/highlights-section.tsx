import { useRouter } from 'expo-router';
import { Flame, Plus, Target } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { fetchMyHighlightClips, type HighlightClip } from '@/lib/highlights';

type Props = { userId: string };

export function HighlightsSection({ userId }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [clips, setClips] = useState<HighlightClip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setClips(await fetchMyHighlightClips(userId));
    } catch {
      // quiet fail — highlights are supplementary, not core profile data
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Was a plain useEffect (mount-only) — archiving a clip from its detail
  // screen and navigating back never refetched, so an archived clip kept
  // showing here even though it was correctly removed in the database.
  // useFocusEffect refetches every time Profile comes back into view.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Highlights</Text>
        <AnimatedPressable style={styles.addButton} onPress={() => router.push('/create-highlight')}>
          <Plus size={13} color={colors.text} strokeWidth={2.5} />
          <Text style={styles.addButtonText}>New clip</Text>
        </AnimatedPressable>
      </View>

      {clips.length === 0 ? (
        <AnimatedPressable style={styles.emptyCard} onPress={() => router.push('/create-highlight')}>
          <Text style={styles.emptyTitle}>Post a 15-second clip</Text>
          <Text style={styles.emptyText}>Get roasted, or get real feedback on your level.</Text>
        </AnimatedPressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {clips.map((clip) => (
            <AnimatedPressable
              key={clip.id}
              style={styles.card}
              onPress={() => router.push(`/highlight/${clip.id}`)}>
              <View style={styles.cardIconRow}>
                {clip.mode === 'roast' ? (
                  <Flame size={14} color={colors.coral} strokeWidth={2} />
                ) : (
                  <Target size={14} color={colors.blue} strokeWidth={2} />
                )}
                <Text style={styles.cardMode}>{clip.mode === 'roast' ? 'Roast' : 'Critique'}</Text>
              </View>
              <Text style={styles.cardSport} numberOfLines={1}>
                {clip.sport ?? (clip.status === 'pending' ? 'Analyzing...' : 'Clip')}
              </Text>
              {clip.status === 'pending' ? (
                <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginTop: 4 }} />
              ) : clip.status === 'failed' ? (
                <Text style={styles.cardFailed}>Couldn't process</Text>
              ) : null}
            </AnimatedPressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginTop: 20, gap: 8 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 13, fontWeight: WEIGHT.bold, color: colors.text },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    addButtonText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.text },
    emptyCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: RADII.lg,
      padding: 16,
      gap: 3,
    },
    emptyTitle: { fontSize: 14, fontWeight: WEIGHT.semibold, color: colors.text },
    emptyText: { fontSize: 12, color: colors.textSecondary },
    row: { gap: 8 },
    card: {
      width: 130,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      padding: 10,
      gap: 3,
    },
    cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    cardMode: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.text },
    cardSport: { fontSize: 12, color: colors.textSecondary },
    cardFailed: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  });
}
