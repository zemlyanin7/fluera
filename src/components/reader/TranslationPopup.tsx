import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, AccessibilityInfo } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'react-native-reanimated';
import { Popover, type AnchorRect } from '@/components/ui';
import { Sheet, type SheetRef } from '@/components/ui';
import type {
  TranslationResult,
  SentenceTranslationResult,
} from '@/services/translation/ITranslationService';
import type { InlineNode } from '@/types/content';
import { ExperimentalBadge } from './ExperimentalBadge';
import { DislikeButton } from './DislikeButton';
import { MweChip } from './MweChip';
import { FalseFriendChip } from './FalseFriendChip';
import { EncounterBadge } from './EncounterBadge';
import { PolysemyDisclosure, type Sense } from './PolysemyDisclosure';
import { SentenceTranslationView } from './SentenceTranslationView';
import { HeartButton } from './HeartButton';
import { PolysemyChip } from './PolysemyChip';
import { TargetSkeleton } from './TargetSkeleton';
import type { PlacementResult } from './PopupPlacement';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

// ---------------------------------------------------------------------------
// Legacy export kept for backwards compatibility — callers migrated in Phase 23
// ---------------------------------------------------------------------------
export type TranslationPopupState =
  | { kind: 'closed' }
  | { kind: 'opening'; word: string; sentence: string }
  | { kind: 'pending'; word: string; sentence: string; reason?: 'loading_model' | 'inferring' }
  | { kind: 'success'; word: string; translation: string; partOfSpeech?: string; source?: 'memory' | 'db' | 'inference' }
  | { kind: 'error'; word: string; reason: string };

// ---------------------------------------------------------------------------
// New state machine (Phase 14)
// ---------------------------------------------------------------------------
export type PopupMode = 'word' | 'sentence' | 'phrase';

export interface PopupViewState {
  visible: boolean;
  mode: PopupMode;
  word: string;
  sourceSentence: string;
  /** v2: InlineNode[] для SentenceTranslationView с preserved formatting. */
  sourceInlines?: InlineNode[];
  wordOffsetInSentence: number;
  status: 'loading' | 'ready' | 'error';
  placement: PlacementResult;
  anchorRect: AnchorRect;
  result: TranslationResult | SentenceTranslationResult | null;
  encounterCount: number;
  coverageHint: boolean;
  isDisliked?: boolean;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  /** v3 (#4.5.1) polish: */
  sourcePlainText?: string;
  wordOffsetInPlain?: number;
  wordLength?: number;
  wasCapped?: boolean;
  savedToDeck?: boolean;
  hasMultipleSenses?: boolean;
  falseFriendInfo?: { looksLike: string; actualMeaning: string } | null;
  generation?: number;
}

interface Props {
  state: PopupViewState;
  onClose: () => void;
  onTranslateSentence: () => void;
  onDislike: () => void;
  onFalseFriendToggle?: () => void;
  isFalseFriendExpanded?: boolean;
  onHeartToggle?: () => void;
}

// ---------------------------------------------------------------------------
// useReducedTransparency hook (Phase 14 / Task 67)
// ---------------------------------------------------------------------------
function useReducedTransparency(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof AccessibilityInfo.isReduceTransparencyEnabled === 'function') {
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then(setReduced)
        .catch(() => {});
      const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', setReduced);
      return () => {
        sub?.remove?.();
      };
    }
    return undefined;
  }, []);
  return reduced;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function TranslationPopup({
  state,
  onClose,
  onTranslateSentence,
  onDislike,
  onFalseFriendToggle = () => {},
  isFalseFriendExpanded = false,
  onHeartToggle,
}: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const sheetRef = React.useRef<SheetRef>(null);
  const reduceMotion = useReducedMotion();
  const reduceTransparency = useReducedTransparency();

  // Sheet mounts всегда — управление open/close через ref.expand()/close().
  // Hooks ДОЛЖНЫ быть до conditional return (rules of hooks).
  const isModalSheet = state.placement.mode === 'modalSheet';

  React.useEffect(() => {
    if (!isModalSheet) return;
    if (state.visible) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [isModalSheet, state.visible]);

  // Modal sheet mode — ВСЕГДА mounted, чтобы open/close через ref работало.
  // Foundation Sheet primitive стартует с index=-1 (closed), expand() двигает к 0.
  if (isModalSheet) {
    return (
      <Sheet ref={sheetRef} snapPoints={['50%']} onClose={onClose}>
        <View style={{ padding: 18 }}>
          <PopupContents
            state={state}
            theme={theme}
            t={t}
            reduceMotion={reduceMotion}
            reduceTransparency={reduceTransparency}
            onTranslateSentence={onTranslateSentence}
            onDislike={onDislike}
            onFalseFriendToggle={onFalseFriendToggle}
            isFalseFriendExpanded={isFalseFriendExpanded}
            onHeartToggle={onHeartToggle}
          />
        </View>
      </Sheet>
    );
  }

  if (!state.visible) return null;

  // Top / bottom anchored Popover.
  return (
    <Popover
      visible={state.visible}
      placement={state.placement.mode === 'top' ? 'top' : 'bottom'}
      anchorRect={state.anchorRect}
      onDismiss={onClose}
    >
      <PopupContents
        state={state}
        theme={theme}
        t={t}
        reduceMotion={reduceMotion}
        reduceTransparency={reduceTransparency}
        onTranslateSentence={onTranslateSentence}
        onDislike={onDislike}
        onFalseFriendToggle={onFalseFriendToggle}
        isFalseFriendExpanded={isFalseFriendExpanded}
        onHeartToggle={onHeartToggle}
      />
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// PopupContents — inner render, shared by Popover and Sheet
// ---------------------------------------------------------------------------
interface ContentsProps {
  state: PopupViewState;
  theme: any;
  t: (key: string, opts?: any) => string;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  onTranslateSentence: () => void;
  onDislike: () => void;
  onFalseFriendToggle: () => void;
  isFalseFriendExpanded: boolean;
  onHeartToggle?: () => void;
}

function PopupContents({
  state,
  theme,
  t,
  reduceTransparency,
  onTranslateSentence,
  onDislike,
  onFalseFriendToggle,
  isFalseFriendExpanded,
  onHeartToggle,
}: ContentsProps) {
  const isSentence = state.mode === 'sentence';
  const result = state.result;
  const wordResult = !isSentence ? (result as TranslationResult | null) : null;
  const sentenceResult = isSentence ? (result as SentenceTranslationResult | null) : null;

  // Convert string[] alternativeSenses to Sense[] for PolysemyDisclosure
  const senses: Sense[] = (wordResult?.alternativeSenses ?? []).map((s) => ({
    sense: s,
    translation: '',
  }));

  // Shadow suppressed on reduced transparency
  const shadowStyle = reduceTransparency
    ? {}
    : {
        shadowColor: theme.ink,
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      };

  return (
    <View style={[{ minHeight: 80, gap: 10 }, shadowStyle]} accessibilityViewIsModal>
      {/* Header — word + heart + chips */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {isSentence ? (
          <Text style={{ color: theme.ink2, fontSize: 16, fontWeight: '700', flex: 1 }}>
            {t('translation.wordLabel', { defaultValue: 'Слово:' })} {state.word}
          </Text>
        ) : (
          <Text style={{ color: theme.ink, fontSize: 22, fontWeight: '700', flex: 1 }}>{state.word}</Text>
        )}
        <HeartButton saved={!!state.savedToDeck} onToggle={() => onHeartToggle?.()} />
        {wordResult?.mwePhrase && <MweChip type={wordResult.mwePhrase.type} />}
        {state.hasMultipleSenses && <PolysemyChip />}
        {state.falseFriendInfo && (
          <FalseFriendChip
            looksLike={state.falseFriendInfo.looksLike}
            actualMeaning={state.falseFriendInfo.actualMeaning}
            expanded={isFalseFriendExpanded}
            onToggle={onFalseFriendToggle}
          />
        )}
      </View>

      {/* v2.2.4: ExperimentalBadge убран по user-feedback. Плашка излишний шум —
          юзер видит translation, может оценить сам. Возврат к плашке возможен
          если quality regression обнаружится в production. */}

      {/* Progressive loading */}
      {state.status === 'loading' && (
        <ProgressiveLoading sourceLength={(state.sourcePlainText ?? state.sourceSentence ?? '').length} />
      )}

      {/* Word mode — ready */}
      {state.status === 'ready' && !isSentence && wordResult?.translation != null && (
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.ink, fontSize: 17 }}>{wordResult.translation}</Text>
          {wordResult.falseFriend && (
            <FalseFriendChip
              looksLike={wordResult.falseFriend.looksLike}
              actualMeaning={wordResult.falseFriend.actualMeaning}
              expanded={isFalseFriendExpanded}
              onToggle={onFalseFriendToggle}
            />
          )}
          <PolysemyDisclosure senses={senses} />
        </View>
      )}

      {/* Sentence mode — ready */}
      {state.status === 'ready' && isSentence && sentenceResult?.translatedSentence != null && (
        <View style={{ gap: 14 }}>
          {/* Primary: contextual word translation. Источник из onWordTap
              (translate(word, sentence) в параллель с translateSentence). */}
          {(sentenceResult as any).translation && (
            <View
              style={{
                backgroundColor: theme.accentSoft,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: theme.ink3, fontSize: 11, marginBottom: 4, letterSpacing: 0.5 }}>
                {t('translation.contextualLabel', { defaultValue: 'В ЭТОМ КОНТЕКСТЕ' })}
              </Text>
              <Text style={{ color: theme.accent, fontSize: 20, fontWeight: '700' }}>
                {state.word} → {(sentenceResult as any).translation}
              </Text>
            </View>
          )}

          <SentenceTranslationView
            sourceInlines={
              state.sourceInlines ?? [
                { type: 'text', text: sentenceResult.sourceSentence ?? state.sourceSentence },
              ]
            }
            sourcePlainText={state.sourcePlainText ?? sentenceResult.sourceSentence ?? state.sourceSentence}
            translatedSentence={sentenceResult.translatedSentence}
            sourceWordOffset={state.wordOffsetInPlain ?? state.wordOffsetInSentence}
            sourceWordLength={state.wordLength ?? state.word.length}
            translatedWordOffset={sentenceResult.translatedWordOffset}
            wasCapped={state.wasCapped}
          />
        </View>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <Text style={{ color: theme.ink2 }}>
          {t('translation.errorGeneric', { defaultValue: 'Не удалось перевести. Попробуйте ещё раз.' })}
        </Text>
      )}

      {/* Encounter badge — both modes, when ready */}
      {state.status === 'ready' && (
        <EncounterBadge count={state.encounterCount} />
      )}

      {/* Translate sentence button — word mode only, when ready */}
      {!isSentence && state.status === 'ready' && (
        <Pressable
          onPress={onTranslateSentence}
          accessibilityRole="button"
          accessibilityLabel={t('translation.translateSentenceLabel', {
            defaultValue: 'Перевести предложение',
          })}
          hitSlop={10}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: state.coverageHint ? theme.accentSoft : 'transparent',
            borderRadius: 8,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.accent, fontSize: 14 }}>
            {'? '}
            {t('translation.translateSentenceLabel', { defaultValue: 'Перевести предложение' })}
          </Text>
        </Pressable>
      )}

      {/* Dislike — sentence mode only, when ready */}
      {isSentence && state.status === 'ready' && (
        <DislikeButton isDisliked={!!state.isDisliked} onToggle={onDislike} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ProgressiveLoading — replaces ActivityIndicator with TargetSkeleton + timed subtitle
// ---------------------------------------------------------------------------
function ProgressiveLoading({ sourceLength }: { sourceLength: number }) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, []);

  let subtitle: string;
  if (elapsed < 5000) {
    subtitle = t('translation.loading.short', { defaultValue: 'Переводим...' });
  } else if (elapsed < 10000) {
    subtitle = t('translation.loading.medium', { defaultValue: 'Подбираем точный перевод...' });
  } else if (elapsed < 15000) {
    subtitle = t('translation.loading.long', { defaultValue: 'Длинное предложение, ещё момент...' });
  } else {
    subtitle = t('translation.loading.veryLong', { defaultValue: 'Дольше обычного' });
  }

  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 10 }}>
      <TargetSkeleton sourceLength={sourceLength} />
      <Text style={{ color: theme.ink2, fontSize: 13 }}>{subtitle}</Text>
    </View>
  );
}
