import { GOLD, type ThemeColors } from '@/constants/style';
import type { HighlightMode } from '@/lib/highlights';

/**
 * Shared label/color mapping for AI highlight personas — used wherever a
 * highlight's mode needs a badge/ring color (the highlight detail screen,
 * the share-review sheet, and the Feed "trading card" post treatment).
 */
export const AI_MODE_LABEL: Record<HighlightMode, string> = {
  roast: 'Roast',
  hype: 'Hype man',
  commentator: 'Commentator',
  critique: 'Critique',
};

export const AI_MODE_COLOR_KEY: Record<HighlightMode, 'coral' | 'blue' | 'gold'> = {
  roast: 'coral',
  hype: 'gold',
  commentator: 'blue',
  critique: 'blue',
};

// posts.ai_mode is stored as plain text (not the narrower HighlightMode
// union), so these two take `string` and fall back to 'roast' for any
// unrecognized value rather than throwing on a missing key.
function normalizeMode(mode: string): HighlightMode {
  return mode in AI_MODE_LABEL ? (mode as HighlightMode) : 'roast';
}

export function aiModeLabel(mode: string): string {
  return AI_MODE_LABEL[normalizeMode(mode)];
}

export function aiModeColor(mode: string, colors: ThemeColors): string {
  const key = AI_MODE_COLOR_KEY[normalizeMode(mode)];
  return key === 'gold' ? GOLD : colors[key];
}

export function aiModeTint(mode: string, colors: ThemeColors): string {
  return aiModeColor(mode, colors) + '18';
}
