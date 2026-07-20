import { useEvent } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Archive, ChevronLeft, Flame, MessageCircleReply, Send, Target, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, SPACING, TYPE, WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import {
  archiveHighlightClip,
  fetchHighlightClip,
  fetchHighlightMessages,
  fetchHighlightNotes,
  retryHighlightAnalysis,
  sendHighlightMessage,
  setHighlightVisibility,
  type HighlightClip,
  type HighlightMessage,
  type HighlightNote,
  type HighlightVisibility,
} from '@/lib/highlights';

const STUCK_PENDING_MS = 25000;
// How far right an AI bubble needs to be dragged before it counts as
// "reply to this" and quotes it into the composer — mirrors the swipe-reply
// gesture already used in Banter's chat/[id].tsx for a consistent feel.
const SWIPE_REPLY_TRIGGER = 56;

export default function HighlightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [clip, setClip] = useState<HighlightClip | null>(null);
  const [notes, setNotes] = useState<HighlightNote[]>([]);
  const [messages, setMessages] = useState<HighlightMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  // Text being quoted into the next reply — either a note's text (tap the
  // reply icon) or an AI chat bubble's text (swipe it right). Unified since
  // both just need the quoted string, not the full note/message object.
  const [quotedText, setQuotedText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [stuckPending, setStuckPending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(clip?.videoUrl ?? null);
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const fetchedClip = await fetchHighlightClip(id);
      setClip(fetchedClip);
      if (fetchedClip?.status === 'ready') {
        const [fetchedNotes, fetchedMessages] = await Promise.all([
          fetchHighlightNotes(id),
          fetchHighlightMessages(id),
        ]);
        setNotes(fetchedNotes);
        setMessages(fetchedMessages);
      }
    } catch (e) {
      Alert.alert('Could not load highlight', errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // If it's still pending after a while, stop pretending it's about to
  // finish any second and offer a manual retry instead of an infinite
  // spinner — this is exactly the "stuck forever" failure mode this screen
  // hit before the base64-encoding fix.
  useEffect(() => {
    if (clip?.status === 'pending' && !stuckTimerRef.current) {
      stuckTimerRef.current = setTimeout(() => setStuckPending(true), STUCK_PENDING_MS);
    } else if (clip?.status !== 'pending') {
      if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
      setStuckPending(false);
    }
    return () => {
      if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    };
  }, [clip?.status]);

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    setStuckPending(false);
    try {
      const { error } = await retryHighlightAnalysis(id);
      if (error) throw error;
      setClip((prev) => (prev ? { ...prev, status: 'pending', errorMessage: null } : prev));
    } catch (e) {
      Alert.alert('Could not retry', errorMessage(e));
    } finally {
      setRetrying(false);
    }
  };

  // Poll while the analysis is still running — stops itself once ready/failed.
  useEffect(() => {
    if (clip?.status === 'pending' && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    } else if (clip?.status !== 'pending' && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [clip?.status, load]);

  const handleSeek = (seconds: number) => {
    player.currentTime = seconds;
    player.play();
  };

  const handleSend = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || !id) return;
    const quoted = quotedText ?? undefined;
    const displayBody = quoted ? `↳ "${quoted}"\n${trimmed}` : trimmed;
    setSending(true);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender: 'user', body: displayBody, createdAt: new Date().toISOString() }]);
    setMessageText('');
    setQuotedText(null);
    try {
      const reply = await sendHighlightMessage(id, trimmed, quoted);
      setMessages((prev) => [...prev, { id: `local-ai-${Date.now()}`, sender: 'ai', body: reply, createdAt: new Date().toISOString() }]);
    } catch (e) {
      Alert.alert('Could not send message', errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const handleVisibility = async (visibility: HighlightVisibility) => {
    if (!clip || !userId) return;
    setVisibilityBusy(true);
    try {
      await setHighlightVisibility(clip, visibility, userId);
      setClip({ ...clip, visibility });
      if (visibility === 'feed') Alert.alert('Shared', 'Your clip is posted to Feed.');
      if (visibility === 'profile') Alert.alert('Posted', 'Your clip is on your profile highlights.');
    } catch (e) {
      Alert.alert('Could not update', errorMessage(e));
    } finally {
      setVisibilityBusy(false);
    }
  };

  const handleArchive = () => {
    if (!id) return;
    Alert.alert('Archive this clip?', 'Moves it to your Archive — you can find it there later, or delete it for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await archiveHighlightClip(id);
            router.back();
          } catch (e) {
            Alert.alert('Could not archive', errorMessage(e));
          }
        },
      },
    ]);
  };

  if (loading || !clip) {
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
        <Text style={styles.headerTitle}>{clip.mode === 'roast' ? 'Roast' : 'Critique'}</Text>
        <AnimatedPressable onPress={handleArchive} hitSlop={8}>
          <Archive size={19} color={colors.textSecondary} strokeWidth={2} />
        </AnimatedPressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.videoWrap}>
          <VideoView player={player} style={styles.video} contentFit="cover" nativeControls />
          {status === 'loading' ? (
            <View style={styles.videoLoading} pointerEvents="none">
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        {clip.status === 'pending' ? (
          <View style={styles.pendingRow}>
            {!stuckPending ? (
              <>
                <ActivityIndicator color={colors.textSecondary} size="small" />
                <Text style={styles.pendingText}>Analyzing your clip...</Text>
              </>
            ) : (
              <View style={styles.stuckWrap}>
                <Text style={styles.failedText}>Taking longer than usual.</Text>
                <AnimatedPressable style={styles.retryButton} onPress={handleRetry} disabled={retrying}>
                  {retrying ? (
                    <ActivityIndicator color={ON_ACCENT} size="small" />
                  ) : (
                    <Text style={styles.retryButtonText}>Retry</Text>
                  )}
                </AnimatedPressable>
              </View>
            )}
          </View>
        ) : clip.status === 'failed' ? (
          <View style={styles.stuckWrap}>
            <Text style={styles.failedText}>{clip.errorMessage ?? 'Could not analyze this clip.'}</Text>
            <AnimatedPressable style={styles.retryButton} onPress={handleRetry} disabled={retrying}>
              {retrying ? (
                <ActivityIndicator color={ON_ACCENT} size="small" />
              ) : (
                <Text style={styles.retryButtonText}>Retry</Text>
              )}
            </AnimatedPressable>
          </View>
        ) : (
          <>
            <Text style={styles.overall}>{clip.overallText}</Text>

            <View style={styles.notesWrap}>
              {notes.map((note) => (
                <View key={note.id} style={styles.noteRow}>
                  <AnimatedPressable style={styles.noteMain} onPress={() => handleSeek(note.timestampSeconds)}>
                    <Text style={styles.noteTime}>{formatSeconds(note.timestampSeconds)}</Text>
                    <Text style={styles.noteText}>{note.noteText}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable hitSlop={8} onPress={() => setQuotedText(note.noteText)}>
                    <MessageCircleReply size={16} color={colors.textSecondary} strokeWidth={2} />
                  </AnimatedPressable>
                </View>
              ))}
            </View>

            <Text style={styles.chatLabel}>Private chat — only you see this. Swipe an AI reply right to respond to it.</Text>
            <View style={styles.chatWrap}>
              {messages.map((m) =>
                m.sender === 'ai' ? (
                  <SwipeableAiBubble key={m.id} onSwipeReply={() => setQuotedText(m.body)}>
                    <View style={styles.bubbleAiRow}>
                      <View style={[styles.aiAvatar, clip.mode === 'roast' ? styles.aiAvatarRoast : styles.aiAvatarCritique]}>
                        {clip.mode === 'roast' ? (
                          <Flame size={12} color={colors.coral} strokeWidth={2} />
                        ) : (
                          <Target size={12} color={colors.blue} strokeWidth={2} />
                        )}
                      </View>
                      <View
                        style={[
                          styles.bubble,
                          styles.bubbleAi,
                          clip.mode === 'roast' ? styles.bubbleAiRoast : styles.bubbleAiCritique,
                        ]}>
                        <Text style={styles.bubbleText}>{m.body}</Text>
                      </View>
                    </View>
                  </SwipeableAiBubble>
                ) : (
                  <View key={m.id} style={[styles.bubble, styles.bubbleUser]}>
                    <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{m.body}</Text>
                  </View>
                )
              )}
            </View>
            {quotedText ? (
              <View style={styles.quoteChip}>
                <Text style={styles.quoteChipText} numberOfLines={1}>
                  Replying to: {quotedText}
                </Text>
                <AnimatedPressable hitSlop={8} onPress={() => setQuotedText(null)}>
                  <X size={14} color={colors.textSecondary} strokeWidth={2} />
                </AnimatedPressable>
              </View>
            ) : null}
            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                placeholder={quotedText ? 'Reply to this...' : 'Ask a follow-up...'}
                placeholderTextColor={colors.textSecondary}
                value={messageText}
                onChangeText={setMessageText}
                maxLength={500}
              />
              <AnimatedPressable style={styles.sendButton} onPress={handleSend} disabled={sending || !messageText.trim()}>
                {sending ? <ActivityIndicator color={ON_ACCENT} size="small" /> : <Send size={16} color={ON_ACCENT} />}
              </AnimatedPressable>
            </View>

            <View style={styles.shareRow}>
              <AnimatedPressable
                style={[styles.shareButton, clip.visibility === 'private' && styles.shareButtonActive]}
                onPress={() => handleVisibility('private')}
                disabled={visibilityBusy}>
                <Text style={[styles.shareButtonText, clip.visibility === 'private' && styles.shareButtonTextActive]}>
                  Keep private
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.shareButton, clip.visibility === 'profile' && styles.shareButtonActive]}
                onPress={() => handleVisibility('profile')}
                disabled={visibilityBusy}>
                <Text style={[styles.shareButtonText, clip.visibility === 'profile' && styles.shareButtonTextActive]}>
                  Post to profile
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.shareButton, clip.visibility === 'feed' && styles.shareButtonActive]}
                onPress={() => handleVisibility('feed')}
                disabled={visibilityBusy}>
                <Text style={[styles.shareButtonText, clip.visibility === 'feed' && styles.shareButtonTextActive]}>
                  Share to feed
                </Text>
              </AnimatedPressable>
            </View>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Wraps an AI chat bubble so swiping it right past SWIPE_REPLY_TRIGGER quotes
 * it into the composer and springs back — same flick-to-reply gesture as
 * Banter's chat/[id].tsx, just without that screen's extra left-side detail
 * panel since there's nothing analogous to reveal here.
 */
function SwipeableAiBubble({ children, onSwipeReply }: { children: ReactNode; onSwipeReply: () => void }) {
  const translateX = useSharedValue(0);
  const replyTriggered = useSharedValue(false);

  const pan = Gesture.Pan()
    .activeOffsetX([12, 999])
    .failOffsetY([-8, 8])
    .onUpdate((e) => {
      const next = Math.max(0, Math.min(SWIPE_REPLY_TRIGGER, e.translationX));
      translateX.value = next;
      if (next >= SWIPE_REPLY_TRIGGER && !replyTriggered.value) {
        replyTriggered.value = true;
        runOnJS(onSwipeReply)();
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
      replyTriggered.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </GestureDetector>
  );
}

function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    headerTitle: { fontSize: TYPE.subtitle, fontWeight: WEIGHT.bold, color: colors.text },
    content: { padding: SPACING.xl, paddingBottom: 48, gap: 4 },
    videoWrap: { width: '100%', height: 300, borderRadius: RADII.lg, overflow: 'hidden', backgroundColor: '#000' },
    video: { width: '100%', height: '100%' },
    videoLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.lg, justifyContent: 'center' },
    pendingText: { fontSize: TYPE.label, color: colors.textSecondary },
    failedText: { fontSize: TYPE.label, color: colors.textSecondary, marginTop: SPACING.lg, textAlign: 'center' },
    stuckWrap: { alignItems: 'center', gap: 10, width: '100%' },
    retryButton: {
      backgroundColor: colors.coral,
      borderRadius: RADII.pill,
      paddingHorizontal: 20,
      paddingVertical: 9,
      minWidth: 90,
      alignItems: 'center',
    },
    retryButtonText: { fontSize: TYPE.label, fontWeight: WEIGHT.semibold, color: ON_ACCENT },
    overall: { fontSize: TYPE.body, fontWeight: WEIGHT.semibold, color: colors.text, marginTop: SPACING.lg, lineHeight: 21 },
    notesWrap: { marginTop: SPACING.md, gap: 6 },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      padding: 10,
    },
    noteMain: { flex: 1, flexDirection: 'row', gap: 10 },
    noteTime: { fontSize: TYPE.caption, fontWeight: WEIGHT.bold, color: colors.coral, minWidth: 34 },
    noteText: { fontSize: TYPE.label, color: colors.text, flex: 1 },
    chatLabel: { fontSize: TYPE.caption, color: colors.textSecondary, marginTop: SPACING.xl, marginBottom: 8 },
    quoteChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      backgroundColor: colors.border,
      borderRadius: RADII.md,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginTop: 8,
    },
    quoteChipText: { flex: 1, fontSize: TYPE.caption, color: colors.textSecondary },
    chatWrap: { gap: 6 },
    // Bumped from RADII.md to RADII.lg — Banter's chat bubbles use lg, and
    // this screen's bubbles looked visibly flatter/more generic sitting next
    // to that "gold standard" pattern at the smaller radius.
    bubble: { maxWidth: '80%', borderRadius: RADII.lg, paddingHorizontal: 12, paddingVertical: 8 },
    bubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.coral },
    // AI bubble gets a small persona avatar + a tail-like corner pinch toward
    // it, plus a mode tint (coral-ish for Roast, blue-ish for Critique) so
    // the two personas read as distinct "someones" instead of one generic
    // system voice — mirrors the flame/target icon language already used on
    // the mode-select cards in create-highlight.tsx.
    bubbleAiRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, alignSelf: 'flex-start', maxWidth: '85%' },
    aiAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    aiAvatarRoast: { backgroundColor: colors.coral + '18' },
    aiAvatarCritique: { backgroundColor: colors.blue + '18' },
    bubbleAi: { borderTopLeftRadius: 2 },
    bubbleAiRoast: { backgroundColor: colors.coral + '18' },
    bubbleAiCritique: { backgroundColor: colors.blue + '18' },
    bubbleText: { fontSize: TYPE.label, color: colors.text },
    bubbleTextUser: { color: ON_ACCENT },
    composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    composerInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 14,
      paddingVertical: 9,
      fontSize: TYPE.label,
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
    shareRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.xl },
    shareButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingVertical: 9,
      alignItems: 'center',
    },
    shareButtonActive: { backgroundColor: colors.coral, borderColor: colors.coral },
    shareButtonText: { fontSize: TYPE.caption, fontWeight: WEIGHT.semibold, color: colors.text },
    shareButtonTextActive: { color: ON_ACCENT },
  });
}
