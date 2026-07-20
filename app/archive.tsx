import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Trophy } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostThumbnailGrid } from '@/components/feed/post-thumbnail-grid';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { RADII, SPACING, TYPE, WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { ARCHIVE_WINDOW_DAYS } from '@/lib/archive';
import { errorMessage } from '@/lib/error-message';
import {
  deleteHighlightClip,
  fetchArchivedHighlightClips,
  unarchiveHighlightClip,
  type HighlightClip,
} from '@/lib/highlights';
import {
  deletePost,
  featurePost,
  fetchArchivedPosts,
  fetchFeaturedPostIds,
  resharePost,
  unfeaturePost,
  type Post,
} from '@/lib/posts';

type ArchiveTab = 'posts' | 'highlights';

/**
 * Browse + manage your own aged-out or manually-deleted posts. Nothing here
 * is public — this is deliberately a quiet personal scrapbook, not a
 * curated space with a decision attached. From here you can reshare a post
 * (posts a fresh copy to Feed), add/remove it from your Profile's Featured
 * section, or delete it for good.
 */
export default function ArchiveScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<ArchiveTab>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const [highlights, setHighlights] = useState<HighlightClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
    if (!userId) return;
    if (isRefresh) setRefreshing(true);
    try {
      const [fetchedPosts, fetchedFeaturedIds, fetchedHighlights] = await Promise.all([
        fetchArchivedPosts(userId),
        fetchFeaturedPostIds(userId),
        fetchArchivedHighlightClips(userId),
      ]);
      setPosts(fetchedPosts);
      setFeaturedIds(fetchedFeaturedIds);
      setHighlights(fetchedHighlights);
    } catch (e) {
      Alert.alert('Could not load Archive', errorMessage(e));
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

  const handleToggleFeatured = async (post: Post) => {
    if (!userId) return;
    const isFeatured = featuredIds.has(post.id);
    const prev = featuredIds;
    const next = new Set(featuredIds);
    isFeatured ? next.delete(post.id) : next.add(post.id);
    setFeaturedIds(next);
    try {
      if (isFeatured) {
        await unfeaturePost(userId, post.id);
      } else {
        await featurePost(userId, post.id);
      }
    } catch (e) {
      setFeaturedIds(prev);
      Alert.alert('Could not update Profile', errorMessage(e));
    }
  };

  const handleReshare = (post: Post) => {
    if (!userId) return;
    Alert.alert('Reshare this post?', 'Posts a fresh copy to Feed. The original stays right here in Archive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reshare',
        onPress: async () => {
          try {
            await resharePost(post, userId);
            Alert.alert('Reshared', 'Check your Feed — the fresh copy is live.');
          } catch (e) {
            Alert.alert('Could not reshare post', errorMessage(e));
          }
        },
      },
    ]);
  };

  const handleDeleteForever = (post: Post) => {
    Alert.alert('Delete this post forever?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: async () => {
          const prev = posts;
          setPosts((p) => p.filter((x) => x.id !== post.id));
          try {
            await deletePost(post);
          } catch (e) {
            setPosts(prev);
            Alert.alert('Could not delete post', errorMessage(e));
          }
        },
      },
    ]);
  };

  const handlePressPost = (post: Post) => {
    const isFeatured = featuredIds.has(post.id);
    Alert.alert('Post options', undefined, [
      {
        text: isFeatured ? 'Remove from Profile' : 'Add to Profile',
        onPress: () => handleToggleFeatured(post),
      },
      { text: 'Reshare', onPress: () => handleReshare(post) },
      { text: 'Delete forever', style: 'destructive', onPress: () => handleDeleteForever(post) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRestoreHighlight = async (clip: HighlightClip) => {
    const prev = highlights;
    setHighlights((h) => h.filter((x) => x.id !== clip.id));
    try {
      await unarchiveHighlightClip(clip.id);
    } catch (e) {
      setHighlights(prev);
      Alert.alert('Could not restore clip', errorMessage(e));
    }
  };

  const handleDeleteHighlightForever = (clip: HighlightClip) => {
    Alert.alert('Delete this clip forever?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: async () => {
          const prev = highlights;
          setHighlights((h) => h.filter((x) => x.id !== clip.id));
          try {
            await deleteHighlightClip(clip.id);
          } catch (e) {
            setHighlights(prev);
            Alert.alert('Could not delete clip', errorMessage(e));
          }
        },
      },
    ]);
  };

  const handlePressHighlight = (clip: HighlightClip) => {
    Alert.alert(clip.mode === 'roast' ? 'Roast options' : 'Critique options', undefined, [
      { text: 'View', onPress: () => router.push(`/highlight/${clip.id}`) },
      { text: 'Restore (unarchive)', onPress: () => handleRestoreHighlight(clip) },
      { text: 'Delete forever', style: 'destructive', onPress: () => handleDeleteHighlightForever(clip) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={26} color={colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Archive</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabRow}>
        <AnimatedPressable style={[styles.tabButton, tab === 'posts' && styles.tabButtonActive]} onPress={() => setTab('posts')}>
          <Text style={[styles.tabButtonText, tab === 'posts' && styles.tabButtonTextActive]}>Posts</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.tabButton, tab === 'highlights' && styles.tabButtonActive]}
          onPress={() => setTab('highlights')}>
          <Text style={[styles.tabButtonText, tab === 'highlights' && styles.tabButtonTextActive]}>Highlights</Text>
        </AnimatedPressable>
      </View>

      {tab === 'posts' ? (
        <>
          <Text style={styles.subtitle}>
            Posts quietly move here after {ARCHIVE_WINDOW_DAYS} days, or whenever you delete one from Feed. Private
            to you — never public. Tap a post for options.
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.text} style={styles.spinner} />
          ) : posts.length === 0 ? (
            <Text style={styles.empty}>Nothing archived yet.</Text>
          ) : (
            <ScrollView
              contentContainerStyle={styles.grid}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.text} />
              }>
              <PostThumbnailGrid posts={posts} colors={colors} onPressItem={handlePressPost} />
            </ScrollView>
          )}
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Roasts and Critiques you've archived. Private to you — never public. Tap one for options.
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.text} style={styles.spinner} />
          ) : highlights.length === 0 ? (
            <Text style={styles.empty}>No archived highlights yet.</Text>
          ) : (
            <ScrollView
              contentContainerStyle={styles.highlightList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.text} />
              }>
              {highlights.map((clip) => (
                <AnimatedPressable
                  key={clip.id}
                  style={styles.highlightCard}
                  onPress={() => handlePressHighlight(clip)}>
                  <View style={styles.highlightIcon}>
                    <Trophy size={16} color={colors.coral} strokeWidth={2} />
                  </View>
                  <View style={styles.highlightInfo}>
                    <Text style={styles.highlightTitle}>
                      {clip.mode === 'roast' ? 'Roast' : 'Critique'}
                      {clip.sport ? ` · ${clip.sport}` : ''}
                    </Text>
                    <Text style={styles.highlightSubtitle} numberOfLines={1}>
                      {clip.overallText ?? 'Archived clip'}
                    </Text>
                  </View>
                </AnimatedPressable>
              ))}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
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
    tabRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: SPACING.md,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingVertical: 8,
    },
    tabButtonActive: { backgroundColor: colors.coral, borderColor: colors.coral },
    tabButtonText: { fontSize: TYPE.caption, fontWeight: WEIGHT.semibold, color: colors.text },
    tabButtonTextActive: { color: '#FFFFFF' },
    subtitle: {
      fontSize: TYPE.caption,
      color: colors.textSecondary,
      paddingHorizontal: 20,
      paddingTop: SPACING.md,
      paddingBottom: 4,
    },
    spinner: { marginTop: 30 },
    grid: { padding: 16, flexGrow: 1 },
    highlightList: { padding: 16, gap: 10, flexGrow: 1 },
    highlightCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      padding: 12,
    },
    highlightIcon: {
      width: 36,
      height: 36,
      borderRadius: RADII.pill,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    highlightInfo: { flex: 1, gap: 2 },
    highlightTitle: { fontSize: TYPE.label, fontWeight: WEIGHT.semibold, color: colors.text },
    highlightSubtitle: { fontSize: TYPE.caption, color: colors.textSecondary },
    empty: { marginTop: 40, textAlign: 'center', fontSize: TYPE.body, color: colors.textSecondary, paddingHorizontal: 24 },
  });
}
