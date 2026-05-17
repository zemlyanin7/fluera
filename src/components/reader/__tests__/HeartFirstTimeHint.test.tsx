import React from 'react';
import { render } from '@testing-library/react-native';
import { HeartFirstTimeHint } from '@/components/reader/HeartFirstTimeHint';

describe('HeartFirstTimeHint', () => {
  it('renders only when shown=true', () => {
    const { getByText, rerender, queryByText } = render(
      <HeartFirstTimeHint shown={true} onDismiss={() => {}} />,
    );
    expect(getByText(/♡/i)).toBeTruthy();
    rerender(<HeartFirstTimeHint shown={false} onDismiss={() => {}} />);
    expect(queryByText(/♡/i)).toBeNull();
  });
});
