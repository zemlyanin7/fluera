import React, { useCallback, useState } from 'react';
import { Platform, ToastAndroid, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TranslationPopup, type PopupViewState } from './TranslationPopup';
import { useTranslationFeedback } from '@/hooks/data/useTranslationFeedback';
import { MODEL_MANIFEST } from '@/services/translation/modelManifest';
import { getKernelBuildId } from '@/services/translation/kernelBuildId';
import type { TranslationResult, SentenceTranslationResult } from '@/services/translation/ITranslationService';

interface Props {
  state: PopupViewState;
  onClose: () => void;
  onTranslateSentence: () => void;
  bookId?: string;
}

export function TranslationPopupContainer({ state, onClose, onTranslateSentence, bookId }: Props) {
  const [isDisliked, setIsDisliked] = useState(false);
  const [ffExpanded, setFfExpanded] = useState(false);
  const { record } = useTranslationFeedback();
  const { t } = useTranslation();

  const handleDislike = useCallback(async () => {
    if (isDisliked) {
      setIsDisliked(false);
      return;
    }
    const result = state.result as (TranslationResult & { sourceSentence?: string }) | SentenceTranslationResult | null;
    if (!result) return;
    // Извлекаем переведённый текст из разных форм результата
    const translatedSentence =
      ('translatedSentence' in result ? result.translatedSentence : null) ??
      ('translation' in result ? result.translation : null);
    if (!translatedSentence) return;

    setIsDisliked(true);
    await record({
      sourceSentence:
        ('sourceSentence' in result && result.sourceSentence)
          ? result.sourceSentence
          : state.sourceSentence,
      translatedSentence,
      bookLanguage: state.bookLanguage,
      nativeLanguage: state.nativeLanguage,
      modelVersion: String(MODEL_MANIFEST.version),
      kernelBuildId: getKernelBuildId(),
      bookId: bookId ?? null,
    });

    const msg = t('translation.dislikeRecorded', { defaultValue: 'Спасибо, учтём' });
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('', msg);
    }
  }, [isDisliked, state, record, bookId, t]);

  return (
    <TranslationPopup
      state={{ ...state, isDisliked }}
      onClose={onClose}
      onTranslateSentence={onTranslateSentence}
      onDislike={handleDislike}
      onFalseFriendToggle={() => setFfExpanded((v) => !v)}
      isFalseFriendExpanded={ffExpanded}
    />
  );
}
