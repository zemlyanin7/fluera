import React, { useEffect, useState, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Button, Spinner } from 'tamagui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

export function TranslationPopup({
  visible, word, sentence, bookLanguage, nativeLanguage,
  isPhrase, onClose, onSave, onStatusChange,
}: TranslationPopupProps) {
  const [state, setState] = useState<PopupState>('idle');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<WordStatusValue>(1);
  const translateY = useSharedValue(400);

  // Slide-up animation
  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 150 });
      fetchTranslation();
    } else {
      translateY.value = withTiming(400, { duration: 200 });
      setState('idle');
      setResult(null);
    }
  }, [visible, word]);

  const fetchTranslation = useCallback(async () => {
    setState('loading');
    try {
      // TODO: Wire up actual TranslationService singleton in a later task
      // For now, simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 500));
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

  // Swipe-down gesture using Gesture API (react-native-gesture-handler v2)
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 300) {
        translateY.value = withTiming(400, { duration: 200 }, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0);
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
    if (idx === -1) return <Text fontSize="$3" color="$gray10">{sentence}</Text>;
    const before = sentence.slice(0, idx);
    const match = sentence.slice(idx, idx + word.length);
    const after = sentence.slice(idx + word.length);
    return (
      <Text fontSize="$3" color="$gray10">
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
        <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0 }, animatedStyle]}>
          <YStack backgroundColor="$background" borderTopLeftRadius="$4" borderTopRightRadius="$4" padding="$4" gap="$3">
            {/* Drag handle */}
            <XStack justifyContent="center" paddingBottom="$1">
              <YStack width={40} height={4} backgroundColor="$gray8" borderRadius="$2" />
            </XStack>

            {/* Word */}
            <Text fontSize="$7" fontWeight="bold">{word}</Text>

            {/* Content by state */}
            {state === 'loading' && <Spinner size="small" />}
            {state === 'error' && (
              <YStack gap="$2">
                <Text color="$red10">Translation failed</Text>
                <Button size="$3" onPress={fetchTranslation}>Retry</Button>
              </YStack>
            )}
            {state === 'success' && result && (
              <YStack gap="$3">
                <Text fontSize="$5">{result.translation}</Text>
                {result.grammar ? <Text fontSize="$3" color="$gray10">{result.grammar}</Text> : null}
                {renderSentence()}

                {/* Word status selector — 5 colored dots */}
                <XStack gap="$2" justifyContent="center">
                  {([1, 2, 3, 4, 5] as WordStatusValue[]).map((status) => (
                    <Pressable key={status} onPress={() => handleStatusChange(status)}>
                      <YStack
                        width={32}
                        height={32}
                        borderRadius={16}
                        backgroundColor={WORD_STATUS_COLORS[status] === 'transparent' ? '$gray4' : WORD_STATUS_COLORS[status]}
                        borderWidth={selectedStatus === status ? 3 : 0}
                        borderColor="$blue10"
                        justifyContent="center"
                        alignItems="center"
                      />
                    </Pressable>
                  ))}
                </XStack>

                {/* Save button */}
                <Button size="$4" theme="active" onPress={handleSave}>
                  Save to Dictionary
                </Button>
              </YStack>
            )}
          </YStack>
        </Animated.View>
      </GestureDetector>
    </>
  );
}
