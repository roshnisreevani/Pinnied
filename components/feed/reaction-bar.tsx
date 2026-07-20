import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { fetchReactionUsers } from '@/lib/posts';
import { EMOJI_BANK, PINNED_REACTIONS, type ReactionType } from '@/lib/reactions';

// The "+" grid only needs the emoji NOT already pinned in the scoreboard —
// showing all 10 there too would just duplicate the always-visible trio.
const OVERFLOW_EMOJI = EMOJI_BANK.filter((e) => !PINNED_REACTIONS.includes(e));

type Props = {
  postId: string;
  counts: Record<string, number>;
  active: ReactionType[];
  onToggle: (type: ReactionType) => void;
};

/**
 * Scoreboard-style reaction tally — "🔥 12 — 👑 3 — 😮 1" — instead of a
 * dynamic pill row that reflowed based on whichever reactions happened to
 * be most popular. The 3 PINNED_REACTIONS are always visible in the same
 * order and always tappable; anything else in EMOJI_BANK is one tap behind
 * the "+" button. Leans into the sports framing instead of hiding reaction
 * counts behind a generic "like" pattern.
 */
export function ReactionBar({ postId, counts, active, onToggle }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactorsFor, setReactorsFor] = useState<string | null>(null);
  const [reactorNames, setReactorNames] = useState<string[] | null>(null);

  const handleShowReactors = (type: string) => {
    setReactorsFor(type);
    setReactorNames(null);
    fetchReactionUsers(postId, type)
      .then(setReactorNames)
      .catch(() => setReactorNames([]));
  };

  const handleToggle = (type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(type as ReactionType);
  };

  return (
    <View style={styles.row}>
      {PINNED_REACTIONS.map((type, i) => (
        <View key={type} style={styles.scoreCell}>
          {i > 0 ? <Text style={styles.dash}>—</Text> : null}
          <ScoreboardEntry
            type={type}
            count={counts[type] ?? 0}
            isActive={active.includes(type as ReactionType)}
            colors={colors}
            styles={styles}
            onPress={() => handleToggle(type)}
            onLongPress={() => handleShowReactors(type)}
          />
        </View>
      ))}

      {/* "+" — the other 7 EMOJI_BANK emoji, one tap deeper */}
      <Pressable style={styles.moreBtn} onPress={() => setEmojiOpen(true)} hitSlop={6}>
        <Text style={styles.moreBtnText}>+</Text>
      </Pressable>

      {/* ── Overflow emoji modal ── */}
      <Modal visible={emojiOpen} transparent animationType="fade" onRequestClose={() => setEmojiOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEmojiOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>React with an emoji</Text>
            <View style={styles.emojiGrid}>
              {OVERFLOW_EMOJI.map((emoji) => {
                const isActive = active.includes(emoji as ReactionType);
                const count = counts[emoji] ?? 0;
                return (
                  <Pressable
                    key={emoji}
                    style={[styles.emojiCell, isActive && styles.emojiCellActive]}
                    onPress={() => { handleToggle(emoji); setEmojiOpen(false); }}>
                    <Text style={styles.emojiText}>{emoji}</Text>
                    {count > 0 ? <Text style={styles.emojiCellCount}>{count}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Reactors modal (long-press a scoreboard entry) ── */}
      <Modal
        visible={reactorsFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReactorsFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReactorsFor(null)}>
          <Pressable style={[styles.sheet, styles.reactorsSheet]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{reactorsFor ?? ''}</Text>
            {reactorNames === null ? (
              <ActivityIndicator color={colors.text} />
            ) : reactorNames.length === 0 ? (
              <Text style={styles.reactorEmpty}>No one yet.</Text>
            ) : (
              reactorNames.map((name, i) => (
                <Text key={`${name}-${i}`} style={styles.reactorName}>{name}</Text>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// A single "🔥 12" scoreboard entry — the count flips (fade + slide) on
// change instead of just re-rendering, so incrementing reads as a live
// tally ticking up rather than a static number that happened to update.
function ScoreboardEntry({
  type, count, isActive, colors, styles, onPress, onLongPress,
}: {
  type: string;
  count: number;
  isActive: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const flip = useSharedValue(1);

  useEffect(() => {
    flip.value = withSequence(withTiming(0, { duration: 90 }), withTiming(1, { duration: 90 }));
  }, [count, flip]);

  const flipStyle = useAnimatedStyle(() => ({
    opacity: flip.value,
    transform: [{ translateY: (1 - flip.value) * -6 }],
  }));

  return (
    <Pressable
      style={styles.scoreEntry}
      onPress={onPress}
      onLongPress={count > 0 ? onLongPress : undefined}
      hitSlop={6}>
      <Text style={styles.scoreEmoji}>{type}</Text>
      <Animated.Text style={[styles.scoreCount, isActive && styles.scoreCountActive, flipStyle]}>
        {count}
      </Animated.Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    scoreCell: { flexDirection: 'row', alignItems: 'center' },
    dash: { fontSize: 12, color: colors.textSecondary, marginHorizontal: 4 },
    scoreEntry: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
    scoreEmoji: { fontSize: 15 },
    scoreCount: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
    scoreCountActive: { color: colors.coral },

    moreBtn: {
      width: 26,
      height: 26,
      borderRadius: RADII.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    moreBtnText: { fontSize: 14, fontWeight: WEIGHT.semibold, color: colors.textSecondary, marginTop: -1 },

    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: RADII.lg,
      borderTopRightRadius: RADII.lg,
      padding: 20,
      paddingBottom: 36,
      gap: 16,
    },
    sheetTitle: {
      fontSize: 14,
      fontWeight: WEIGHT.bold,
      color: colors.text,
      textAlign: 'center',
    },

    emojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      justifyContent: 'center',
    },
    emojiCell: {
      width: 52,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADII.md,
    },
    emojiCellActive: {
      backgroundColor: colors.coral + '20',
    },
    emojiText: { fontSize: 26 },
    emojiCellCount: { fontSize: 9, color: colors.textSecondary, fontWeight: WEIGHT.medium },

    reactorsSheet: { alignItems: 'center' },
    reactorName: { fontSize: 14, color: colors.text },
    reactorEmpty: { fontSize: 13, color: colors.textSecondary },
  });
}
