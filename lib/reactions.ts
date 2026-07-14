// A reaction "type" is just the emoji itself now — the 3 presets below plus
// whatever emoji someone picks from their keyboard via the long-press picker
// (see ReactionBar). Kept as its own alias (rather than inlining `string`)
// so call sites read as intentional, even though it's unconstrained.
export type ReactionType = string;

export type ReactionAccent = 'red' | 'blue' | 'neutral';

export type ReactionMeta = {
  type: ReactionType;
  emoji: string;
  label: string;
  // Which shared accent (see constants/style.ts) this reaction's active state
  // uses. "red" -> colors.coral, "blue" -> colors.blue, "neutral" -> colors.text.
  accent: ReactionAccent;
};

// The curated, always-shown pills — order here is their display order.
// Any other emoji a user picks shows up as an extra pill alongside these
// (see ReactionBar), it just isn't pinned/labeled like these four.
export const REACTIONS: ReactionMeta[] = [
  { type: 'thumbs_up', emoji: '👍', label: 'thumbs up', accent: 'blue' },
  { type: 'lol', emoji: '😂', label: 'lol', accent: 'neutral' },
  { type: 'goat', emoji: '🐐', label: 'goat', accent: 'red' },
];

export function reactionMeta(type: ReactionType): ReactionMeta {
  return REACTIONS.find((r) => r.type === type) ?? REACTIONS[0];
}

// Longest emoji a user can add via the custom picker (generous — covers
// multi-codepoint sequences like flags/skin-tone variants). Matches the
// post_reactions_type_check DB constraint.
export const MAX_CUSTOM_REACTION_LENGTH = 16;

// The "+" picker's full searchable emoji set now lives in lib/emoji-data.ts
// (EMOJI_DATA) — tagged with names/keywords so ReactionBar can filter it by
// search text, not just show a fixed grid.

// A post crossing this many total reactions gets the red "HOT" badge.
export const HOT_THRESHOLD = 25;

// "Post of the Week" looks at total reactions within this rolling window.
export const POST_OF_WEEK_WINDOW_DAYS = 7;
