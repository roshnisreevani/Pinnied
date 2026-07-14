import * as Haptics from 'expo-haptics';
import { Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { EMOJI_DATA } from '@/lib/emoji-data';
import { fetchReactionUsers } from '@/lib/posts';
import { REACTIONS, type ReactionType } from '@/lib/reactions';

type Props = {
  postId: string;
  counts: Record<ReactionType, number>;
  active: ReactionType[];
  onToggle: (type: ReactionType) => void;
  // Opens the share sheet (reshare / share to group / save).
  onOpenShare: () => void;
};

const PRESET_TYPES = new Set(REACTIONS.map((r) => r.type));

// Double-tap-on-media still writes a 'fire' reaction under the hood (drives
// the streak/HOT-badge features) even though it's no longer one of the 3
// curated pills — excluded here so it doesn't show up as a stray "fire" text
// pill instead of a real emoji.
const HIDDEN_TYPES = new Set(['fire']);

export function ReactionBar({ postId, counts, active, onToggle, onOpenShare }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reactorsFor, setReactorsFor] = useState<string | null>(null);
  const [reactorNames, setReactorNames] = useState<string[] | null>(null);

  const filteredEmoji = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return EMOJI_DATA;
    return EMOJI_DATA.filter(
      (e) => e.name.toLowerCase().includes(q) || e.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [search]);

  // Any emoji picked via the "+" grid that isn't one of the 3 presets —
  // rendered as its own pill so it's not lost, just not pinned like presets.
  const customTypes = Object.keys(counts).filter(
    (type) => !PRESET_TYPES.has(type) && !HIDDEN_TYPES.has(type) && (counts[type] > 0 || active.includes(type))
  );

  const handlePickEmoji = (emoji: string) => {
    setPickerOpen(false);
    setSearch('');
    onToggle(emoji);
  };

  const handleShowReactors = (type: string) => {
    setReactorsFor(type);
    setReactorNames(null);
    fetchReactionUsers(postId, type)
      .then(setReactorNames)
      .catch(() => setReactorNames([]));
  };

  return (
    <View style={styles.row}>
      {REACTIONS.map((meta) => (
        <ReactionPill
          key={meta.type}
          type={meta.type}
          emoji={meta.emoji}
          accent={meta.accent}
          count={counts[meta.type] ?? 0}
          isActive={active.includes(meta.type)}
          colors={colors}
          styles={styles}
          onPress={() => onToggle(meta.type)}
          onLongPress={() => handleShowReactors(meta.type)}
        />
      ))}

      {customTypes.map((type) => (
        <ReactionPill
          key={type}
          type={type}
          emoji={type}
          accent="neutral"
          count={counts[type] ?? 0}
          isActive={active.includes(type)}
          colors={colors}
          styles={styles}
          onPress={() => onToggle(type)}
          onLongPress={() => handleShowReactors(type)}
        />
      ))}

      {/* Opens a real in-app grid of emoji to react with — not the 3 presets
          above, and not dependent on the device's own emoji keyboard. */}
      <Pressable style={styles.addPill} onPress={() => setPickerOpen(true)} hitSlop={6}>
        <Text style={styles.addPillText}>+</Text>
      </Pressable>

      {/* Share: reshare to your Feed, share to a group, or save privately. */}
      <Pressable style={styles.addPill} onPress={onOpenShare} hitSlop={6}>
        <Share2 size={14} color={colors.textSecondary} strokeWidth={2} />
      </Pressable>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPickerOpen(false);
          setSearch('');
        }}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setPickerOpen(false);
            setSearch('');
          }}>
          <Pressable style={styles.gridCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>React with</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search emoji…"
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoCorrect={false}
            />
            <ScrollView contentContainerStyle={styles.grid} keyboardShouldPersistTaps="handled">
              {filteredEmoji.length === 0 ? (
                <Text style={styles.noResults}>No emoji found.</Text>
              ) : (
                filteredEmoji.map((e) => (
                  <Pressable
                    key={e.emoji}
                    style={styles.gridCell}
                    onPress={() => handlePickEmoji(e.emoji)}
                    hitSlop={2}>
                    <Text style={styles.gridEmoji}>{e.emoji}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={reactorsFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReactorsFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReactorsFor(null)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>{reactorsFor ? reactorsHeading(reactorsFor) : ''}</Text>
            {reactorNames === null ? (
              <ActivityIndicator color={colors.text} />
            ) : reactorNames.length === 0 ? (
              <Text style={styles.reactorEmpty}>No one yet.</Text>
            ) : (
              reactorNames.map((name, i) => (
                <Text key={`${name}-${i}`} style={styles.reactorName}>
                  {name}
                </Text>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function reactorsHeading(type: string): string {
  const meta = REACTIONS.find((r) => r.type === type);
  return meta ? `${meta.emoji} ${meta.label}` : type;
}

function ReactionPill({
  type,
  emoji,
  accent,
  count,
  isActive,
  colors,
  styles,
  onPress,
  onLongPress,
}: {
  type: ReactionType;
  emoji: string;
  accent: 'red' | 'blue' | 'neutral';
  count: number;
  isActive: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const pop = useSharedValue(1);
  const [burstKey, setBurstKey] = useState(0);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pop.value = withSequence(withTiming(1.45, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 260 }));
    setBurstKey((k) => k + 1);
    onPress();
  };

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const accentColor = accent === 'red' ? colors.coral : accent === 'blue' ? colors.blue : colors.text;

  return (
    <View style={styles.pillWrap}>
      {type === 'lol' ? <PuffBurst triggerKey={burstKey} colors={colors} /> : null}

      <AnimatedPressable
        style={[styles.pill, isActive && { borderColor: accentColor, backgroundColor: colors.borderSoft }]}
        onPress={handlePress}
        onLongPress={onLongPress}
        haptic={false}>
        <Animated.Text style={[styles.pillEmoji, popStyle]}>{emoji}</Animated.Text>
        <Text style={[styles.pillCount, isActive && { color: accentColor, fontWeight: WEIGHT.bold }]}>{count}</Text>
      </AnimatedPressable>
    </View>
  );
}

function PuffBurst({ triggerKey, colors }: { triggerKey: number; colors: ThemeColors }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (triggerKey === 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  const style = useAnimatedStyle(() => ({
    opacity: (1 - progress.value) * 0.6,
    transform: [{ scale: 0.6 + progress.value * 1.1 }],
  }));

  if (triggerKey === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[burstStyles.puff, { borderColor: colors.textSecondary }, style]}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 8 },
    pillWrap: { position: 'relative' },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: RADII.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    pillEmoji: { fontSize: 14 },
    pillCount: { fontSize: 12, color: colors.textSecondary, fontWeight: WEIGHT.medium },
    addPill: {
      width: 28,
      height: 28,
      borderRadius: RADII.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPillText: { fontSize: 15, color: colors.textSecondary, fontWeight: WEIGHT.medium },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
    },
    pickerCard: {
      width: '100%',
      maxWidth: 280,
      backgroundColor: colors.background,
      borderRadius: RADII.lg,
      padding: 20,
      gap: 14,
      alignItems: 'center',
    },
    gridCard: {
      width: '100%',
      maxWidth: 340,
      maxHeight: 440,
      backgroundColor: colors.background,
      borderRadius: RADII.lg,
      padding: 18,
      gap: 12,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.text,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      justifyContent: 'center',
    },
    gridCell: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADII.md,
    },
    gridEmoji: { fontSize: 24 },
    noResults: { fontSize: 13, color: colors.textSecondary, paddingVertical: 20 },
    pickerTitle: { fontSize: 14, fontWeight: WEIGHT.semibold, color: colors.text, textAlign: 'center' },
    reactorName: { fontSize: 14, color: colors.text, alignSelf: 'stretch' },
    reactorEmpty: { fontSize: 13, color: colors.textSecondary },
  });
}

const burstStyles = StyleSheet.create({
  puff: {
    position: 'absolute',
    top: 0,
    left: '30%',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
  },
});
