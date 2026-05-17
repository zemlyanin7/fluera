# #4.5 Translation Popup — Manual Smoke Matrix

**Version:** v2.2  
**Date:** 2026-05-17  
**Devices:** iPhone SE 2 (iOS 17, small screen) · iPhone 13 (iOS 18, standard) · Pixel 7 (Android 14)

## Instructions

For each scenario:
- Mark PASS / FAIL / SKIP per device column
- Record device OS version and build hash in the header row
- Run in a book with EN→RU language pair minimum; re-run AR→EN for RTL scenario

---

## Smoke Matrix

| # | Scenario | Test Steps | Expected | iPhone SE 2 | iPhone 13 | Pixel 7 |
|---|----------|-----------|----------|-------------|-----------|---------|
| 1 | **Word tap — bottom placement** | Open a book. Tap a word in the middle of the page. | Popup appears below the tapped word. Arrow points up toward word. Word highlighted. | | | |
| 2 | **Word tap — top placement** | Tap a word in the bottom 30% of the screen. | Popup appears above the tapped word. Arrow points down. No overlap with tab bar. | | | |
| 3 | **Word tap — modal sheet placement** | Tap a word when screen height is too small for either top/bottom (e.g. keyboard open, or force narrow viewport). | Bottom sheet slides up with translation content at ≥50% snap point. | | | |
| 4 | **Long-press → sentence translation** | Long-press any word for ~600ms. | Full-sentence translation popup appears. Mode chip shows "sentence". ExperimentalBadge visible at top. | | | |
| 5 | **ExperimentalBadge visibility** | Open sentence translation popup (long-press). | ⚠️ badge rendered. `accessibilityRole=alert`. VoiceOver announces badge text. | | | |
| 6 | **Dislike button — tap + toast** | Open any translation popup. Tap 👎 Dislike button. | Button enters selected state. Toast / Alert: "Thanks, we'll note that". Feedback recorded locally. | | | |
| 7 | **Dislike button — Settings entry** | After logging a dislike, navigate to Settings → Translation → Feedback. | Feedback entry appears with source sentence, translated text, timestamp, and model version. | | | |
| 8 | **Drag multi-word selection** | Long-press a word, then drag to adjacent words without lifting. | Selection extends to dragged words. Popup title shows selected phrase (2–3 words). | | | |
| 9 | **MWE auto-expand** | Open a book with an English idiom (e.g. "kick the bucket"). Tap first word of idiom. | MWE chip appears ("idiom"). Chip tap expands to show idiom translation. Phrase highlighted. | | | |
| 10 | **False-friend chip** | Open a book with a word that is a false friend (e.g. "actual" in EN→RU). Tap the word. | False-friend chip appears below translation. Chip is collapsed by default. Tap → expands to show warning. | | | |
| 11 | **RTL Arabic book** | Change book language to Arabic. Open a chapter. Tap a word. | Popup layout is RTL. Arrow direction is reversed. Text is right-aligned. No layout overflow. | | | |
| 12 | **CJK per-character tap** | Change book language to Japanese. Open a chapter. Tap a single kanji character. | Single character is translated. Popup shows kanji + reading + meaning. No crash. | | | |
| 13 | **VoiceOver (iOS) / TalkBack (Android)** | Enable VoiceOver/TalkBack. Navigate to a word. Double-tap to activate translation. | Translation result announced by screen reader. "Loading translation" interim announcement. ExperimentalBadge announced as alert. | | | |
| 14 | **Dynamic Type AX5** | In iOS Accessibility settings set text size to AX5 (largest). Open reader, tap word. | Popup layout adapts. No text truncation or overlap. Buttons remain tappable (≥44pt). | | | |
| 15 | **Reduce Motion** | Enable Reduce Motion in Accessibility settings. Open reader, tap word. | Popup appears without fade/slide animation. Translation loads without animated shimmer. | | | |
| 16 | **Reduce Transparency** | Enable Reduce Transparency in Accessibility settings. Open reader, tap word. | Popup background is fully opaque (no blur/frosted glass). Text legibility maintained. | | | |
| 17 | **Coach mark first-run** | Clear app data (or fresh install). Open a book. Tap first word. | Coach mark overlay appears explaining long-press for sentence translation. "Got it" and "Skip" buttons present. Dismisses on either tap. Does not reappear on second launch. | | | |
| 18 | **Performance: cache hit <500ms** | Tap the same word twice. Second tap should be faster. | Second popup appears in under 500ms (visually instant). No loading shimmer on cache hit. | | | |

---

## Pre-conditions

- Build: `npx expo run:ios` / `npx expo run:android` (dev-client)
- Book: at least 1 EPUB/FB2 loaded with an EN or AR book language
- Translation model installed (Hy-MT1.5-1.8B-1.25bit)
- i18next locale matches device system language OR forced to EN for consistency

## Out of Scope

- Automated regression: covered by Jest unit tests (`npx jest`)
- chrF/FLORES translation quality eval — deferred to v2
- Whole-book translation — cut from v1

## Sign-off

| Role | Name | Date |
|------|------|------|
| Dev | | |
| QA | | |
