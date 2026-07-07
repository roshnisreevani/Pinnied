import { StyleSheet, View } from 'react-native';

// Approximates a bottom-up black gradient using stacked semi-transparent
// bands, since expo-linear-gradient isn't a dependency of this project.
// Gives the same "legible caption over a photo" effect without adding a
// new package.
const BAND_COUNT = 8;
const MAX_OPACITY = 0.78;

export function GradientScrim({ height = 140 }: { height?: number }) {
  const bandHeight = height / BAND_COUNT;

  return (
    <View style={[styles.wrap, { height }]} pointerEvents="none">
      {Array.from({ length: BAND_COUNT }).map((_, i) => {
        const progress = (i + 1) / BAND_COUNT; // 0 -> 1 toward the bottom
        return (
          <View
            key={i}
            style={{
              height: bandHeight,
              backgroundColor: `rgba(0,0,0,${(progress * MAX_OPACITY).toFixed(2)})`,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
});
