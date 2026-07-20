import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Search } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
// RNGH's ScrollView (a drop-in for RN's) so FeedCarousel's swipe-up pan can
// coordinate with page scrolling via blocksExternalGesture — with the plain
// RN ScrollView the two recognizers can't negotiate and scroll wins.
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsModal } from '@/components/feed/comments-modal';
import { DiscoverCarousel, type DiscoverItem } from '@/components/feed/discover-carousel';
import { FeedCarousel } from '@/components/feed/feed-carousel';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { useReactionStreak } from '@/lib/feed-streak';
import { errorMessage } from '@/lib/error-message';
import { fetchSuggestedPeople, followUser, type SuggestedPerson } from '@/lib/follows';
import { blockUser, reportContent, type ReportReason } from '@/lib/moderation';
import { discoverOpenGames, joinOpenGame, type OpenGame } from '@/lib/open-games';
import {
  archivePost,
  computePostOfWeekId,
  fetchFeed,
  resharePost,
  setReaction,
  type FeedScope,
  type Post,
} from '@/lib/posts';
import type { ReactionType } from '@/lib/reactions';
import { fetchDiscoverSportsContent, type SportsContentCard } from '@/lib/sports-content';

// Deterministic PRNG (mulberry32) so Discover's mix can be reshuffled on
// purpose (new seed on refresh/scope-switch) while staying *stable* across
// re-renders in between — e.g. an optimistic reaction toggle updates the
// `posts` array's contents but not its length, so re-deriving discoverItems
// from the same seed lands on the same picks/positions, just with fresh
// data. Reshuffling on every render (Math.random()) would otherwise yank
// the deck out from under a mid-swipe user.
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function FeedScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const scrollRef = useRef<ScrollView>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [scope, setScope] = useState<FeedScope>('following');

  // Discover's non-post-dependent layers — open games, people to follow, and
  // a light casual-sports strip. Loaded only when Discover is actually in
  // view, same lazy pattern as Groups' own Discover tab.
  const [games, setGames] = useState<OpenGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);
  const [myGoingGameIds, setMyGoingGameIds] = useState<Set<string>>(new Set());
  const [suggestedPeople, setSuggestedPeople] = useState<SuggestedPerson[]>([]);
  const [sportsCards, setSportsCards] = useState<SportsContentCard[]>([]);
  const [followedPersonIds, setFollowedPersonIds] = useState<Set<string>>(new Set());
  // Reseeded on every Discover load/refresh so the mix looks different each
  // time, but held steady in between (see seededShuffle above).
  const [discoverSeed, setDiscoverSeed] = useState(() => Date.now());

  const { streak, onLeavePost } = useReactionStreak();

  const load = useCallback(
    async (isRefresh = false, scopeOverride?: FeedScope) => {
      if (isRefresh) setRefreshing(true);
      try {
        const fetched = await fetchFeed(userId, scopeOverride ?? scope);
        setPosts(fetched);
      } catch (e) {
        Alert.alert('Could not load Feed', errorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, scope]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadDiscoverGames = useCallback(async () => {
    setGamesLoading(true);
    setGamesError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGamesError('Location access is off — turn it on in Settings to see games near you.');
        setGames([]);
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const fetched = await discoverOpenGames(position.coords.latitude, position.coords.longitude);
      // Discover only ever surfaces games still worth showing up for.
      setGames(fetched.filter((g) => g.gameStatus !== 'completed'));
    } catch (e) {
      setGamesError(errorMessage(e, 'Could not load games near you.'));
    } finally {
      setGamesLoading(false);
    }
  }, []);

  const loadDiscoverExtras = useCallback(() => {
    if (!userId) return;
    setDiscoverSeed(Date.now());
    loadDiscoverGames();
    fetchSuggestedPeople(userId).then(setSuggestedPeople).catch(() => setSuggestedPeople([]));
    fetchDiscoverSportsContent().then(setSportsCards).catch(() => setSportsCards([]));
  }, [userId, loadDiscoverGames]);

  useFocusEffect(
    useCallback(() => {
      if (scope === 'discover') loadDiscoverExtras();
    }, [scope, loadDiscoverExtras])
  );

  // Passes the new scope explicitly rather than waiting on the setScope
  // state update to land, so the very next fetch is guaranteed correct.
  const handleScopeChange = (next: FeedScope) => {
    if (next === scope) return;
    setScope(next);
    setLoading(true);
    load(false, next);
    if (next === 'discover') loadDiscoverExtras();
  };

  const handleJoinDiscoverGame = async (game: OpenGame) => {
    if (!userId) return;
    setJoiningGameId(game.id);
    try {
      const result = await joinOpenGame(game.id);
      setMyGoingGameIds((prev) => new Set(prev).add(game.id));
      if (result === 'going') {
        setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, goingCount: g.goingCount + 1 } : g)));
      } else if (result === 'waitlisted') {
        Alert.alert("You're on the waitlist", "This game is full — we'll add you automatically if a spot opens up.");
      } else {
        Alert.alert('Request sent', 'The organizer will review your request to join.');
      }
    } catch (e) {
      Alert.alert('Could not join', errorMessage(e));
    } finally {
      setJoiningGameId(null);
    }
  };

  const handleFollowSuggested = async (personId: string) => {
    if (!userId || followedPersonIds.has(personId)) return;
    // Marks as followed in place rather than removing the card — removing
    // it would shift every later card's index mid-deck, which is jarring
    // if the user swipes past right after tapping Follow.
    setFollowedPersonIds((prev) => new Set(prev).add(personId));
    try {
      await followUser(userId, personId);
    } catch (e) {
      setFollowedPersonIds((prev) => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
      Alert.alert('Could not follow', errorMessage(e));
    }
  };

  // Discover's actual point: it isn't a second copy of Following (which
  // would just look identical with a small user base), and it isn't dead
  // until enough people post. So the deck is games + suggested people +
  // casual-sports content — real inventory that doesn't depend on post
  // volume — with only a light sprinkle of 1-3 actual posts (heat-ranked,
  // via fetchFeed's 'discover' scope) mixed in, not the full unfiltered
  // firehose. Order is seeded-random (see seededShuffle) so it reshuffles
  // on every load/refresh but doesn't jump around mid-swipe.
  const discoverItems = useMemo<DiscoverItem[]>(() => {
    if (scope !== 'discover') return [];

    const sampleCount = (Math.abs(discoverSeed) % 3) + 1; // 1-3
    const sampledPosts = seededShuffle(posts, discoverSeed).slice(0, sampleCount);

    const items: DiscoverItem[] = [
      ...sampledPosts.map((post): DiscoverItem => ({ type: 'post', key: `post-${post.id}`, post })),
      ...games.slice(0, 4).map((game): DiscoverItem => ({ type: 'game', key: `game-${game.id}`, game })),
      ...suggestedPeople.map((person): DiscoverItem => ({ type: 'person', key: `person-${person.id}`, person })),
      ...sportsCards.map((card): DiscoverItem => ({ type: 'sports', key: `sports-${card.id}`, card })),
    ];

    return seededShuffle(items, discoverSeed + 1);
  }, [scope, posts, games, suggestedPeople, sportsCards, discoverSeed]);

  const postOfWeekId = useMemo(() => computePostOfWeekId(posts), [posts]);
  const commentsPost = posts.find((p) => p.id === commentsPostId) ?? null;

  const isPostOfWeek = useCallback((post: Post) => post.id === postOfWeekId, [postOfWeekId]);

  const handleToggleReaction = async (postId: string, type: ReactionType) => {
    if (!userId) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const isActive = post.myReactions.includes(type);
    const next = !isActive;

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const myReactions = next ? [...p.myReactions, type] : p.myReactions.filter((t) => t !== type);
        const reactionCounts = {
          ...p.reactionCounts,
          [type]: Math.max(0, (p.reactionCounts[type] ?? 0) + (next ? 1 : -1)),
        };
        return { ...p, myReactions, reactionCounts };
      })
    );

    try {
      await setReaction(postId, userId, type, next);
    } catch (e) {
      // Revert on failure.
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const myReactions = isActive ? [...p.myReactions, type] : p.myReactions.filter((t) => t !== type);
          const reactionCounts = {
            ...p.reactionCounts,
            [type]: Math.max(0, (p.reactionCounts[type] ?? 0) + (isActive ? 1 : -1)),
          };
          return { ...p, myReactions, reactionCounts };
        })
      );
      Alert.alert('Could not react', errorMessage(e));
    }
  };

  // "Delete" from Feed is a soft-delete: the post moves to the author's
  // private Archive rather than being destroyed. It can still be reshared,
  // promoted to Profile, or permanently deleted from there.
  const handleDeletePost = (post: Post) => {
    Alert.alert('Move this post to your Archive?', "You can reshare it, add it to your Profile, or delete it for good from there.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          const prev = posts;
          setPosts((p) => p.filter((x) => x.id !== post.id));
          try {
            await archivePost(post);
          } catch (e) {
            setPosts(prev);
            Alert.alert('Could not archive post', errorMessage(e));
          }
        },
      },
    ]);
  };

  const handleReportPost = async (post: Post, reason: ReportReason) => {
    if (!userId) return;
    try {
      await reportContent(userId, 'post', post.id, reason);
      Alert.alert('Reported', "Thanks for flagging this — we'll take a look.");
    } catch (e) {
      Alert.alert('Could not send report', errorMessage(e));
    }
  };

  const handleReshare = async (post: Post) => {
    if (!userId) return;
    try {
      await resharePost(post, userId);
      Alert.alert('Reshared', 'A fresh copy is now at the top of your Feed.');
      load();
    } catch (e) {
      Alert.alert('Could not reshare', errorMessage(e));
    }
  };

  const handleBlockUser = (post: Post) => {
    if (!userId) return;
    Alert.alert(`Block ${post.authorName}?`, "You won't see their posts or comments anymore.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(userId, post.authorId);
            load();
          } catch (e) {
            Alert.alert('Could not block user', errorMessage(e));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading} edges={['top']}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scoreboard</Text>
        <AnimatedPressable hitSlop={8} onPress={() => router.push('/find-people')}>
          <Search size={22} color={colors.text} strokeWidth={1.75} />
        </AnimatedPressable>
      </View>

      <View style={styles.scopeRow}>
        <ScopeTab label="Following" active={scope === 'following'} onPress={() => handleScopeChange('following')} styles={styles} />
        <ScopeTab label="Discover" active={scope === 'discover'} onPress={() => handleScopeChange('discover')} styles={styles} />
      </View>

      {userId ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                load(true);
                if (scope === 'discover') loadDiscoverExtras();
              }}
              tintColor={colors.text}
            />
          }
          showsVerticalScrollIndicator={false}>
          {scope === 'discover' ? (
            gamesError && discoverItems.length === 0 ? (
              <Text style={styles.empty}>{gamesError}</Text>
            ) : gamesLoading && discoverItems.length === 0 ? (
              <ActivityIndicator color={colors.textSecondary} style={styles.inlineSpinner} />
            ) : (
              <DiscoverCarousel
                items={discoverItems}
                currentUserId={userId}
                scrollRef={scrollRef}
                isPostOfWeek={isPostOfWeek}
                streak={streak}
                onLeavePost={onLeavePost}
                onToggleReaction={handleToggleReaction}
                onOpenComments={(postId) => setCommentsPostId(postId)}
                onDeletePost={handleDeletePost}
                onReportPost={handleReportPost}
                onBlockPost={handleBlockUser}
                onResharePost={handleReshare}
                onOpenGame={(game) => router.push(`/open-game/${game.id}`)}
                onJoinGame={handleJoinDiscoverGame}
                joiningGameId={joiningGameId}
                myGoingGameIds={myGoingGameIds}
                onFollowPerson={handleFollowSuggested}
                followedPersonIds={followedPersonIds}
              />
            )
          ) : posts.length === 0 ? (
            <Text style={styles.empty}>
              Nothing from people you follow yet. Check Discover, or follow more people from the search icon above.
            </Text>
          ) : (
            <FeedCarousel
              posts={posts}
              currentUserId={userId}
              scrollRef={scrollRef}
              isPostOfWeek={isPostOfWeek}
              streak={streak}
              onLeavePost={onLeavePost}
              onToggleReaction={handleToggleReaction}
              onOpenComments={(postId) => setCommentsPostId(postId)}
              onDelete={handleDeletePost}
              onReport={handleReportPost}
              onBlock={handleBlockUser}
              onReshare={handleReshare}
            />
          )}
        </ScrollView>
      ) : null}

      {userId ? (
        <CommentsModal
          visible={!!commentsPostId}
          postId={commentsPostId}
          postAuthorId={commentsPost?.authorId ?? null}
          userId={userId}
          onClose={() => setCommentsPostId(null)}
          onCommentAdded={() => load()}
          onUserBlocked={() => load()}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ScopeTab({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <AnimatedPressable style={[styles.scopeTab, active && styles.scopeTabActive]} onPress={onPress} hitSlop={4}>
      <Text style={[styles.scopeTabText, active && styles.scopeTabTextActive]}>{label}</Text>
    </AnimatedPressable>
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
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 20, fontWeight: WEIGHT.bold, color: colors.text },
    scopeRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    scopeTab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: RADII.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    scopeTabActive: { backgroundColor: colors.text, borderColor: colors.text },
    scopeTabText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.textSecondary },
    scopeTabTextActive: { color: colors.background },
    list: { paddingBottom: 40 },
    inlineSpinner: { marginTop: 60 },
    empty: {
      marginTop: 60,
      textAlign: 'center',
      fontStyle: 'italic',
      color: colors.textSecondary,
      paddingHorizontal: 30,
    },
  });
}
