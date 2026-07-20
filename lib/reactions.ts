// A reaction "type" is one of the 10 EMOJI_BANK emoji below — kept as its
// own alias (rather than inlining `string`) so call sites read as
// intentional even though TS itself doesn't narrow it to the literal union.
// The real enforcement is server-side: post_reactions_type_check restricts
// the `type` column to exactly these 10 values, so nothing else can persist
// even if a caller passes something else.
export type ReactionType = string;

// Single source of truth for Feed's reaction picker — this is the ONE
// reaction system the app shows (ReactionBar) and the only 10 values the
// database will accept for a post reaction. Earlier versions of this file
// also had: a dead `REACTIONS` preset (👍😂🐐, never rendered); an 18-word
// bank plus a separate "W" instant-like button (too many tap targets); and
// a search field into the ~170-emoji EMOJI_DATA set (let people react with
// things outside this list, defeating the point of capping it). All three
// removed — this is deliberately closed, not just curated.
export const EMOJI_BANK: string[] = [
  '🔥', '😂', '💀', '😮', '👑', '🥶', '🤝', '😬', '💪', '🏆',
];

// The 3 always-visible "scoreboard" reactions (ReactionBar renders them as
// a live tally — "🔥 12 — 👑 3 — 😮 1" — instead of pills that only appear
// once someone's used them). The other 7 EMOJI_BANK emoji are one tap away
// behind the "+" button. Order matters here: it's the display order.
export const PINNED_REACTIONS = ['🔥', '👑', '😮'];

// How full the live heat meter reads (see HeatMeter) — driven solely by 🔥
// reaction count, nothing else. This replaced a static "🔥 HOT" text badge
// that was tied to *total* reactions of any type, which didn't actually
// reflect the emoji it displayed. Also doubles as the old badge's threshold
// for "post of the week" style prominence.
export const HOT_THRESHOLD = 25;

// "Post of the Week" looks at total reactions within this rolling window.
export const POST_OF_WEEK_WINDOW_DAYS = 7;
