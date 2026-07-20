import { Camera, Clock, MapPin } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { SKILL_LEVEL_LABELS, type OpenGame } from '@/lib/open-games';
import { SPORTS } from '@/lib/sports';

function sportEmoji(sport: string): string {
  return SPORTS.find((s) => s.value === sport)?.emoji ?? '🏅';
}

function startsAtLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;
  return `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`;
}

const STATUS_BADGE: Record<OpenGame['gameStatus'], { label: string; bg: string; text: string }> = {
  upcoming: { label: 'Upcoming', bg: '#E8F0FE', text: '#1A56DB' },
  live: { label: '🔴 Live now', bg: '#FDECEC', text: '#C0392B' },
  completed: { label: 'Completed', bg: '#EFEFEF', text: '#666666' },
};

type Props = {
  game: OpenGame;
  onPress: () => void;
  onJoin: () => void;
  joining: boolean;
  alreadyGoing: boolean;
};

export function OpenGameCard({ game, onPress, onJoin, joining, alreadyGoing }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const spotsLabel = game.maxSpots ? `${game.goingCount}/${game.maxSpots} going` : `${game.goingCount} going`;
  const badge = STATUS_BADGE[game.gameStatus];
  const isCompleted = game.gameStatus === 'completed';

  const joinLabel = alreadyGoing ? "You're in" : game.requiresApproval ? 'Request to Join' : 'Join';

  return (
    <AnimatedPressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={styles.leftRow}>
          <Text style={styles.emoji}>{sportEmoji(game.sport)}</Text>
          <View style={styles.textCol}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {game.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <MapPin size={12} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.metaText} numberOfLines={1}>
                {game.locationName} · {game.distanceMiles.toFixed(1)} mi
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Clock size={12} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.metaText} numberOfLines={1}>
                {startsAtLabel(game.startsAt)} · {spotsLabel}
              </Text>
            </View>
            {isCompleted && game.photoCount > 0 ? (
              <View style={styles.metaRow}>
                <Camera size={12} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {game.photoCount} photo{game.photoCount === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.levelPill}>
          <Text style={styles.levelPillText}>{SKILL_LEVEL_LABELS[game.skillLevel]}</Text>
        </View>
      </View>

      {!isCompleted ? (
        <View style={styles.footer}>
          <AnimatedPressable
            style={[styles.joinButton, alreadyGoing && styles.joinButtonGoing]}
            onPress={onJoin}
            disabled={joining || alreadyGoing}>
            {joining ? (
              <ActivityIndicator color={ON_ACCENT} size="small" />
            ) : (
              <Text style={[styles.joinButtonText, alreadyGoing && styles.joinButtonTextGoing]}>{joinLabel}</Text>
            )}
          </AnimatedPressable>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.lg,
      padding: 12,
      marginBottom: 10,
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    leftRow: { flexDirection: 'row', gap: 10, flex: 1 },
    emoji: { fontSize: 22 },
    textCol: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    title: { fontSize: 14, fontWeight: WEIGHT.semibold, color: colors.text, flexShrink: 1 },
    statusBadge: { borderRadius: RADII.pill, paddingHorizontal: 7, paddingVertical: 2 },
    statusBadgeText: { fontSize: 10, fontWeight: WEIGHT.bold },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
    metaText: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
    levelPill: {
      backgroundColor: colors.borderSoft,
      borderRadius: RADII.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    levelPillText: { fontSize: 11, fontWeight: WEIGHT.semibold, color: colors.textSecondary },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
    joinButton: { backgroundColor: colors.coral, borderRadius: RADII.pill, paddingHorizontal: 16, paddingVertical: 7 },
    joinButtonGoing: { backgroundColor: colors.borderSoft },
    joinButtonText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: ON_ACCENT },
    joinButtonTextGoing: { color: colors.textSecondary },
  });
}
