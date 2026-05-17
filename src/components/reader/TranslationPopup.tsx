import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, AccessibilityInfo } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'react-native-reanimated';
import { Popover, type AnchorRect } from '@/components/ui';
import { Sheet, type SheetRef } from '@/components/ui';
import type {
  TranslationResult,
  SentenceTranslationResult,
} from '@/services/translation/ITranslationService';
import { ExperimentalBadge } from './ExperimentalBadge';
import { DislikeButton } from './DislikeButton';
import { MweChip } from './MweChip';
import { FalseFriendChip } from './FalseFriendChip';
import { EncounterBadge } from './EncounterBadge';
import { PolysemyDisclosure, type Sense } from './PolysemyDisclosure';
import { SentenceTranslationView } from './SentenceTranslationView';
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
}

interface Props {
  state: PopupViewState;
  onClose: () => void;
  onTranslateSentence: () => void;
  onDislike: () => void;
  onFalseFriendToggle?: () => void;
  isFalseFriendExpanded?: boolean;
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
      {/* Header — word + optional MWE chip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.ink, fontSize: 22, fontWeight: '700' }}>{state.word}</Text>
        {wordResult?.mwePhrase && <MweChip type={wordResult.mwePhrase.type} />}
      </View>

      {/* Experimental badge — sentence mode only */}
      {isSentence && <ExperimentalBadge />}

      {/* Loading shimmer */}
      {state.status === 'loading' && (
        <View accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.accent} />
          <Text style={{ color: theme.ink2, marginTop: 6 }}>
            {t('translation.a11y.loadingTranslation', { defaultValue: 'Переводим…' })}
          </Text>
        </View>
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
        <SentenceTranslationView
          sourceSentence={sentenceResult.sourceSentence ?? state.sourceSentence}
          translatedSentence={sentenceResult.translatedSentence}
          sourceWordOffset={state.wordOffsetInSentence}
          sourceWord={state.word}
          translatedWordOffset={sentenceResult.translatedWordOffset}
        />
      )}

      {/* Error */}
      {state.status === 'error' && (
        <Text style={{ color: theme.ink2 }}>
          {t('translation.errorGeneric', { defaultValue: 'Не удалось перевести. Попробуйте ещё раз.' })}
        </Text>
      )}

      {/* Encounter badge — word mode only, when ready */}
      {!isSentence && state.status === 'ready' && (
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
