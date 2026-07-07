import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsModal } from '@/components/feed/comments-modal';
import { FeedCarousel } from '@/components/feed/feed-carousel';
import { FeedEndCard } from '@/components/feed/feed-end-card';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { useReactionStreak } from '@/lib/feed-streak';
import { blockUser, reportContent, type ReportReason } from '@/lib/moderation';
import { computePostOfWeekId, deletePost, fetchFeed, setReaction, totalReactions, type Post } from '@/lib/posts';
import { HOT_THRESHOLD, type ReactionType } from '@/lib/reactions';

export default function FeedScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  const { streak, onLeavePost } = useReactionStreak();

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const fetched = await fetchFeed(userId);
        setPosts(fetched);
      } catch (e) {
        Alert.alert('Could not load Feed', e instanceof Error ? e.message : 'Unknown error.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const postOfWeekId = useMemo(() => computePostOfWeekId(posts), [posts]);
  const commentsPost = posts.find((p) => p.id === commentsPostId) ?? null;

  const isHot = useCallback((post: Post) => totalReactions(post) >= HOT_THRESHOLD, []);
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
          [type]: Math.max(0, p.reactionCounts[type] + (next ? 1 : -1)),
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
            [type]: Math.max(0, p.reactionCounts[type] + (isActive ? 1 : -1)),
          };
          return { ...p, myReactions, reactionCounts };
        })
      );
      Alert.alert('Could not react', e instanceof Error ? e.message : 'Unknown error.');
    }
  };

  const handleDeletePost = (post: Post) => {
    Alert.alert('Delete this post?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = posts;
          setPosts((p) => p.filter((x) => x.id !== post.id));
          try {
            await deletePost(post);
          } catch (e) {
            setPosts(prev);
            Alert.alert('Could not delete post', e instanceof Error ? e.message : 'Unknown error.');
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
      Alert.alert('Could not send report', e instanceof Error ? e.message : 'Unknown error.');
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
            Alert.alert('Could not block user', e instanceof Error ? e.message : 'Unknown error.');
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
        <Text style={styles.headerTitle}>Feed</Text>
        <AnimatedPressable hitSlop={8} onPress={() => router.push('/find-people')}>
          <Search size={22} color={colors.text} strokeWidth={1.75} />
        </AnimatedPressable>
      </View>

      {userId ? (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.text} />
          }
          showsVerticalScrollIndicator={false}>
          {posts.length === 0 ? (
            <Text style={styles.empty}>
              Nothing on Feed yet. Tap the + tab to post the first play of the week.
            </Text>
          ) : (
            <>
              <FeedCarousel
                posts={posts}
                currentUserId={userId}
                isHot={isHot}
                isPostOfWeek={isPostOfWeek}
                streak={streak}
                onLeavePost={onLeavePost}
                onToggleReaction={handleToggleReaction}
                onOpenComments={(postId) => setCommentsPostId(postId)}
                onDelete={handleDeletePost}
                onReport={handleReportPost}
                onBlock={handleBlockUser}
              />
              <FeedEndCard />
            </>
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
    list: { paddingBottom: 40 },
    empty: {
      marginTop: 60,
      textAlign: 'center',
      fontStyle: 'italic',
      color: colors.textSecondary,
      paddingHorizontal: 30,
    },
  });
}
