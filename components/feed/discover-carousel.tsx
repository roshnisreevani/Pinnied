import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, type ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CARD_HEIGHT, CARD_WIDTH } from '@/components/feed/card-layout';
import { GameSwipeCard, PersonSwipeCard, SportsSwipeCard } from '@/components/feed/discover-extras';
import { FeedEndCard } from '@/components/feed/feed-end-card';
import { PositionDots } from '@/components/feed/position-dots';
import { SessionPostCard } from '@/components/feed/session-post-card';
import { errorMessage } from '@/lib/error-message';
import { ON_ACCENT, ON_DARK_SURFACE, RADII, WEIGHT } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import type { SuggestedPerson } from '@/lib/follows';
import type { ReportReason } from '@/lib/moderation';
import type { OpenGame } from '@/lib/open-games';
import type { Post } from '@/lib/posts';
import type { ReactionType } from '@/lib/reactions';
import { sendPostToPosterDm } from '@/lib/send-to-banter';
import type { SportsContentCard } from '@/lib/sports-content';

/**
 * One swipeable item in Discover's deck — a real post, an open game, a
 * suggested person, or a casual-sports card, all sharing the same
 * swipe-right-to-advance interaction as Following's post carousel. This is
 * Discover's actual point: it isn't a second copy of Following, and it isn't
 * dead until enough people post — games/people/sports content are real
 * inventory mixed in alongside a light sprinkle of posts.
 */
export type DiscoverItem =
  | { type: 'post'; key: string; post: Post }
  | { type: 'game'; key: string; game: OpenGame }
  | { type: 'person'; key: string; person: SuggestedPerson }
  | { type: 'sports'; key: string; card: SportsContentCard };

const H_SWIPE_THRESHOLD = 70;
const V_SWIPE_THRESHOLD = 70;
const SLIDE_OUT_MS = 100;

const DECISIVE_SPRING = {
  damping: 26,
  stiffness: 420,
  mass: 0.8,
  overshootClamping: true,
} as const;

type Props = {
  items: DiscoverItem[];
  currentUserId: string;
  scrollRef?: React.RefObject<GHScrollView | null>;
  isPostOfWeek: (post: Post) => boolean;
  streak: number;
  onLeavePost: (postId: string, hasFireReaction: boolean) => void;
  onToggleReaction: (postId: string, type: ReactionType) => void;
  onOpenComments: (postId: string) => void;
  onDeletePost: (post: Post) => void;
  onReportPost: (post: Post, reason: ReportReason) => void;
  onBlockPost: (post: Post) => void;
  onResharePost: (post: Post) => void;
  onOpenGame: (game: OpenGame) => void;
  onJoinGame: (game: OpenGame) => void;
  joiningGameId: string | null;
  myGoingGameIds: Set<string>;
  onFollowPerson: (personId: string) => void;
  followedPersonIds: Set<string>;
};

export function DiscoverCarousel({
  items,
  currentUserId,
  scrollRef,
  isPostOfWeek,
  streak,
  onLeavePost,
  onToggleReaction,
  onOpenComments,
  onDeletePost,
  onReportPost,
  onBlockPost,
  onResharePost,
  onOpenGame,
  onJoinGame,
  joiningGameId,
  myGoingGameIds,
  onFollowPerson,
  followedPersonIds,
}: Props) {
  const router = useRouter();
  const colors = useThemeColors();
  const [activeIndex, setActiveIndex] = useState(0);
  const [arrowDirection, setArrowDirection] = useState<'left' | 'right' | null>(null);
  const [banterMessage, setBanterMessage] = useState<string | null>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const arrowOpacity = useSharedValue(0);
  const arrowScale = useSharedValue(0.6);
  const banterOpacity = useSharedValue(0);

  const isEndCard = activeIndex === items.length;
  const activeItem = isEndCard ? null : items[activeIndex];

  // Preload the neighboring posts' photos, same idea as Following's
  // carousel — only ever the immediate post neighbors, other card types
  // have no media to prefetch.
  useEffect(() => {
    const neighborUrls = [items[activeIndex + 1], items[activeIndex - 1]]
      .map((item) => (item?.type === 'post' ? item.post.mediaUrl : null))
      .filter((uri): uri is string => !!uri);
    if (neighborUrls.length > 0) {
      ExpoImage.prefetch(neighborUrls).catch(() => {});
    }
  }, [activeIndex, items]);

  const finishTransition = (direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? activeIndex + 1 : activeIndex - 1;
    setActiveIndex(newIndex);
    translateX.value = direction === 'left' ? CARD_WIDTH : -CARD_WIDTH;
    translateX.value = withSpring(0, DECISIVE_SPRING);
    cardOpacity.value = withTiming(1, { duration: 110 });
  };

  const triggerTransition = (direction: 'left' | 'right') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const leaving = items[activeIndex];
    if (leaving?.type === 'post') onLeavePost(leaving.post.id, leaving.post.myReactions.includes('🔥'));

    setArrowDirection(direction);
    arrowOpacity.value = withSequence(withTiming(1, { duration: 70 }), withDelay(50, withTiming(0, { duration: 80 })));
    arrowScale.value = withSequence(
      withTiming(1.15, { duration: 70, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) })
    );

    const exitX = direction === 'left' ? -CARD_WIDTH : CARD_WIDTH;
    translateX.value = withTiming(exitX, { duration: SLIDE_OUT_MS, easing: Easing.out(Easing.quad) });
    cardOpacity.value = withTiming(0.25, { duration: SLIDE_OUT_MS }, (finished) => {
      if (finished) runOnJS(finishTransition)(direction);
    });
  };

  const showBanterBanner = (message: string) => {
    setBanterMessage(message);
    banterOpacity.value = withTiming(1, { duration: 120 });
    setTimeout(() => {
      banterOpacity.value = withTiming(0, { duration: 200 });
      setTimeout(() => setBanterMessage(null), 220);
    }, 1300);
  };

  // Swipe-up-to-banter only makes sense for an actual post from someone
  // else — every other card type in this deck just ignores the vertical
  // gesture.
  const handleSwipeUpToBanter = async () => {
    if (activeItem?.type !== 'post') return;
    const post = activeItem.post;
    if (post.authorId === currentUserId) {
      showBanterBanner("That's your own post — no need to banter yourself");
      return;
    }
    setBanterMessage('Opening Banter…');
    banterOpacity.value = withTiming(1, { duration: 120 });
    try {
      const conversationId = await sendPostToPosterDm(post, currentUserId);
      banterOpacity.value = withTiming(0, { duration: 150 });
      setBanterMessage(null);
      router.push(`/chat/${conversationId}`);
    } catch (e) {
      console.warn('[discover-carousel] swipe-up to banter failed:', e);
      showBanterBanner(errorMessage(e, "Couldn't open Banter."));
    }
  };

  const canGoNext = activeIndex < items.length;
  const canGoPrev = activeIndex > 0;

  let pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .activeOffsetY(-12)
    .failOffsetY(16)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const dy = e.translationY;
      const isVertical = Math.abs(dy) > Math.abs(dx);

      if (isVertical && dy < -V_SWIPE_THRESHOLD) {
        translateX.value = withSpring(0, DECISIVE_SPRING);
        translateY.value = withSpring(0, DECISIVE_SPRING);
        runOnJS(handleSwipeUpToBanter)();
        return;
      }

      if (!isVertical && dx < -H_SWIPE_THRESHOLD && canGoNext) {
        translateY.value = withSpring(0, DECISIVE_SPRING);
        runOnJS(triggerTransition)('left');
        return;
      }

      if (!isVertical && dx > H_SWIPE_THRESHOLD && canGoPrev) {
        translateY.value = withSpring(0, DECISIVE_SPRING);
        runOnJS(triggerTransition)('right');
        return;
      }

      translateX.value = withSpring(0, DECISIVE_SPRING);
      translateY.value = withSpring(0, DECISIVE_SPRING);
    });

  if (scrollRef) {
    pan = pan.blocksExternalGesture(scrollRef as unknown as React.RefObject<React.ComponentType>);
  }

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value * 0.4 }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
    transform: [{ scale: arrowScale.value }],
  }));

  const banterBannerStyle = useAnimatedStyle(() => ({
    opacity: banterOpacity.value,
  }));

  const nextItem = items[activeIndex + 1] ?? null;
  const nextImageUrl = nextItem?.type === 'post' ? nextItem.post.mediaUrl : null;

  const renderCard = () => {
    if (isEndCard || !activeItem) return <FeedEndCard />;

    switch (activeItem.type) {
      case 'post':
        return (
          <SessionPostCard
            post={activeItem.post}
            currentUserId={currentUserId}
            isPostOfWeek={isPostOfWeek(activeItem.post)}
            streak={streak}
            onToggleReaction={(type) => onToggleReaction(activeItem.post.id, type)}
            onOpenComments={() => onOpenComments(activeItem.post.id)}
            onOpenPost={() =>
              activeItem.post.highlightClipId
                ? router.push(`/highlight/${activeItem.post.highlightClipId}?readonly=1`)
                : router.push(`/post/${activeItem.post.id}`)
            }
            onDelete={() => onDeletePost(activeItem.post)}
            onReport={(reason) => onReportPost(activeItem.post, reason)}
            onBlock={() => onBlockPost(activeItem.post)}
            onReshare={() => onResharePost(activeItem.post)}
          />
        );
      case 'game':
        return (
          <GameSwipeCard
            game={activeItem.game}
            onPress={() => onOpenGame(activeItem.game)}
            onJoin={() => onJoinGame(activeItem.game)}
            joining={joiningGameId === activeItem.game.id}
            alreadyGoing={myGoingGameIds.has(activeItem.game.id)}
          />
        );
      case 'person':
        return (
          <PersonSwipeCard
            person={activeItem.person}
            onPress={() => router.push(`/user/${activeItem.person.id}`)}
            onFollow={() => onFollowPerson(activeItem.person.id)}
            following={followedPersonIds.has(activeItem.person.id)}
          />
        );
      case 'sports':
        return <SportsSwipeCard card={activeItem.card} />;
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dotsWrap}>
        <PositionDots count={items.length} activeIndex={activeIndex} />
      </View>

      <View style={styles.stage}>
        {nextImageUrl ? (
          <View style={styles.peekWrap} pointerEvents="none">
            <ExpoImage source={{ uri: nextImageUrl }} style={styles.peekImage} contentFit="cover" cachePolicy="memory-disk" />
          </View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.activeCardWrap, cardStyle]}>{renderCard()}</Animated.View>
        </GestureDetector>

        {arrowDirection ? (
          <Animated.View style={[styles.arrowWrap, arrowStyle]} pointerEvents="none">
            <Text style={styles.arrowText}>{arrowDirection === 'left' ? '→' : '←'}</Text>
          </Animated.View>
        ) : null}

        {banterMessage ? (
          <Animated.View style={[styles.banterBanner, banterBannerStyle]} pointerEvents="none">
            <Text style={styles.banterBannerText}>{banterMessage}</Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, alignItems: 'center' },
  dotsWrap: { marginBottom: 10 },
  stage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekWrap: {
    position: 'absolute',
    width: CARD_WIDTH * 0.94,
    height: CARD_HEIGHT * 0.94,
    borderRadius: RADII.lg,
    overflow: 'hidden',
    top: 10,
    right: -14,
    transform: [{ rotate: '4deg' }],
    opacity: 0.55,
  },
  peekImage: { width: '100%', height: '100%' },
  activeCardWrap: {
    position: 'absolute',
    width: CARD_WIDTH,
  },
  arrowWrap: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 26, color: ON_DARK_SURFACE, fontWeight: WEIGHT.bold },
  banterBanner: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: RADII.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  banterBannerText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: ON_ACCENT },
});
