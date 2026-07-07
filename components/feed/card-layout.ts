import { Dimensions } from 'react-native';

// Shared sizing for every "full card" in Feed's session-based layout —
// swipeable post cards, the Locker Room transition, and the end-of-feed
// card all use the same footprint so the whole vertical flow feels like one
// consistent object type, just with different content.
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CARD_WIDTH = SCREEN_WIDTH - 64;
export const CARD_HEIGHT = Math.min(560, CARD_WIDTH * 1.5);
export const CARD_PEEK = 18; // how much of the next card shows behind the active one
