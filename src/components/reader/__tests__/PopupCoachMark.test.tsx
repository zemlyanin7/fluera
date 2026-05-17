import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PopupCoachMark } from '@/components/reader/PopupCoachMark';

describe('PopupCoachMark', () => {
  it('renders hint text + 2 buttons', () => {
    const { getByText } = render(<PopupCoachMark onSkip={() => {}} onAcknowledge={() => {}} />);
    // EN: "Hold your finger on a word..." / RU: "Удержите палец..."
    expect(getByText(/hold|long.press|удержание|удержите/i)).toBeTruthy();
    expect(getByText(/Skip|Пропустить/i)).toBeTruthy();
    expect(getByText(/Got it|Понятно/i)).toBeTruthy();
  });

  it('Skip calls onSkip', () => {
    const onSkip = jest.fn();
    const { getByText } = render(<PopupCoachMark onSkip={onSkip} onAcknowledge={() => {}} />);
    fireEvent.press(getByText(/Skip|Пропустить/i));
    expect(onSkip).toHaveBeenCalled();
  });
});
