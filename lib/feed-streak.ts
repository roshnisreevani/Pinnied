import { useCallback, useRef, useState } from 'react';

// A streak below this isn't really a "streak" worth bragging about yet.
export const STREAK_DISPLAY_THRESHOLD = 2;

/**
 * Tracks a "reacted with fire on N consecutive posts, without skipping any"
 * streak as the user swipes through Feed's session cards. Purely
 * client-side/in-memory (resets on app restart or Feed remount) — this is a
 * lightweight in-session engagement signal, not a persisted stat, so no new
 * table/column was added for it.
 *
 * Call `onLeavePost(postId, hasFireReaction)` once, each time a post stops
 * being the active card in its session carousel (i.e. the user swiped past
 * it) — the streak advances by one if that post got a fire reaction while it
 * was active, or resets to zero if it didn't. Each post is only ever scored
 * once per Feed session, so swiping back and forth over the same card can't
 * inflate the count.
 */
export function useReactionStreak() {
  const [streak, setStreak] = useState(0);
  const scored = useRef<Set<string>>(new Set());

  const onLeavePost = useCallback((postId: string, hasFireReaction: boolean) => {
    if (scored.current.has(postId)) return;
    scored.current.add(postId);
    setStreak((prev) => (hasFireReaction ? prev + 1 : 0));
  }, []);

  return { streak, onLeavePost };
}
