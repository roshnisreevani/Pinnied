// The Rec's brand style — "Varsity Jacket": navy + brick red on a warm
// cream/near-navy neutral, replacing the earlier stark white/black +
// primary red/blue combo. Chosen to read like an old gym or a letterman
// jacket — nostalgic, friend-group, casual — rather than a scoreboard/tech
// app, per the app's own "not ESPN" framing. Applies to Profile, Settings,
// and Auth. Light/dark values live here; components read the active
// palette via useThemeColors() rather than a static import, so everything
// reacts to the Dark Mode toggle in Settings.

export type ThemeColors = {
  background: string; // page/card surface color
  text: string; // primary text, icons, borders on outlined elements
  textSecondary: string; // secondary/quiet text
  border: string; // hairline borders, dividers
  borderSoft: string; // even quieter dividers (e.g. row separators)
  coral: string; // primary accent ("red", brick) — buttons, active states,
  // highlights, high-energy elements like the 🔥 reaction and "HOT" badges
  blue: string; // secondary accent ("blue", navy) — informational/connection
  // elements: links, comment counts, the "no way" reaction, anything
  // connections-related
  danger: string; // destructive actions
};

export const LIGHT_COLORS: ThemeColors = {
  background: '#F7F3EA',
  text: '#1F2430',
  textSecondary: '#8A8578',
  border: '#E4DFD2',
  borderSoft: '#EEEAD9',
  coral: '#A3352B',
  blue: '#1C2340',
  danger: '#8F2A22',
};

export const DARK_COLORS: ThemeColors = {
  background: '#12141F',
  text: '#F2EFE6',
  textSecondary: '#9A9284',
  border: '#2A2C36',
  borderSoft: '#242631',
  coral: '#C1503F',
  blue: '#4A5FA0',
  danger: '#E2645A',
};

export const WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const RADII = {
  sm: 8,
  md: 10,
  lg: 13,
  pill: 999,
} as const;

// Vertical rhythm scale — before this, every screen's author eyeballed
// section margins independently (26/22/18/16/14 all meaning "space before
// the next block" in different files), so structurally identical layouts
// (Profile, Settings, Archive, highlight detail) all felt slightly
// different for no real reason. Use these instead of bare numbers for
// section gaps, card padding, and row gaps.
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

// Named type scale — same problem as spacing: "screen title" alone existed
// at 13/16/20/24px across the app, and "muted caption" text existed at
// 11/12/13px with no rule for which. Roles below map to how each size is
// actually used:
//   caption   — timestamps, muted metadata, tiny labels under an icon
//   label     — section titles, tab labels, form field labels
//   body      — default readable text (comments, messages, descriptions)
//   bodyLarge — emphasized body text, card titles
//   subtitle  — screen header titles (the "Archive" / "Roast" in a nav bar)
//   title     — big on-screen headings (empty-state titles, feature titles)
//   display   — hero moments (auth wordmark)
export const TYPE = {
  caption: 11,
  label: 13,
  body: 15,
  bodyLarge: 16,
  subtitle: 17,
  title: 20,
  display: 32,
} as const;

export const HAIRLINE = 1;

// White reads legibly on both light and dark coral (and on navy blue), so
// text/icons drawn on top of an accent-filled element (buttons, the pulsing
// play button, etc.) always use this fixed white — not the theme's
// `background`, which flips to near-navy-black in dark mode and would
// otherwise land wrong-on-accent there.
export const ON_ACCENT = '#FFFFFF';

// Fixed gold used for "legendary"/standout highlights (the Trophy Case's
// legendary slot, Feed's Post of the Week badge). Theme-independent
// for the same reason as ON_ACCENT above.
export const GOLD = '#D4AF37';

// Fixed near-navy-black "locker room" surface used by Feed's session
// headers, transition cards, and end-of-feed card — these are deliberately
// dark in both light and dark mode (a consistent "tunnel" break between
// sessions), so like ON_ACCENT/GOLD this doesn't come from the theme
// palette. Tinted navy rather than flat black to tie into the Varsity
// Jacket palette's navy accent.
export const DARK_SURFACE = '#161A2C';
export const ON_DARK_SURFACE = '#FFFFFF';
export const ON_DARK_SURFACE_SECONDARY = '#9A968C';

// The app deliberately uses the system font everywhere (via plain
// `fontWeight` + WEIGHT above) rather than a custom typeface — a prior
// Urbanist/Permanent Marker setup (FONTS.*) was only ever applied to a
// handful of screens, creating visual inconsistency with the rest of the
// app, and has been removed in favor of one consistent look throughout.
