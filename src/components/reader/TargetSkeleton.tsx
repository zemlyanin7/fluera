import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';

interface Props {
  sourceLength: number;
}

export function TargetSkeleton({ sourceLength }: Props) {
  const { theme } = useUnistyles();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const lines = Math.min(3, Math.max(1, Math.ceil(sourceLength / 60)));
  const widths = ['100%', '92%', '64%'].slice(0, lines);

  return (
    <>
      {widths.map((w, i) => (
        <Animated.View
          key={i}
          style={[
            {
              height: 18,
              borderRadius: 4,
              width: w as any,
              backgroundColor: theme.accentSoft,
              marginBottom: i < lines - 1 ? 6 : 0,
            },
            animStyle,
          ]}
        />
      ))}
    </>
  );
}
