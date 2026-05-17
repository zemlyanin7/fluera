import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TabBar } from '@/components/ui/TabBar';

const stub = {
  state: { index: 0, routes: [
    { key: 'index', name: 'index' }, { key: 'deck', name: 'deck' },
    { key: 'stats', name: 'stats' }, { key: 'settings', name: 'settings' },
  ]},
  descriptors: {} as any,
  navigation: {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  } as any,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

describe('TabBar', () => {
  test('renders 4 tabs', () => {
    const { getByText } = render(<TabBar {...(stub as any)} />);
    expect(getByText('READ')).toBeTruthy();
    expect(getByText('DECK')).toBeTruthy();
    expect(getByText('STATS')).toBeTruthy();
    expect(getByText('YOU')).toBeTruthy();
  });
  test('tap calls navigation.navigate', () => {
    const props = { ...stub, navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() } as any };
    const { getByText } = render(<TabBar {...(props as any)} />);
    fireEvent.press(getByText('DECK'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('deck');
  });
});
