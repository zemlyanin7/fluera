import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { TranslationServiceProvider, useTranslationService } from '../TranslationServiceContext';
import { MockTranslationService } from '../MockTranslationService';

function Consumer() {
  const svc = useTranslationService();
  return <Text>{svc.constructor.name}</Text>;
}

describe('TranslationServiceContext', () => {
  it('provides service to children', () => {
    const svc = new MockTranslationService();
    const { getByText } = render(
      <TranslationServiceProvider service={svc}>
        <Consumer />
      </TranslationServiceProvider>,
    );
    expect(getByText('MockTranslationService')).toBeTruthy();
  });

  it('throws outside provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ConsumerOutside = () => {
      useTranslationService();
      return null;
    };
    expect(() => render(<ConsumerOutside />)).toThrow();
    spy.mockRestore();
  });
});
