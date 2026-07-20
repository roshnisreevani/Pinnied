import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Clock, MapPin, MoreHorizontal, Navigation } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { GameDayThread } from '@/components/open-games/game-day-thread';
import { GameMap } from '@/components/open-games/game-map';
import { GamePhotoRecap } from '@/components/open-games/game-photo-recap';
import { InitialsAvatar } from '@/components/profile/initials-avatar';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import { reportContent } from '@/lib/moderation';
import {
  cancelOpenGame,
  fetchCheckedInUserIds,
  fetchGameParticipants,
  fetchGameWaitlist,
  fetchMyRsvpStatus,
  fetchOpenGame,
  fetchPendingRequests,
  joinOpenGame,
  leaveOpenGame,
  removeParticipant,
  respondToJoinRequest,
  SKILL_LEVEL_LABELS,
  type MyRsvpStatus,
  type OpenGame,
  type OpenGameParticipant,
} from '@/lib/open-games';
import { SPORTS } from '@/lib/sports';

function sportEmoji(sport: string): string {
  return SPORTS.find((s) => s.value === sport)?.emoji ?? '🏅';
}

function openDirections(latitude: number, longitude: number, label: string) {
  // Deep-links straight into whatever maps app is already on the phone —
  // no API key involved, this is just a URL scheme, same as tapping an
  // address in Messages or Mail.
  const encodedLabel = encodeURIComponent(label);
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodedLabel}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('Could not open Maps', 'No maps app is available to open directions.');
  });
}

/** Thread is a game-day thing: opens 3 hours before start, closes 3 hours after start. */
function isThreadOpen(startsAtIso: string): boolean {
  const startsAt = new Date(startsAtIso).getTime();
  const now = Date.now();
  const threeHours = 3 * 60 * 60 * 1000;
  return now >= startsAt - threeHours && now <= startsAt + threeHours;
}

function fullStartsAtLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OpenGameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [game, setGame] = useState<OpenGame | null>(null);
  const [participants, setParticipants] = useState<OpenGameParticipant[]>([]);
  const [waitlist, setWaitlist] = useState<OpenGameParticipant[]>([]);
  const [myStatus, setMyStatus] = useState<MyRsvpStatus>('none');
  const [pendingRequests, setPendingRequests] = useState<OpenGameParticipant[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [introMessage, setIntroMessage] = useState('');

  const load = useCallback(async () => {
    if (!id || !userId) return;
    try {
      const [fetchedGame, fetchedParticipants, fetchedWaitlist, status] = await Promise.all([
        fetchOpenGame(id),
        fetchGameParticipants(id),
        fetchGameWaitlist(id),
        fetchMyRsvpStatus(id, userId),
      ]);
      setGame(fetchedGame);
      setParticipants(fetchedParticipants);
      setWaitlist(fetchedWaitlist);
      setMyStatus(status);
      if (fetchedGame?.createdBy === userId && fetchedGame.requiresApproval) {
        fetchPendingRequests(id).then(setPendingRequests).catch(() => {});
      } else {
        setPendingRequests([]);
      }
      if (fetchedGame?.createdBy === userId && fetchedGame.gameStatus !== 'upcoming') {
        fetchCheckedInUserIds(id).then(setCheckedInIds).catch(() => {});
      } else {
        setCheckedInIds(new Set());
      }
    } catch (e) {
      Alert.alert('Could not load game', errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isOrganizer = game && userId && game.createdBy === userId;
  const isFull = Boolean(game?.maxSpots && participants.length >= game.maxSpots);

  const handleJoinLeave = async () => {
    if (!id || !userId || !game) return;
    if (myStatus === 'none' && game.requiresApproval) {
      setIntroMessage('');
      setRequestModalVisible(true);
      return;
    }
    setActionBusy(true);
    try {
      if (myStatus !== 'none') {
        await leaveOpenGame(id);
      } else {
        const result = await joinOpenGame(id);
        if (result === 'waitlisted') {
          Alert.alert("You're on the waitlist", "This game is full — we'll add you automatically if a spot opens up.");
        }
      }
      await load();
    } catch (e) {
      Alert.alert(myStatus !== 'none' ? 'Could not leave' : 'Could not join', errorMessage(e));
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendRequest = async () => {
    if (!id) return;
    setActionBusy(true);
    try {
      await joinOpenGame(id, introMessage.trim() || undefined);
      setRequestModalVisible(false);
      Alert.alert('Request sent', 'The organizer will review your request to join.');
      await load();
    } catch (e) {
      Alert.alert('Could not send request', errorMessage(e));
    } finally {
      setActionBusy(false);
    }
  };

  const handleRespondToRequest = async (participant: OpenGameParticipant, approve: boolean) => {
    if (!id) return;
    setRespondingId(participant.userId);
    try {
      await respondToJoinRequest(id, participant.userId, approve);
      await load();
    } catch (e) {
      Alert.alert('Could not respond', errorMessage(e));
    } finally {
      setRespondingId(null);
    }
  };

  const handleCancelGame = () => {
    if (!id) return;
    Alert.alert('Cancel this game?', 'Everyone who joined will no longer see it.', [
      { text: 'Never mind', style: 'cancel' },
      {
        text: 'Cancel Game',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelOpenGame(id);
            router.back();
          } catch (e) {
            Alert.alert('Could not cancel', errorMessage(e));
          }
        },
      },
    ]);
  };

  const handleOrganizerMenu = () => {
    if (!id) return;
    Alert.alert('Manage Game', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit Details', onPress: () => router.push(`/edit-open-game/${id}`) },
      { text: 'Cancel Game', style: 'destructive', onPress: handleCancelGame },
    ]);
  };

  const handleParticipantOptions = (participant: OpenGameParticipant) => {
    if (!id || !userId) return;
    Alert.alert(participant.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove from game',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeParticipant(id, participant.userId);
            load();
          } catch (e) {
            Alert.alert('Could not remove', errorMessage(e));
          }
        },
      },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          try {
            await reportContent(userId, 'profile', participant.userId, 'inappropriate');
            await removeParticipant(id, participant.userId, 'Reported by organizer');
            load();
            Alert.alert('Reported', 'Thanks — we removed them from the roster and logged the report.');
          } catch (e) {
            Alert.alert('Could not report', errorMessage(e));
          }
        },
      },
    ]);
  };

  if (loading || !game) {
    return (
      <SafeAreaView style={styles.loading} edges={['top']}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Open Game
        </Text>
        {isOrganizer ? (
          <AnimatedPressable onPress={handleOrganizerMenu} hitSlop={8}>
            <MoreHorizontal size={22} color={colors.text} strokeWidth={2} />
          </AnimatedPressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {game.isCancelled ? (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledBannerText}>This game was cancelled by the organizer.</Text>
          </View>
        ) : null}

        <Text style={styles.emoji}>{sportEmoji(game.sport)}</Text>
        <Text style={styles.title}>{game.title}</Text>
        <View style={styles.levelPill}>
          <Text style={styles.levelPillText}>{SKILL_LEVEL_LABELS[game.skillLevel]}</Text>
        </View>

        {game.description ? <Text style={styles.description}>{game.description}</Text> : null}

        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <MapPin size={15} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText}>{game.locationName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Clock size={15} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText}>{fullStartsAtLabel(game.startsAt)}</Text>
          </View>
        </View>

        <View style={styles.mapWrap}>
          <GameMap latitude={game.latitude} longitude={game.longitude} height={160} />
          <AnimatedPressable
            style={styles.directionsButton}
            onPress={() => openDirections(game.latitude, game.longitude, game.locationName)}>
            <Navigation size={15} color={colors.text} strokeWidth={2} />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </AnimatedPressable>
        </View>

        {isOrganizer && pendingRequests.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Requests to join ({pendingRequests.length})</Text>
            <View style={styles.roster}>
              {pendingRequests.map((p) => (
                <View key={p.userId} style={styles.requestCard}>
                  <View style={styles.requestTopRow}>
                    <InitialsAvatar name={p.name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {p.introMessage ? (
                        <Text style={styles.introMessageText} numberOfLines={3}>
                          "{p.introMessage}"
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {respondingId === p.userId ? (
                    <ActivityIndicator color={colors.text} size="small" style={{ marginTop: 8 }} />
                  ) : (
                    <View style={styles.requestActions}>
                      <AnimatedPressable
                        style={styles.declineButton}
                        onPress={() => handleRespondToRequest(p, false)}>
                        <Text style={styles.declineButtonText}>Decline</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        style={styles.approveButton}
                        onPress={() => handleRespondToRequest(p, true)}>
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </AnimatedPressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>
          Who's going ({participants.length}
          {game.maxSpots ? `/${game.maxSpots}` : ''})
        </Text>

        <View style={styles.roster}>
          {participants.map((p) => (
            <AnimatedPressable
              key={p.userId}
              style={styles.playerCard}
              onPress={() => (isOrganizer && p.userId !== userId ? handleParticipantOptions(p) : undefined)}>
              <InitialsAvatar name={p.name} size={40} />
              <Text style={styles.playerName} numberOfLines={1}>
                {p.name}
                {p.userId === game.createdBy ? ' · Organizer' : ''}
              </Text>
              {isOrganizer &&
              game.gameStatus !== 'upcoming' &&
              p.userId !== game.createdBy &&
              !checkedInIds.has(p.userId) ? (
                <View style={styles.noShowTag}>
                  <Text style={styles.noShowTagText}>No check-in</Text>
                </View>
              ) : null}
            </AnimatedPressable>
          ))}
          {participants.length === 0 ? <Text style={styles.emptyRoster}>Nobody's joined yet — be the first.</Text> : null}
        </View>

        {waitlist.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Waitlist ({waitlist.length})</Text>
            <View style={styles.roster}>
              {waitlist.map((p, i) => (
                <AnimatedPressable
                  key={p.userId}
                  style={styles.playerCard}
                  onPress={() => (isOrganizer && p.userId !== userId ? handleParticipantOptions(p) : undefined)}>
                  <InitialsAvatar name={p.name} size={40} />
                  <Text style={styles.playerName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.waitlistPosition}>#{i + 1}</Text>
                </AnimatedPressable>
              ))}
            </View>
          </>
        ) : null}

        {userId &&
        !game.isCancelled &&
        isThreadOpen(game.startsAt) &&
        (isOrganizer || myStatus === 'going' || myStatus === 'waitlisted') ? (
          <GameDayThread gameId={game.id} userId={userId} />
        ) : null}

        {userId &&
        game.gameStatus !== 'upcoming' &&
        (game.photosPublic || isOrganizer || myStatus === 'going' || myStatus === 'waitlisted') ? (
          <GamePhotoRecap
            gameId={game.id}
            userId={userId}
            photosPublic={game.photosPublic}
            canAdd={Boolean(!game.isCancelled && (isOrganizer || myStatus === 'going'))}
          />
        ) : null}
      </ScrollView>

      {!isOrganizer && !game.isCancelled && game.gameStatus !== 'completed' && (
        <View style={styles.footer}>
          <AnimatedPressable
            style={[styles.joinButton, myStatus !== 'none' && styles.leaveButton]}
            onPress={handleJoinLeave}
            disabled={actionBusy || myStatus === 'pending'}>
            {actionBusy ? (
              <ActivityIndicator color={myStatus !== 'none' ? colors.text : ON_ACCENT} size="small" />
            ) : (
              <Text style={[styles.joinButtonText, myStatus !== 'none' && styles.leaveButtonText]}>
                {myStatus === 'going'
                  ? 'Leave Game'
                  : myStatus === 'waitlisted'
                    ? 'Leave Waitlist'
                    : myStatus === 'pending'
                      ? 'Request Pending'
                      : game.requiresApproval
                        ? 'Request to Join'
                        : isFull
                          ? 'Join Waitlist'
                          : 'Join Game'}
              </Text>
            )}
          </AnimatedPressable>
        </View>
      )}

      <Modal visible={requestModalVisible} transparent animationType="fade" onRequestClose={() => setRequestModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request to join</Text>
            <Text style={styles.modalSubtitle}>
              Add a short note for the organizer (optional) — who you are, your skill level, anything helpful.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Play rec-league volleyball, free most weekends!"
              placeholderTextColor={colors.textSecondary}
              value={introMessage}
              onChangeText={(t) => setIntroMessage(t.slice(0, 200))}
              multiline
              maxLength={200}
            />
            <Text style={styles.modalCounter}>{introMessage.length}/200</Text>
            <View style={styles.modalActions}>
              <AnimatedPressable style={styles.modalCancelButton} onPress={() => setRequestModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.modalSendButton} onPress={handleSendRequest} disabled={actionBusy}>
                {actionBusy ? (
                  <ActivityIndicator color={ON_ACCENT} size="small" />
                ) : (
                  <Text style={styles.modalSendText}>Send Request</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 16, fontWeight: WEIGHT.bold, color: colors.text, flex: 1, textAlign: 'center' },
    content: { padding: 20, paddingBottom: 40, alignItems: 'center' },
    cancelledBanner: {
      width: '100%',
      backgroundColor: '#FDECEC',
      borderRadius: RADII.md,
      padding: 10,
      marginBottom: 12,
    },
    cancelledBannerText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: '#C0392B', textAlign: 'center' },
    emoji: { fontSize: 44, marginBottom: 4 },
    title: { fontSize: 20, fontWeight: WEIGHT.bold, color: colors.text, textAlign: 'center' },
    levelPill: {
      backgroundColor: colors.borderSoft,
      borderRadius: RADII.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 8,
    },
    levelPillText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.textSecondary },
    description: { fontSize: 14, color: colors.text, textAlign: 'center', marginTop: 14, lineHeight: 20 },
    metaCard: {
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.lg,
      padding: 14,
      gap: 10,
      marginTop: 18,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    metaText: { fontSize: 14, color: colors.text },
    mapWrap: { width: '100%', marginTop: 14, gap: 8 },
    directionsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    directionsButtonText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.text },
    sectionTitle: {
      alignSelf: 'flex-start',
      fontSize: 13,
      fontWeight: WEIGHT.bold,
      color: colors.text,
      marginTop: 26,
      marginBottom: 10,
    },
    roster: { width: '100%', gap: 8 },
    playerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      padding: 10,
    },
    playerName: { fontSize: 14, fontWeight: WEIGHT.medium, color: colors.text, flex: 1 },
    noShowTag: {
      backgroundColor: colors.borderSoft,
      borderRadius: RADII.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    noShowTagText: { fontSize: 10, fontWeight: WEIGHT.semibold, color: colors.textSecondary },
    waitlistPosition: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.textSecondary },
    emptyRoster: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
    joinButton: { backgroundColor: colors.coral, borderRadius: RADII.md, paddingVertical: 14, alignItems: 'center' },
    leaveButton: { backgroundColor: colors.borderSoft },
    joinButtonText: { color: ON_ACCENT, fontWeight: WEIGHT.semibold, fontSize: 15 },
    leaveButtonText: { color: colors.text },
    requestCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      padding: 10,
      gap: 8,
    },
    requestTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    introMessageText: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
    requestActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    declineButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    declineButtonText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.text },
    approveButton: { backgroundColor: colors.coral, borderRadius: RADII.pill, paddingHorizontal: 14, paddingVertical: 7 },
    approveButtonText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: ON_ACCENT },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalCard: {
      width: '100%',
      backgroundColor: colors.background,
      borderRadius: RADII.lg,
      padding: 20,
      gap: 8,
    },
    modalTitle: { fontSize: 17, fontWeight: WEIGHT.bold, color: colors.text },
    modalSubtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      padding: 12,
      minHeight: 80,
      textAlignVertical: 'top',
      fontSize: 14,
      color: colors.text,
      marginTop: 6,
    },
    modalCounter: { fontSize: 11, color: colors.textSecondary, alignSelf: 'flex-end' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
    modalCancelButton: { paddingHorizontal: 14, paddingVertical: 10 },
    modalCancelText: { fontSize: 14, fontWeight: WEIGHT.semibold, color: colors.textSecondary },
    modalSendButton: {
      backgroundColor: colors.coral,
      borderRadius: RADII.pill,
      paddingHorizontal: 18,
      paddingVertical: 10,
      minWidth: 120,
      alignItems: 'center',
    },
    modalSendText: { fontSize: 14, fontWeight: WEIGHT.semibold, color: ON_ACCENT },
  });
}
