import React, { useEffect, useState, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Spinner } from 'tamagui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { WORD_STATUS_COLORS } from '../../utils/constants';
import type { WordStatusValue } from '../../utils/types';

type PopupState = 'idle' | 'loading' | 'success' | 'error';

interface TranslationResult {
  translation: string;
  grammar: string | null;
  fromCache: boolean;
}

interface TranslationPopupProps {
  visible: boolean;
  word: string;
  sentence: string;
  bookLanguage: string;
  nativeLanguage: string;
  isPhrase: boolean;
  onClose: () => void;
  onSave: (word: string, translation: string, grammar: string, sentence: string) => void;
  onStatusChange: (status: WordStatusValue) => void;
}

const STATUS_KEYS: Record<WordStatusValue, string> = {
  1: 'new',
  2: 'recognized',
  3: 'familiar',
  4: 'learned',
  5: 'known',
};

export function TranslationPopup({
  visible, word, sentence, bookLanguage, nativeLanguage,
  isPhrase, onClose, onSave, onStatusChange,
}: TranslationPopupProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<PopupState>('idle');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<WordStatusValue>(1);
  const translateY = useSharedValue(400);

  // Fast slide-up animation
  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 180 });
      fetchTranslation();
    } else {
      translateY.value = withTiming(400, { duration: 150 });
      setState('idle');
      setResult(null);
    }
  }, [visible, word]);

  const fetchTranslation = useCallback(async () => {
    setState('loading');
    try {
      // TODO: Wire up actual TranslationService singleton in a later task
      await new Promise((resolve) => setTimeout(resolve, 100));
      setResult({
        translation: `[Translation of "${word}"]`,
        grammar: null,
        fromCache: false,
      });
      setState('success');
    } catch {
      setState('error');
    }
  }, [word, sentence, bookLanguage, nativeLanguage, isPhrase]);

  // Swipe-down to dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 300) {
        translateY.value = withTiming(400, { duration: 150 }, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 120 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleSave = useCallback(() => {
    if (result) {
      onSave(word, result.translation, result.grammar ?? '', sentence);
      onClose();
    }
  }, [word, result, sentence, onSave, onClose]);

  const handleStatusChange = useCallback((status: WordStatusValue) => {
    setSelectedStatus(status);
    onStatusChange(status);
  }, [onStatusChange]);

  // Render context sentence with tapped word in bold
  const renderSentence = () => {
    const idx = sentence.toLowerCase().indexOf(word.toLowerCase());
    if (idx === -1) return <Text fontSize={13} color="$textSecondary">{sentence}</Text>;
    const before = sentence.slice(0, idx);
    const match = sentence.slice(idx, idx + word.length);
    const after = sentence.slice(idx + word.length);
    return (
      <Text fontSize={13} color="$textSecondary">
        {before}<Text fontWeight="bold">{match}</Text>{after}
      </Text>
    );
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      </Pressable>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.sheetContainer, animatedStyle]}>
          <YStack backgroundColor="$popupBg" borderTopLeftRadius={16} borderTopRightRadius={16} padding="$4" gap="$3">
            {/* Drag handle */}
            <XStack justifyContent="center" paddingBottom="$1">
              <YStack width={40} height={4} backgroundColor="$textMuted" borderRadius="$2" opacity={0.5} />
            </XStack>

            {/* Word */}
            <Text fontSize={22} fontWeight="bold">{word}</Text>

            {/* Content by state */}
            {state === 'loading' && <Spinner size="small" />}
            {state === 'error' && (
              <YStack gap="$2">
                <Text color="#ef4444">{t('reader.translation.error')}</Text>
                <Pressable
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                  onPress={fetchTranslation}
                >
                  <Text fontSize={14} color="$primary">{t('common.retry')}</Text>
                </Pressable>
              </YStack>
            )}
            {state === 'success' && result && (
              <YStack gap="$3">
                <Text fontSize={17}>{result.translation}</Text>
                {result.grammar ? <Text fontSize={13} color="$textSecondary">{result.grammar}</Text> : null}
                {renderSentence()}

                {/* Word status selector with labels */}
                <XStack gap="$2" justifyContent="space-between" paddingHorizontal="$1">
                  {([1, 2, 3, 4, 5] as WordStatusValue[]).map((status) => {
                    const isSelected = selectedStatus === status;
                    const bgColor = WORD_STATUS_COLORS[status] === 'transparent'
                      ? '$borderColor'
                      : WORD_STATUS_COLORS[status];
                    return (
                      <Pressable key={status} onPress={() => handleStatusChange(status)}>
                        <YStack alignItems="center" gap="$1">
                          <YStack
                            width={36}
                            height={36}
                            borderRadius={18}
                            backgroundColor={bgColor}
                            borderWidth={isSelected ? 3 : 0}
                            borderColor="$primary"
                            justifyContent="center"
                            alignItems="center"
                            opacity={isSelected ? 1 : 0.7}
                          />
                          <Text
                            fontSize={10}
                            color={isSelected ? '$color' : '$textMuted'}
                            fontWeight={isSelected ? '600' : '400'}
                          >
                            {t(`reader.wordStatus.${STATUS_KEYS[status]}`)}
                          </Text>
                        </YStack>
                      </Pressable>
                    );
                  })}
                </XStack>

                {/* Save button */}
                <Pressable
                  style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
                  onPress={handleSave}
                >
                  <Text color="#ffffff" fontSize={16} fontWeight="600">
                    {t('reader.translation.addToDict')}
                  </Text>
                </Pressable>
              </YStack>
            )}
          </YStack>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  saveButton: {
    backgroundColor: '#6c63ff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6c63ff',
  },
  pressed: {
    opacity: 0.7,
  },
});
