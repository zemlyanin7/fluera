import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Reader, ReaderProvider, useReader } from '@epubjs-react-native/core';
import { useFileSystem } from '../../services/reader/useFileSystemLegacy';
import { generateBridgeScript } from '../../services/reader/epubBridgeScript';
import { TranslationPopup } from './TranslationPopup';
import { ReaderTopBar } from './ReaderTopBar';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import { useSettingsStore } from '../../stores/settingsStore';
import { useReaderStore } from '../../stores/readerStore';
import { useReaderTheme } from '../../hooks/useReaderTheme';
import { database } from '../../db';
import type { Book } from '../../db/models/Book';
import type { WordStatusValue } from '../../utils/types';

interface EpubReaderProps {
  fileUri: string;
  book: Book;
  bookLanguage: string;
  nativeLanguage: string;
}

/** Outer wrapper that provides ReaderContext */
export function EpubReader(props: EpubReaderProps) {
  return (
    <ReaderProvider>
      <EpubReaderInner {...props} />
    </ReaderProvider>
  );
}

/** Inner component that uses useReader() within ReaderProvider context */
const TOP_BAR_HEIGHT = 44;

function EpubReaderInner({ fileUri, book, bookLanguage, nativeLanguage }: EpubReaderProps) {
  const { goToLocation, injectJavascript, changeTheme, changeFontSize } = useReader();
  const settings = useSettingsStore();
  const readerTheme = useReaderTheme();
  const readerStore = useReaderStore();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const readerHeight = screenHeight - insets.top - TOP_BAR_HEIGHT - insets.bottom;

  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [selectedSentence, setSelectedSentence] = useState('');
  const [isPhrase, setIsPhrase] = useState(false);
  const [topBarVisible, setTopBarVisible] = useState(true);
  const [progress, setProgress] = useState(book.progress || 0);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Debounced position saving for EPUB
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCfi = useRef<string>(book.lastPosition || '');
  const lastProgress = useRef<number>(book.progress || 0);

  useEffect(() => {
    return () => {
      // Save final position on unmount
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const cfi = lastCfi.current;
      const pct = lastProgress.current;
      database.write(async () => {
        await book.update((record) => {
          record.lastPosition = cfi;
          record.progress = pct;
          record.lastReadAt = new Date();
        });
      }).catch((err) => console.warn('[EpubReader] Failed to save final position:', err));
    };
  }, [book]);

  // Bridge script for word tap detection — injected via injectedJavascript prop
  const bridgeScript = useRef(generateBridgeScript()).current;

  const handleReady = useCallback(() => {
    changeTheme({
      body: {
        background: readerTheme.colors.background,
        color: readerTheme.colors.text,
      },
    });
    changeFontSize(`${settings.fontSize}px`);

    if (book.lastPosition && book.lastPosition.startsWith('epubcfi(')) {
      try {
        goToLocation(book.lastPosition);
      } catch {
        goToLocation('');
      }
    }
  }, [book.lastPosition, readerTheme, settings.fontSize, changeTheme, changeFontSize, goToLocation]);

  // Re-apply theme when reader theme changes (auto day/night or manual switch)
  useEffect(() => {
    changeTheme({
      body: {
        background: readerTheme.colors.background,
        color: readerTheme.colors.text,
      },
    });
  }, [readerTheme, changeTheme]);

  // onWebViewMessage receives already-parsed objects (not raw JSON strings).
  // This is the correct prop for custom messages in @epubjs-react-native.
  const handleWebViewMessage = useCallback((data: Record<string, unknown>) => {
    try {
      switch (data.type) {
        case 'wordTap':
          setSelectedWord(data.word as string);
          setSelectedSentence(data.sentence as string);
          setIsPhrase(false);
          setPopupVisible(true);
          break;
        case 'noWordTap':
          // Tapped on non-text area → toggle top bar (skip if settings sheet is open)
          if (!settingsVisible) {
            setTopBarVisible((v) => !v);
          }
          break;
        case 'phraseSelect':
          setSelectedWord(data.phrase as string);
          setSelectedSentence(data.sentence as string);
          setIsPhrase(true);
          setPopupVisible(true);
          break;
        case 'debug':
          // Bridge debug messages — uncomment for troubleshooting
          // console.warn('[BRIDGE]', data.step, JSON.stringify(data));
          break;
        case 'locationChange': {
          const pct = (data.progress as number) * 100;
          setProgress(pct);
          readerStore.setScrollPosition(data.progress as number);
          lastCfi.current = data.cfi as string;
          lastProgress.current = pct;
          // Debounced save to DB
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(async () => {
            try {
              await database.write(async () => {
                await book.update((record) => {
                  record.lastPosition = data.cfi as string;
                  record.progress = pct;
                  record.lastReadAt = new Date();
                });
              });
            } catch (err) {
              console.warn('[EpubReader] Failed to save position:', err);
            }
          }, 1500);
          break;
        }
      }
    } catch { /* ignore */ }
  }, [book, readerStore, settingsVisible]);

  // On tap: if popup is open → close it; otherwise ask WebView for the word.
  // Coordinates are already captured by touchstart in the iframe (bridge script),
  // so we just call getWordAtLastTouch() which uses stored coordinates.
  // handlePress: on iOS, TouchableWithoutFeedback.onPress does NOT fire reliably
  // with WebView, so word tap detection is done entirely inside the bridge script
  // (touchstart/touchend in iframe). handlePress is only used for closing popup.
  const handlePress = useCallback(() => {
    if (popupVisible) {
      setPopupVisible(false);
      setSelectedWord('');
    }
  }, [popupVisible]);

  const handleSave = useCallback(async (_word: string, _translation: string, _grammar: string, _sentence: string) => {
    // TODO: Create/update WordStatus + WordOccurrence in DB
  }, []);

  const handleStatusChange = useCallback((_status: WordStatusValue) => {
    // TODO: Update WordStatus in DB
  }, []);

  const topBarTotalHeight = insets.top + TOP_BAR_HEIGHT;

  return (
    <View style={[styles.container, { backgroundColor: readerTheme.colors.background }]}>
      {/* Spacer pushes Reader below TopBar area */}
      <View style={{ height: topBarTotalHeight }} />

      {/* Reader takes remaining space with explicit dimensions for correct pagination */}
      <Reader
        src={fileUri}
        fileSystem={useFileSystem}
        width={screenWidth}
        height={readerHeight}
        enableSelection
        flow={settings.scrollMode === 'scroll' ? 'scrolled' : 'paginated'}
        onReady={handleReady}
        onWebViewMessage={handleWebViewMessage}
        injectedJavascript={bridgeScript}
        onPress={handlePress}
      />

      {/* Overlay: TopBar (absolute) + TranslationPopup */}
      <View style={styles.overlay} pointerEvents="box-none">
        <ReaderTopBar
          title={book.title}
          progress={progress}
          visible={topBarVisible}
          onSettingsPress={() => setSettingsVisible(true)}
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
        <ReaderSettingsSheet
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
});
