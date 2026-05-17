import React from 'react';
import { render } from '@testing-library/react-native';
import { TargetSkeleton } from '@/components/reader/TargetSkeleton';
import Animated from 'react-native-reanimated';

describe('TargetSkeleton', () => {
  it('renders 3 lines когда sourceLength > 120', () => {
    const { UNSAFE_getAllByType } = render(<TargetSkeleton sourceLength={200} />);
    const animatedViews = UNSAFE_getAllByType(Animated.View);
    expect(animatedViews.length).toBe(3);
  });

  it('renders 1 line при small source', () => {
    const { UNSAFE_getAllByType } = render(<TargetSkeleton sourceLength={20} />);
    const animatedViews = UNSAFE_getAllByType(Animated.View);
    expect(animatedViews.length).toBe(1);
  });
});
