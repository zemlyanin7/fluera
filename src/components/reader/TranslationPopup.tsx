import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { Sheet, type SheetRef, Headline } from '@/components/ui';

export type TranslationPopupState =
  | { kind: 'closed' }
  | { kind: 'opening'; word: string; sentence: string }
  | { kind: 'pending'; word: string; sentence: string }
  | { kind: 'success'; word: string; translation: string; partOfSpeech?: string }
  | { kind: 'error'; word: string; reason: string };

interface Props {
  state: TranslationPopupState;
  onClose: () => void;
}

const SNAP: (string | number)[] = ['35%'];

export const TranslationPopup = React.memo(function TranslationPopup({ state, onClose }: Props) {
  const ref = useRef<SheetRef>(null);
  const { theme } = useUnistyles();

  useEffect(() => {
    if (state.kind === 'closed') ref.current?.close();
    else ref.current?.expand();
  }, [state.kind]);

  if (state.kind === 'closed') return null;

  return (
    <Sheet ref={ref} snapPoints={SNAP} onClose={onClose}>
      <View style={{ padding: 18 }}>
        <Headline level={2}>{state.word}</Headline>
        <View style={{ marginTop: 14 }}>
          {state.kind === 'opening' && <ActivityIndicator color={theme.accent} />}
          {state.kind === 'pending' && (
            <>
              <ActivityIndicator color={theme.accent} />
              <Text style={{ color: theme.ink2, marginTop: 8 }}>
                Перевод недоступен (sub-project #4 не реализован)
              </Text>
            </>
          )}
          {state.kind === 'success' && (
            <>
              <Text style={{ color: theme.ink, fontSize: 18 }}>{state.translation}</Text>
              {state.partOfSpeech && (
                <Text style={{ color: theme.ink3, marginTop: 4 }}>{state.partOfSpeech}</Text>
              )}
            </>
          )}
          {state.kind === 'error' && (
            <Text style={{ color: theme.ink2 }}>Ошибка: {state.reason}</Text>
          )}
        </View>
      </View>
    </Sheet>
  );
});
