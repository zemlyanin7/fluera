import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Popover } from '@/components/ui/Popover';

describe('Popover', () => {
  it('renders children when visible=true', () => {
    const { getByText } = render(
      <Popover visible={true} placement="bottom" anchorRect={{ x: 100, y: 200, width: 50, height: 20 }} onDismiss={() => {}}>
        <Text>Popover content</Text>
      </Popover>,
    );
    expect(getByText('Popover content')).toBeTruthy();
  });

  it('renders nothing when visible=false', () => {
    const { queryByText } = render(
      <Popover visible={false} placement="bottom" anchorRect={{ x: 0, y: 0, width: 0, height: 0 }} onDismiss={() => {}}>
        <Text>Hidden</Text>
      </Popover>,
    );
    expect(queryByText('Hidden')).toBeNull();
  });
});
