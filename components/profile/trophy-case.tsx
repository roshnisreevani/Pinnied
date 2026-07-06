import { Plus, Star, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ConfettiBurst } from '@/components/ui/confetti-burst';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import type { Trophy } from '@/lib/profile';

const QUICK_EMOJI = [
  '🔥', '🏆', '🎯', '🐌', '⭐', '💀', '😤', '🥎',
  '🏀', '⚽', '🎾', '🏓', '🥇', '👑', '🚀', '😅',
];

const CARD_WIDTH = 96;
const CARD_HEIGHT = 118;
const LEGENDARY_SCALE = 1.14;
const GOLD = '#D4AF37';

type EditProps = {
  editing: true;
  trophies: Trophy[];
  onAdd: (trophy: Omit<Trophy, 'id'>) => void;
  onUpdate: (trophy: Trophy) => void;
  onRemove: (id: string) => void;
};

type ViewProps = {
  editing: false;
  trophies: Trophy[];
};

type Props = EditProps | ViewProps;

type FormState = {
  icon: string;
  title: string;
  subtitle: string;
  story: string;
  legendary: boolean;
};

const EMPTY_FORM: FormState = { icon: '🏆', title: '', subtitle: '', story: '', legendary: false };

export function TrophyCase(props: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrophy, setEditingTrophy] = useState<Trophy | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [justUnlockedId, setJustUnlockedId] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const prevIdsRef = useRef<Set<string>>(new Set(props.trophies.map((t) => t.id)));

  // Detect a newly-added trophy (one whose id wasn't present last render) so
  // we can play the unlock flip + confetti on it, purely from prop diffing —
  // this way it works regardless of where the add actually happened.
  useEffect(() => {
    const prevIds = prevIdsRef.current;
    const currentIds = new Set(props.trophies.map((t) => t.id));
    const added = props.trophies.find((t) => !prevIds.has(t.id));
    prevIdsRef.current = currentIds;

    if (added) {
      setJustUnlockedId(added.id);
      setConfettiKey((k) => k + 1);
      const timeout = setTimeout(() => setJustUnlockedId(null), 900);
      return () => clearTimeout(timeout);
    }
  }, [props.trophies]);

  const openAddModal = () => {
    setEditingTrophy(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (trophy: Trophy) => {
    setEditingTrophy(trophy);
    setForm({
      icon: trophy.icon,
      title: trophy.title,
      subtitle: trophy.subtitle,
      story: trophy.story ?? '',
      legendary: !!trophy.legendary,
    });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSave = () => {
    if (!props.editing) return;
    if (!form.title.trim()) return;

    const payload = {
      icon: form.icon.trim() || '🏆',
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      story: form.story.trim() || undefined,
      legendary: form.legendary,
    };

    if (editingTrophy) {
      props.onUpdate({ ...payload, id: editingTrophy.id });
    } else {
      props.onAdd(payload);
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!props.editing || !editingTrophy) return;
    props.onRemove(editingTrophy.id);
    setModalOpen(false);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {props.trophies.length === 0 && !props.editing ? (
          <Text style={styles.empty}>Case is empty. Humbling.</Text>
        ) : (
          props.trophies.map((trophy) => (
            <TrophyCard
              key={trophy.id}
              trophy={trophy}
              colors={colors}
              styles={styles}
              justUnlocked={trophy.id === justUnlockedId}
              confettiKey={confettiKey}
              onLongPress={props.editing ? () => openEditModal(trophy) : undefined}
            />
          ))
        )}

        {props.editing ? (
          <AnimatedPressable style={styles.addWrap} onPress={openAddModal}>
            <View style={styles.addCard}>
              <Plus size={22} color={colors.textSecondary} strokeWidth={1.75} />
            </View>
            <Text numberOfLines={1} style={styles.cardLabel}>
              add new
            </Text>
          </AnimatedPressable>
        ) : null}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingTrophy ? 'Edit trophy' : 'Add a trophy'}</Text>

            <Text style={styles.formLabel}>pick an icon</Text>
            <View style={styles.emojiRow}>
              {QUICK_EMOJI.map((e) => (
                <AnimatedPressable
                  key={e}
                  onPress={() => setForm((f) => ({ ...f, icon: e }))}
                  style={[styles.emojiOption, form.icon === e && styles.emojiOptionActive]}>
                  <Text style={styles.emojiOptionText}>{e}</Text>
                </AnimatedPressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="or type/paste any emoji"
              placeholderTextColor={colors.textSecondary}
              value={form.icon}
              onChangeText={(v) => setForm((f) => ({ ...f, icon: v }))}
              maxLength={4}
            />
            <TextInput
              style={styles.input}
              placeholder="title — e.g. Showed up 10 weeks straight"
              placeholderTextColor={colors.textSecondary}
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="subtitle — e.g. Attendance, mostly out of guilt"
              placeholderTextColor={colors.textSecondary}
              value={form.subtitle}
              onChangeText={(v) => setForm((f) => ({ ...f, subtitle: v }))}
            />
            <TextInput
              style={[styles.input, styles.storyInput]}
              placeholder="the story — the longer, funnier version (shows on the back)"
              placeholderTextColor={colors.textSecondary}
              value={form.story}
              onChangeText={(v) => setForm((f) => ({ ...f, story: v }))}
              multiline
            />

            <View style={styles.legendaryRow}>
              <View style={styles.legendaryText}>
                <Text style={styles.formLabel}>legendary slot</Text>
                <Text style={styles.legendaryHint}>your one all-time best — bumps whichever trophy has it now</Text>
              </View>
              <Switch
                value={form.legendary}
                onValueChange={(v) => setForm((f) => ({ ...f, legendary: v }))}
                trackColor={{ true: GOLD, false: colors.border }}
                thumbColor={ON_ACCENT}
              />
            </View>

            <View style={styles.modalActions}>
              {editingTrophy ? (
                <AnimatedPressable onPress={handleDelete} hitSlop={8} style={styles.deleteAction}>
                  <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                </AnimatedPressable>
              ) : (
                <View />
              )}
              <View style={styles.modalActionsRight}>
                <AnimatedPressable onPress={closeModal} hitSlop={8}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[styles.primaryButton, !form.title.trim() && styles.primaryButtonDisabled]}
                  onPress={handleSave}
                  disabled={!form.title.trim()}>
                  <Text style={styles.primaryButtonText}>{editingTrophy ? 'Save' : 'Add to case'}</Text>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function TrophyCard({
  trophy,
  colors,
  styles,
  justUnlocked,
  confettiKey,
  onLongPress,
}: {
  trophy: Trophy;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  justUnlocked: boolean;
  confettiKey: number;
  onLongPress?: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const rotation = useSharedValue(0);
  // Unlock reveal: pop in from a slight scale-down + spin on first appearance.
  const unlockScale = useSharedValue(justUnlocked ? 0.6 : 1);
  const unlockRotate = useSharedValue(justUnlocked ? -180 : 0);

  useEffect(() => {
    if (justUnlocked) {
      unlockScale.value = withTiming(1, { duration: 500 });
      unlockRotate.value = withTiming(0, { duration: 500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justUnlocked]);

  const toggleFlip = () => {
    const next = !flipped;
    setFlipped(next);
    rotation.value = withTiming(next ? 180 : 0, { duration: 400 });
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: unlockScale.value },
      { rotateY: `${rotation.value + unlockRotate.value}deg` },
    ],
    opacity: rotation.value > 90 ? 0 : 1,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ scale: unlockScale.value }, { rotateY: `${rotation.value - 180}deg` }],
    opacity: rotation.value > 90 ? 1 : 0,
  }));

  const hasStory = !!trophy.story;
  const cardSizeStyle = trophy.legendary ? styles.cardLegendarySize : undefined;

  return (
    <AnimatedPressable style={styles.cardWrap} onPress={hasStory ? toggleFlip : undefined} onLongPress={onLongPress}>
      <View style={[styles.cardFaceContainer, cardSizeStyle]}>
        <Animated.View style={[styles.cardFace, trophy.legendary && styles.cardFaceLegendary, frontStyle]}>
          {trophy.legendary ? (
            <View style={styles.legendaryBadge}>
              <Star size={11} color={GOLD} fill={GOLD} strokeWidth={0} />
            </View>
          ) : null}
          <Text style={[styles.cardIcon, trophy.legendary && styles.cardIconLegendary]}>{trophy.icon}</Text>
          <Text numberOfLines={2} style={styles.cardTitle}>
            {trophy.title}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.cardFace, styles.cardBack, trophy.legendary && styles.cardFaceLegendary, backStyle]}>
          <Text numberOfLines={5} style={styles.cardStory}>
            {trophy.story || trophy.subtitle}
          </Text>
        </Animated.View>

        {justUnlocked ? <ConfettiBurst triggerKey={confettiKey} /> : null}
      </View>
      <Text numberOfLines={1} style={styles.cardLabel}>
        {hasStory ? (flipped ? 'the story' : trophy.subtitle || 'tap to flip') : trophy.subtitle}
      </Text>
    </AnimatedPressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 14, paddingVertical: 4, alignItems: 'flex-end' },
    empty: { fontStyle: 'italic', color: colors.textSecondary, fontSize: 13, paddingVertical: 10 },
    cardWrap: { alignItems: 'center', width: CARD_WIDTH },
    cardFaceContainer: {
      width: CARD_WIDTH - 10,
      height: CARD_HEIGHT,
      marginBottom: 6,
    },
    cardLegendarySize: {
      width: (CARD_WIDTH - 10) * LEGENDARY_SCALE,
      height: CARD_HEIGHT * LEGENDARY_SCALE,
      marginLeft: -((CARD_WIDTH - 10) * (LEGENDARY_SCALE - 1)) / 2,
    },
    cardFace: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: RADII.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
      backfaceVisibility: 'hidden',
    },
    cardFaceLegendary: {
      borderColor: GOLD,
      borderWidth: 2,
      shadowColor: GOLD,
      shadowOpacity: 0.5,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    cardBack: { paddingHorizontal: 10 },
    legendaryBadge: { position: 'absolute', top: 6, right: 6 },
    cardIcon: { fontSize: 26, marginBottom: 4 },
    cardIconLegendary: { fontSize: 32 },
    cardTitle: { fontSize: 11, fontWeight: WEIGHT.semibold, color: colors.text, textAlign: 'center' },
    cardStory: { fontSize: 11, color: colors.text, textAlign: 'center', lineHeight: 15 },
    cardLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', width: CARD_WIDTH },
    addWrap: { alignItems: 'center', width: CARD_WIDTH },
    addCard: {
      width: CARD_WIDTH - 10,
      height: CARD_HEIGHT,
      borderRadius: RADII.lg,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
      maxHeight: '85%',
      backgroundColor: colors.background,
      borderRadius: RADII.lg,
      padding: 20,
      gap: 10,
    },
    modalTitle: { fontWeight: WEIGHT.bold, fontSize: 16, color: colors.text, marginBottom: 2 },
    formLabel: { fontWeight: WEIGHT.semibold, fontSize: 12, color: colors.textSecondary },
    emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    emojiOption: {
      width: 36,
      height: 36,
      borderRadius: RADII.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    emojiOptionActive: { borderColor: colors.coral, borderWidth: 1.5, backgroundColor: colors.borderSoft },
    emojiOptionText: { fontSize: 18 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
    },
    storyInput: { minHeight: 64, textAlignVertical: 'top' },
    legendaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingTop: 4,
    },
    legendaryText: { flex: 1, gap: 2 },
    legendaryHint: { fontSize: 11, color: colors.textSecondary },
    modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
    modalActionsRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    deleteAction: { padding: 4 },
    cancelText: { fontWeight: WEIGHT.medium, color: colors.textSecondary, fontSize: 14 },
    primaryButton: {
      backgroundColor: colors.coral,
      borderRadius: RADII.pill,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    primaryButtonDisabled: { opacity: 0.4 },
    primaryButtonText: { fontWeight: WEIGHT.bold, color: ON_ACCENT, fontSize: 14 },
  });
}
