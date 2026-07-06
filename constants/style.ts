// The Rec's brand style — clean, neutral, one accent color used sparingly.
// Applies to Profile, Settings, and Auth. Light/dark values live here;
// components read the active palette via useThemeColors() rather than a
// static import, so everything reacts to the Dark Mode toggle in Settings.

export type ThemeColors = {
  background: string; // page/card surface color
  text: string; // primary text, icons, borders on outlined elements
  textSecondary: string; // secondary/quiet text
  border: string; // hairline borders, dividers
  borderSoft: string; // even quieter dividers (e.g. row separators)
  coral: string; // the one accent color — buttons, active states, highlights
  danger: string; // destructive actions
};

export const LIGHT_COLORS: ThemeColors = {
  background: '#FFFFFF',
  text: '#14141A',
  textSecondary: '#8A8578',
  border: '#DEDCD6',
  borderSoft: '#EEEDEA',
  coral: '#FF5A36',
  danger: '#D92626',
};

export const DARK_COLORS: ThemeColors = {
  background: '#000000',
  text: '#FFFFFF',
  textSecondary: '#8A8A8A',
  border: '#2A2A2A',
  borderSoft: '#3A3A3A',
  coral: '#FF5A36',
  danger: '#FF6B5E',
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

export const HAIRLINE = 1;

// Coral doesn't change between themes, so text/icons drawn on top of a
// coral-filled element (buttons, the pulsing play button, etc.) should
// always be this fixed white — not the theme's `background`, which flips
// to black in dark mode and would otherwise land black-on-coral there.
export const ON_ACCENT = '#FFFFFF';
