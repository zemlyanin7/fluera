import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HeartButton } from '@/components/reader/HeartButton';

describe('HeartButton', () => {
  it('renders outline when saved=false', () => {
    const { getByRole } = render(<HeartButton saved={false} onToggle={() => {}} />);
    expect(getByRole('button').props.accessibilityState?.selected).toBe(false);
  });

  it('renders filled when saved=true', () => {
    const { getByRole } = render(<HeartButton saved={true} onToggle={() => {}} />);
    expect(getByRole('button').props.accessibilityState?.selected).toBe(true);
  });

  it('press calls onToggle', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(<HeartButton saved={false} onToggle={onToggle} />);
    fireEvent.press(getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
  });
});
