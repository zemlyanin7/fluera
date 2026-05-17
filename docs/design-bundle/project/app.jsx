// Fluera — app composition.
// Hero (interactive Reader) + DesignCanvas with all screens grouped by flow.
// Tweaks panel exposes theme, font, accent, translation UX, reading size.

const ACCENT_OPTIONS = [
  "#C96442", // terracotta
  "#5E8C5A", // sage
  "#3A342C", // ink
  "#7A4566", // plum
];

const FLUERA_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroTheme": "light",
  "heroTranslationMode": "sheet",
  "heroShowHighlights": true,
  "heroFontSize": 19,
  "heroTypeface": "serif",
  "heroLang": "ja",
  "accent": "#C96442"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(FLUERA_TWEAK_DEFAULTS);

  // Apply accent globally
  React.useEffect(() => {
    const c = tweaks.accent || ACCENT_OPTIONS[0];
    const root = document.documentElement;
    root.style.setProperty("--accent", c);
    root.style.setProperty("--accent-soft", `color-mix(in oklab, ${c} 14%, transparent)`);
    root.style.setProperty("--accent-line", `color-mix(in oklab, ${c} 35%, transparent)`);
  }, [tweaks.accent]);

  return (
    <>
      <DesignCanvas
        title="Fluera — read your way to a new language"
        subtitle="Mobile reading app · iOS reference frame · Russian → English, but supports any pair"
      >
        <DCSection id="hero" title="The Reader" subtitle="Tap any word — translation appears. This artboard is live: try it.">
          <DCArtboard id="reader-live" label={`Live · ${tweaks.heroTheme} · ${tweaks.heroTranslationMode}`} width={PHONE_W} height={PHONE_H}>
            <ReaderScreen
              theme={tweaks.heroTheme}
              translationMode={tweaks.heroTranslationMode}
              showHighlights={tweaks.heroShowHighlights}
              fontSize={tweaks.heroFontSize}
              typeface={tweaks.heroTypeface}
            />
          </DCArtboard>
          <DCArtboard id="reader-sepia" label="Sepia · richer translation sheet" width={PHONE_W} height={PHONE_H}>
            <ReaderScreen theme="sepia" translationMode="sheet-rich" showHighlights={true} />
          </DCArtboard>
          <DCArtboard id="reader-night" label="Night · tooltip variant" width={PHONE_W} height={PHONE_H}>
            <ReaderScreen theme="dark" translationMode="tooltip" showHighlights={false} />
          </DCArtboard>
        </DCSection>

        <DCSection id="typography" title="Typography per language" subtitle="A font that's elegant for English looks awkward in Japanese. Fluera switches the typeface to match each script — for books, translations, and UI.">
          <DCArtboard id="type-live" label={`Live · ${LANG_SAMPLES[tweaks.heroLang]?.native} · book in source script`} width={PHONE_W} height={PHONE_H}>
            <MultilingualReaderScreen theme={tweaks.heroTheme} langKey={tweaks.heroLang} showHighlights={tweaks.heroShowHighlights} />
          </DCArtboard>
          <DCArtboard id="type-ja" label="Japanese · Shippori Mincho" width={PHONE_W} height={PHONE_H}>
            <MultilingualReaderScreen theme="light" langKey="ja" />
          </DCArtboard>
          <DCArtboard id="type-ru" label="Russian · Lora" width={PHONE_W} height={PHONE_H}>
            <MultilingualReaderScreen theme="sepia" langKey="ru" />
          </DCArtboard>
          <DCArtboard id="type-ar" label="Arabic · Amiri · RTL" width={PHONE_W} height={PHONE_H}>
            <MultilingualReaderScreen theme="light" langKey="ar" />
          </DCArtboard>
          <DCArtboard id="type-ko" label="Korean · Noto Serif KR" width={PHONE_W} height={PHONE_H}>
            <MultilingualReaderScreen theme="light" langKey="ko" />
          </DCArtboard>
          <DCArtboard id="type-hi" label="Hindi · Tiro Devanagari" width={PHONE_W} height={PHONE_H}>
            <MultilingualReaderScreen theme="light" langKey="hi" />
          </DCArtboard>
          <DCArtboard id="type-ja-sheet" label="JP → RU · translation sheet (mixed scripts)" width={PHONE_W} height={PHONE_H}>
            <MultilingualReaderScreen theme="light" langKey="ja" showSheet />
          </DCArtboard>
          <DCArtboard id="type-ar-sheet" label="AR → RU · translation sheet (RTL → LTR)" width={PHONE_W} height={PHONE_H}>
            <MultilingualReaderScreen theme="light" langKey="ar" showSheet />
          </DCArtboard>
          <DCArtboard id="type-specimen" label="Type specimen · all pairs · 1120 × 760" width={1120} height={760}>
            <TypographySpecimen width={1120} height={760} />
          </DCArtboard>
        </DCSection>

        <DCSection id="translation-ux" title="Translation UX variants" subtitle="Three ways to surface a word's meaning — pick the one that disrupts reading least.">
          <DCArtboard id="ux-tooltip" label="A · Tooltip — fastest, glanceable" width={PHONE_W} height={PHONE_H}>
            <ReaderScreen theme="light" translationMode="tooltip" showHighlights={false} />
          </DCArtboard>
          <DCArtboard id="ux-panel" label="B · Floating chip above tab bar" width={PHONE_W} height={PHONE_H}>
            <ReaderScreen theme="light" translationMode="panel" showHighlights={false} />
          </DCArtboard>
          <DCArtboard id="ux-sheet" label="C · Bottom sheet — full detail" width={PHONE_W} height={PHONE_H}>
            <ReaderScreen theme="light" translationMode="sheet-rich" showHighlights={true} />
          </DCArtboard>
        </DCSection>

        <DCSection id="library" title="Library & import" subtitle="Where books live, where new ones come in. EPUB & FB2 are handled identically once parsed.">
          <DCArtboard id="library-main" label="Library · home" width={PHONE_W} height={PHONE_H}>
            <LibraryScreen theme="light" />
          </DCArtboard>
          <DCArtboard id="import" label="Add a book" width={PHONE_W} height={PHONE_H}>
            <ImportScreen theme="light" />
          </DCArtboard>
          <DCArtboard id="onboarding" label="Onboarding · 2/3" width={PHONE_W} height={PHONE_H}>
            <OnboardingScreen theme="light" />
          </DCArtboard>
        </DCSection>

        <DCSection id="learning" title="Vocabulary & gamification" subtitle="The point of Fluera: every tapped word feeds a spaced-repetition deck and a streak.">
          <DCArtboard id="word-card" label="Word card · detail" width={PHONE_W} height={PHONE_H}>
            <WordCardScreen theme="light" />
          </DCArtboard>
          <DCArtboard id="flash-front" label="Flashcards · front" width={PHONE_W} height={PHONE_H}>
            <FlashcardsScreen theme="light" revealed={false} />
          </DCArtboard>
          <DCArtboard id="flash-revealed" label="Flashcards · revealed (SRS)" width={PHONE_W} height={PHONE_H}>
            <FlashcardsScreen theme="light" revealed={true} />
          </DCArtboard>
          <DCArtboard id="stats" label="Stats · streak & week" width={PHONE_W} height={PHONE_H}>
            <ProgressScreen theme="light" />
          </DCArtboard>
        </DCSection>

        <DCSection id="reader-controls" title="Reader controls" subtitle="In-context font, theme, and behavior — opened from the Aa button in the reader.">
          <DCArtboard id="settings-sepia" label="Settings sheet · sepia" width={PHONE_W} height={PHONE_H}>
            <ReaderSettingsScreen theme="sepia" />
          </DCArtboard>
          <DCArtboard id="settings-dark" label="Settings sheet · night" width={PHONE_W} height={PHONE_H}>
            <ReaderSettingsScreen theme="dark" />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Reader (Live artboard)">
            <TweakSelect
              label="Theme"
              value={tweaks.heroTheme}
              options={[
                { value: "light", label: "Day (paper)" },
                { value: "sepia", label: "Sepia"       },
                { value: "dark",  label: "Night"       },
              ]}
              onChange={(v) => setTweak("heroTheme", v)}
            />
            <TweakSelect
              label="Translation UX"
              value={tweaks.heroTranslationMode}
              options={[
                { value: "tooltip",    label: "Tooltip bubble" },
                { value: "panel",      label: "Floating chip"  },
                { value: "sheet",      label: "Bottom sheet"   },
                { value: "sheet-rich", label: "Sheet — rich"   },
              ]}
              onChange={(v) => setTweak("heroTranslationMode", v)}
            />
            <TweakToggle
              label="Highlight unknown words"
              value={tweaks.heroShowHighlights}
              onChange={(v) => setTweak("heroShowHighlights", v)}
            />
            <TweakRadio
              label="Typeface"
              value={tweaks.heroTypeface}
              options={[
                { value: "serif", label: "Serif" },
                { value: "sans",  label: "Sans" },
              ]}
              onChange={(v) => setTweak("heroTypeface", v)}
            />
          <TweakSlider
            label="Reading size"
            value={tweaks.heroFontSize}
            min={15} max={24} step={1} unit="px"
            onChange={(v) => setTweak("heroFontSize", v)}
          />
        </TweakSection>

        <TweakSection label="Typography (live language artboard)">
          <TweakSelect
            label="Book language"
            value={tweaks.heroLang}
            options={[
              { value: "en", label: "English · Source Serif" },
              { value: "ru", label: "Русский · Lora" },
              { value: "ja", label: "日本語 · Shippori Mincho" },
              { value: "ko", label: "한국어 · Noto Serif KR" },
              { value: "ar", label: "العربية · Amiri (RTL)" },
              { value: "hi", label: "हिन्दी · Tiro Devanagari" },
            ]}
            onChange={(v) => setTweak("heroLang", v)}
          />
        </TweakSection>

        <TweakSection label="Brand">
          <TweakColor
            label="Accent"
            value={tweaks.accent}
            options={ACCENT_OPTIONS}
            onChange={(v) => setTweak("accent", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
