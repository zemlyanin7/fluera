import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';
import { Text } from 'react-native';

describe('Button', () => {
  test('renders children', () => {
    const { getByText } = render(<Button onPress={() => {}}>Click me</Button>);
    expect(getByText('Click me')).toBeTruthy();
  });
  test('onPress fires', () => {
    const fn = jest.fn();
    const { getByText } = render(<Button onPress={fn}>Tap</Button>);
    fireEvent.press(getByText('Tap'));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  test('disabled prevents onPress', () => {
    const fn = jest.fn();
    const { getByText } = render(<Button onPress={fn} disabled>Tap</Button>);
    fireEvent.press(getByText('Tap'));
    expect(fn).not.toHaveBeenCalled();
  });
  test('icon renders', () => {
    const { getByTestId } = render(
      <Button onPress={() => {}} icon={<Text testID="ic">*</Text>}>Save</Button>
    );
    expect(getByTestId('ic')).toBeTruthy();
  });
  test.each(['primary','accent','ghost'] as const)('variant=%s', (variant) => {
    const { getByText } = render(<Button onPress={() => {}} variant={variant}>Btn</Button>);
    expect(getByText('Btn')).toBeTruthy();
  });
});
