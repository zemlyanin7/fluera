import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Sheet, SheetRef } from '@/components/ui/Sheet';

describe('Sheet', () => {
  test('renders children', () => {
    const { getByText } = render(<Sheet snapPoints={['50%']}><Text>Inside</Text></Sheet>);
    expect(getByText('Inside')).toBeTruthy();
  });
  test('ref pass-through', () => {
    const ref = React.createRef<SheetRef>();
    render(<Sheet ref={ref} snapPoints={['50%']}><Text>x</Text></Sheet>);
    expect(ref).toBeTruthy();
  });
});
