import { Send } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { InitialsAvatar } from '@/components/profile/initials-avatar';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import {
  STATUS_CHIPS,
  checkInToGame,
  fetchCheckedInCount,
  fetchGameThread,
  fetchIAmCheckedIn,
  postThreadMessage,
  postThreadStatus,
  type GameThreadPost,
} from '@/lib/open-games';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

type Props = {
  gameId: string;
  userId: string;
};

export function GameDayThread({ gameId, userId }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [posts, setPosts] = useState<GameThreadPost[]>([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [iAmCheckedIn, setIAmCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [messageText, setMessageText] = useState('');
  const listRef = useRef<FlatList<GameThreadPost>>(null);

  const load = useCallback(async () => {
    try {
      const [fetchedPosts, count, checkedIn] = await Promise.all([
        fetchGameThread(gameId, userId),
        fetchCheckedInCount(gameId),
        fetchIAmCheckedIn(gameId, userId),
      ]);
      setPosts(fetchedPosts);
      setCheckedInCount(count);
      setIAmCheckedIn(checkedIn);
    } catch {
      // Thread is a nice-to-have layer on top of the game — fail quietly.
    } finally {
      setLoading(false);
    }
  }, [gameId, userId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await checkInToGame(gameId, userId);
      await load();
    } catch {
      // no-op — checking in isn't critical enough to alert-box over
    } finally {
      setCheckingIn(false);
    }
  };

  const handleChip = async (chip: string) => {
    try {
      await postThreadStatus(gameId, userId, chip);
      await load();
    } catch {
      // ignore
    }
  };

  const handleSend = async () => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await postThreadMessage(gameId, userId, trimmed);
      setMessageText('');
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Game Day Thread</Text>
          <Text style={styles.subtitle}>Closes a bit after the game ends</Text>
        </View>
      </View>

      <View style={styles.checkinCard}>
        <View>
          <Text style={styles.checkinCount}>{checkedInCount} checked in</Text>
          <Text style={styles.checkinHint}>Let everyone know you've arrived</Text>
        </View>
        <AnimatedPressable
          style={[styles.checkinButton, iAmCheckedIn && styles.checkinButtonDone]}
          onPress={handleCheckIn}
          disabled={checkingIn || iAmCheckedIn}>
          {checkingIn ? (
            <ActivityIndicator color={ON_ACCENT} size="small" />
          ) : (
            <Text style={[styles.checkinButtonText, iAmCheckedIn && styles.checkinButtonTextDone]}>
              {iAmCheckedIn ? "✓ I'm here" : "I'm here"}
            </Text>
          )}
        </AnimatedPressable>
      </View>

      <FlatList
        horizontal
        data={STATUS_CHIPS}
        keyExtractor={(c) => c.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => (
          <AnimatedPressable style={styles.chip} onPress={() => handleChip(item.value)}>
            <Text style={styles.chipText}>{item.label}</Text>
          </AnimatedPressable>
        )}
      />

      {loading ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: 12 }} />
      ) : (
        <View style={styles.feed}>
          {posts.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet — be the first to check in or send a status.</Text>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.postRow}>
                <InitialsAvatar name={post.name} size={28} />
                <View style={styles.postBody}>
                  <View style={styles.postHeader}>
                    <Text style={styles.postName}>{post.name}</Text>
                    <Text style={styles.postTime}>{timeLabel(post.createdAt)}</Text>
                  </View>
                  <Text style={styles.postText}>
                    {post.kind === 'checkin' ? "checked in ✅" : post.kind === 'status' ? post.statusChip : post.body}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Send a message..."
          placeholderTextColor={colors.textSecondary}
          value={messageText}
          onChangeText={setMessageText}
          maxLength={300}
        />
        <AnimatedPressable style={styles.sendButton} onPress={handleSend} disabled={sending || !messageText.trim()}>
          {sending ? <ActivityIndicator color={ON_ACCENT} size="small" /> : <Send size={16} color={ON_ACCENT} />}
        </AnimatedPressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.lg,
      padding: 14,
      marginTop: 26,
      gap: 10,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 15, fontWeight: WEIGHT.bold, color: colors.text },
    subtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    checkinCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.borderSoft,
      borderRadius: RADII.md,
      padding: 12,
    },
    checkinCount: { fontSize: 16, fontWeight: WEIGHT.bold, color: colors.text },
    checkinHint: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    checkinButton: { backgroundColor: colors.coral, borderRadius: RADII.pill, paddingHorizontal: 14, paddingVertical: 9 },
    checkinButtonDone: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    checkinButtonText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: ON_ACCENT },
    checkinButtonTextDone: { color: colors.text },
    chipRow: { gap: 8, paddingVertical: 2 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.text },
    feed: { gap: 10, marginTop: 4 },
    emptyText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', paddingVertical: 10 },
    postRow: { flexDirection: 'row', gap: 8 },
    postBody: { flex: 1, gap: 1 },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    postName: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.text },
    postTime: { fontSize: 10, color: colors.textSecondary },
    postText: { fontSize: 13, color: colors.text },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    composerInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 14,
      paddingVertical: 9,
      fontSize: 13,
      color: colors.text,
    },
    sendButton: {
      backgroundColor: colors.coral,
      borderRadius: RADII.pill,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
