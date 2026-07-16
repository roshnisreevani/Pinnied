import { MessageCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';

import { InitialsAvatar } from '@/components/profile/initials-avatar';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import { votePickEm, type PickEm, type PickEmPerson, type PickEmSide } from '@/lib/pickem';

type Props = {
  pickEm: PickEm;
  currentUserId: string;
  onChanged: () => void; // reload after a vote
  onOpenComments: () => void;
};

export function PickEmCard({ pickEm, currentUserId, onChanged, onOpenComments }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);

  const totalVotes = pickEm.votesA + pickEm.votesB;
  const pctA = totalVotes === 0 ? 50 : Math.round((pickEm.votesA / totalVotes) * 100);
  const canVote = !pickEm.amParticipant;

  const handleVote = async (side: PickEmSide) => {
    if (!canVote || busy) return;
    setBusy(true);
    try {
      await votePickEm(pickEm.id, currentUserId, side);
      onChanged();
    } catch (e) {
      Alert.alert('Could not save your pick', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      {pickEm.title ? <Text style={styles.title}>{pickEm.title}</Text> : null}

      <View style={styles.matchupRow}>
        <SideStack people={pickEm.sideA} align="flex-start" styles={styles} />
        <Text style={styles.vs}>VS</Text>
        <SideStack people={pickEm.sideB} align="flex-end" styles={styles} />
      </View>

      {/* Two-segment tally bar: coral = A, blue = B */}
      <View style={styles.tallyBar}>
        <View style={[styles.tallyFillA, { width: `${pctA}%` }]} />
        <View style={styles.tallyFillB} />
      </View>
      <View style={styles.tallyLabels}>
        <Text style={styles.tallyLabelA}>
          {pickEm.votesA} pick{pickEm.votesA === 1 ? '' : 's'}
        </Text>
        <Text style={styles.tallyLabelB}>
          {pickEm.votesB} pick{pickEm.votesB === 1 ? '' : 's'}
        </Text>
      </View>

      {busy ? (
        <ActivityIndicator color={colors.text} style={styles.busy} />
      ) : canVote ? (
        <View style={styles.voteRow}>
          <AnimatedPressable
            style={[styles.voteButton, pickEm.myVote === 'a' ? styles.voteButtonAActive : styles.voteButtonIdle]}
            onPress={() => handleVote('a')}>
            <Text style={pickEm.myVote === 'a' ? styles.voteButtonActiveText : styles.voteButtonIdleText}>
              Pick A{pickEm.myVote === 'a' ? ' ✓' : ''}
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.voteButton, pickEm.myVote === 'b' ? styles.voteButtonBActive : styles.voteButtonIdle]}
            onPress={() => handleVote('b')}>
            <Text style={pickEm.myVote === 'b' ? styles.voteButtonActiveText : styles.voteButtonIdleText}>
              Pick B{pickEm.myVote === 'b' ? ' ✓' : ''}
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <Text style={styles.participantNote}>You&apos;re in this matchup — you can&apos;t vote on it.</Text>
      )}

      <AnimatedPressable style={styles.commentButton} onPress={onOpenComments} hitSlop={6}>
        <MessageCircle size={15} color={colors.blue} strokeWidth={1.75} />
        <Text style={styles.commentButtonText}>Comments</Text>
      </AnimatedPressable>
    </View>
  );
}

function SideStack({
  people,
  align,
  styles,
}: {
  people: PickEmPerson[];
  align: 'flex-start' | 'flex-end';
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.side, { alignItems: align }]}>
      {people.map((p) => (
        <View key={p.userId} style={styles.person}>
          {p.avatarUrl ? (
            <Image source={{ uri: p.avatarUrl }} style={styles.personAvatar} />
          ) : (
            <InitialsAvatar name={p.name} size={30} />
          )}
          <Text style={styles.personName} numberOfLines={1}>
            {p.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.lg,
      backgroundColor: colors.background,
      padding: 14,
      gap: 10,
      marginBottom: 12,
    },
    title: { fontSize: 15, fontWeight: WEIGHT.bold, color: colors.text },
    matchupRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    side: { flex: 1, gap: 6 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: '100%' },
    personAvatar: { width: 30, height: 30, borderRadius: 15 },
    personName: { flexShrink: 1, fontSize: 13, fontWeight: WEIGHT.medium, color: colors.text },
    vs: { fontSize: 13, fontWeight: WEIGHT.bold, color: colors.textSecondary },
    tallyBar: {
      flexDirection: 'row',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: colors.blue,
    },
    tallyFillA: { height: '100%', backgroundColor: colors.coral },
    tallyFillB: { flex: 1, height: '100%', backgroundColor: colors.blue },
    tallyLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    tallyLabelA: { fontSize: 11, fontWeight: WEIGHT.semibold, color: colors.coral },
    tallyLabelB: { fontSize: 11, fontWeight: WEIGHT.semibold, color: colors.blue },
    busy: { marginVertical: 4, alignSelf: 'flex-start' },
    voteRow: { flexDirection: 'row', gap: 10 },
    voteButton: { flex: 1, alignItems: 'center', borderRadius: RADII.md, paddingVertical: 10, borderWidth: 1 },
    voteButtonIdle: { borderColor: colors.border },
    voteButtonIdleText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.text },
    voteButtonAActive: { backgroundColor: colors.coral, borderColor: colors.coral },
    voteButtonBActive: { backgroundColor: colors.blue, borderColor: colors.blue },
    voteButtonActiveText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: ON_ACCENT },
    participantNote: { fontSize: 12, fontStyle: 'italic', color: colors.textSecondary },
    commentButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    commentButtonText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.blue },
  });
}
