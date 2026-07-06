import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const PIECE_COUNT = 18;
const COLORS_POOL = ['#FF5A36', '#FFC24B', '#4BD0A0', '#4B9DFF', '#FF4BD0'];

type Props = {
  // Bumping this key re-triggers the burst (e.g. incrementing a counter on
  // every new trophy add).
  triggerKey: number;
};

/**
 * A quick one-shot confetti burst, purely Reanimated-driven (no extra
 * dependency). Meant to be layered on top of the trophy that was just
 * unlocked, then discarded — it doesn't loop.
 */
export function ConfettiBurst({ triggerKey }: Props) {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }).map((_, i) => ({
        id: i,
        color: COLORS_POOL[i % COLORS_POOL.length],
        angle: (i / PIECE_COUNT) * Math.PI * 2 + Math.random() * 0.4,
        distance: 40 + Math.random() * 36,
        delay: Math.random() * 60,
        rotate: Math.random() * 360,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [triggerKey]
  );

  return (
    <View style={styles.wrap} pointerEvents="none">
      {pieces.map((p) => (
        <ConfettiPiece key={`${triggerKey}-${p.id}`} piece={p} />
      ))}
    </View>
  );
}

type Piece = { id: number; color: string; angle: number; distance: number; delay: number; rotate: number };

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(piece.delay, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const dx = Math.cos(piece.angle) * piece.distance * progress.value;
    const dy = Math.sin(piece.angle) * piece.distance * progress.value - 10 * progress.value;
    return {
      opacity: 1 - progress.value,
      transform: [
        { translateX: dx },
        { translateY: dy },
        { rotate: `${piece.rotate * progress.value}deg` },
        { scale: 1 - progress.value * 0.3 },
      ],
    };
  });

  return <Animated.View style={[styles.piece, { backgroundColor: piece.color }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  piece: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 2,
  },
});
