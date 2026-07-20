import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { CARD_WIDTH } from '@/components/feed/card-layout';
import { InitialsAvatar } from '@/components/profile/initials-avatar';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { SKILL_LEVEL_LABELS, type OpenGame } from '@/lib/open-games';
import type { SuggestedPerson } from '@/lib/follows';
import type { SportsContentCard } from '@/lib/sports-content';
import { SPORTS } from '@/lib/sports';
import { useMemo } from 'react';

/**
 * Full-bleed, card-shaped renderers for Discover's non-post swipe items —
 * an open game, a suggested person, or a casual-sports card — sized to the
 * same footprint (CARD_WIDTH) as SessionPostCard so they slot into
 * DiscoverCarousel's swipe deck as first-class cards, not a smaller
 * secondary widget.
 */

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

export function GameSwipeCard({
  game,
  onPress,
  onJoin,
  joining,
  alreadyGoing,
}: {
  game: OpenGame;
  onPress: () => void;
  onJoin: () => void;
  joining: boolean;
  alreadyGoing: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const spotsLabel = game.maxSpots ? `${game.goingCount}/${game.maxSpots} going` : `${game.goingCount} going`;
  const joinLabel = alreadyGoing ? "You're in" : game.requiresApproval ? 'Request to Join' : 'Join';
  const liveLabel = game.gameStatus === 'live' ? '🔴 Live now' : game.gameStatus === 'upcoming' ? 'Upcoming' : 'Completed';

  return (
    <AnimatedPressable style={styles.card} onPress={onPress}>
      <Text style={styles.kicker}>GAME NEAR YOU · {liveLabel}</Text>
      <Text style={styles.emojiBig}>{sportEmoji(game.sport)}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {game.title}
      </Text>
      <Text style={styles.meta}>
        {game.locationName} · {game.distanceMiles.toFixed(1)} mi
      </Text>
      <Text style={styles.meta}>
        {startsAtLabel(game.startsAt)} · {spotsLabel}
      </Text>
      <View style={styles.levelPill}>
        <Text style={styles.levelPillText}>{SKILL_LEVEL_LABELS[game.skillLevel]}</Text>
      </View>
      {game.gameStatus !== 'completed' ? (
        <AnimatedPressable
          style={[styles.actionButton, alreadyGoing && styles.actionButtonMuted]}
          onPress={onJoin}
          disabled={joining || alreadyGoing}>
          {joining ? (
            <ActivityIndicator color={ON_ACCENT} size="small" />
          ) : (
            <Text style={[styles.actionButtonText, alreadyGoing && styles.actionButtonTextMuted]}>{joinLabel}</Text>
          )}
        </AnimatedPressable>
      ) : null}
    </AnimatedPressable>
  );
}

export function PersonSwipeCard({
  person,
  onPress,
  onFollow,
  following,
}: {
  person: SuggestedPerson;
  onPress: () => void;
  onFollow: () => void;
  following: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>PEOPLE TO FOLLOW</Text>
      <AnimatedPressable onPress={onPress} style={styles.personAvatarWrap}>
        {person.avatarUrl ? (
          <Image source={{ uri: person.avatarUrl }} style={styles.personAvatar} />
        ) : (
          <InitialsAvatar name={person.name} size={88} />
        )}
      </AnimatedPressable>
      <Text style={styles.title}>{person.name}</Text>
      {person.location ? <Text style={styles.meta}>{person.location}</Text> : null}
      <AnimatedPressable style={[styles.actionButton, following && styles.actionButtonMuted]} onPress={onFollow} disabled={following}>
        <Text style={[styles.actionButtonText, following && styles.actionButtonTextMuted]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

export function SportsSwipeCard({ card }: { card: SportsContentCard }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (card.kind === 'fact') {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>CASUAL SPORTS</Text>
        <Text style={styles.emojiBig}>🏅</Text>
        <Text style={styles.factText}>{card.text}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{card.league.toUpperCase()}</Text>
      <Text style={styles.emojiBig}>🏆</Text>
      <Text style={styles.scoreLine}>{card.homeTeam}</Text>
      <Text style={styles.scoreBig}>{card.homeScore}</Text>
      <Text style={styles.scoreVs}>vs</Text>
      <Text style={styles.scoreBig}>{card.awayScore}</Text>
      <Text style={styles.scoreLine}>{card.awayTeam}</Text>
      {card.statusLabel ? <Text style={styles.meta}>{card.statusLabel}</Text> : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      borderRadius: RADII.lg,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    kicker: { fontSize: 11, fontWeight: WEIGHT.bold, color: colors.textSecondary, letterSpacing: 0.5 },
    emojiBig: { fontSize: 40, marginVertical: 6 },
    title: { fontSize: 18, fontWeight: WEIGHT.bold, color: colors.text, textAlign: 'center' },
    meta: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    levelPill: {
      marginTop: 6,
      backgroundColor: colors.borderSoft,
      borderRadius: RADII.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    levelPillText: { fontSize: 11, fontWeight: WEIGHT.semibold, color: colors.textSecondary },
    actionButton: {
      marginTop: 16,
      backgroundColor: colors.coral,
      borderRadius: RADII.pill,
      paddingHorizontal: 22,
      paddingVertical: 10,
    },
    actionButtonMuted: { backgroundColor: colors.borderSoft },
    actionButtonText: { fontSize: 14, fontWeight: WEIGHT.semibold, color: ON_ACCENT },
    actionButtonTextMuted: { color: colors.textSecondary },
    personAvatarWrap: { marginVertical: 6 },
    personAvatar: { width: 88, height: 88, borderRadius: 20 },
    factText: { fontSize: 15, color: colors.text, textAlign: 'center', lineHeight: 22 },
    scoreLine: { fontSize: 14, fontWeight: WEIGHT.semibold, color: colors.text },
    scoreBig: { fontSize: 28, fontWeight: WEIGHT.bold, color: colors.text },
    scoreVs: { fontSize: 11, color: colors.textSecondary },
  });
}
