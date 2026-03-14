import React, { useState, useCallback } from 'react';
import { YStack } from 'tamagui';
import { Reader, useReader } from '@epubjs-react-native/core';
// eslint-disable-next-line import/no-unresolved
import { useFileSystem } from '@epubjs-react-native/expo-file-system';
import { generateBridgeScript } from '../../services/reader/epubBridgeScript';
import { TranslationPopup } from './TranslationPopup';
import { ReaderTopBar } from './ReaderTopBar';
import { useSettingsStore } from '../../stores/settingsStore';
import { useReaderStore } from '../../stores/readerStore';
import type { Book } from '../../db/models/Book';
import type { WordStatusValue } from '../../utils/types';

interface EpubReaderProps {
  fileUri: string;
  book: Book;
  bookLanguage: string;
  nativeLanguage: string;
}

const THEME_STYLES = {
  light: { body: { background: '#ffffff', color: '#1a1a1a' } },
  dark: { body: { background: '#1a1a1a', color: '#e0e0e0' } },
  sepia: { body: { background: '#f4ecd8', color: '#5b4636' } },
};

export function EpubReader({ fileUri, book, bookLanguage, nativeLanguage }: EpubReaderProps) {
  const { goToLocation, injectJavascript, changeTheme, changeFontSize } = useReader();
  const settings = useSettingsStore();
  const readerStore = useReaderStore();

  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [selectedSentence, setSelectedSentence] = useState('');
  const [isPhrase, setIsPhrase] = useState(false);
  const [topBarVisible, setTopBarVisible] = useState(true);
  const [progress, setProgress] = useState(book.progress || 0);

  const handleReady = useCallback(() => {
    injectJavascript(generateBridgeScript());
    changeTheme(THEME_STYLES[settings.readerTheme] || THEME_STYLES.light);
    changeFontSize(`${settings.fontSize}px`);

    if (book.lastPosition && book.lastPosition.startsWith('epubcfi(')) {
      try {
        goToLocation(book.lastPosition);
      } catch {
        goToLocation('');
      }
    }
  }, [book.lastPosition, settings.readerTheme, settings.fontSize]);

  const handleMessage = useCallback((message: string) => {
    try {
      const data = JSON.parse(message);
      switch (data.type) {
        case 'wordTap':
          setSelectedWord(data.word);
          setSelectedSentence(data.sentence);
          setIsPhrase(false);
          setPopupVisible(true);
          break;
        case 'phraseSelect':
          setSelectedWord(data.phrase);
          setSelectedSentence(data.sentence);
          setIsPhrase(true);
          setPopupVisible(true);
          break;
        case 'locationChange':
          setProgress(data.progress * 100);
          readerStore.setScrollPosition(data.progress);
          book.update((b: any) => {
            b.lastPosition = data.cfi;
            b.progress = data.progress * 100;
            b.lastReadAt = Date.now();
          });
          break;
      }
    } catch { /* ignore malformed messages */ }
  }, [book, readerStore]);

  const handleSave = useCallback(async (word: string, translation: string, grammar: string, sentence: string) => {
    // TODO: Create/update WordStatus + WordOccurrence in DB
  }, []);

  const handleStatusChange = useCallback((status: WordStatusValue) => {
    // TODO: Update WordStatus in DB
  }, []);

  return (
    <YStack flex={1}>
      <Reader
        src={fileUri}
        fileSystem={useFileSystem}
        onReady={handleReady}
        {...{onMessage: handleMessage} as any}
        onPress={() => setTopBarVisible((v) => !v)}
      />
      <ReaderTopBar
        title={book.title}
        progress={progress}
        visible={topBarVisible}
        onSettingsPress={() => {/* TODO: open ReaderSettingsSheet */}}
      />
      <TranslationPopup
        visible={popupVisible}
        word={selectedWord}
        sentence={selectedSentence}
        bookLanguage={bookLanguage}
        nativeLanguage={nativeLanguage}
        isPhrase={isPhrase}
        onClose={() => { setPopupVisible(false); setSelectedWord(''); }}
        onSave={handleSave}
        onStatusChange={handleStatusChange}
      />
    </YStack>
  );
}
