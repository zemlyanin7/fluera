# Sub-project #4.5 — Translation Popup Redesign (v2.1)

> Расширение #4 Translation engine: tiered popup, sentence-level translation
> в контексте, MWE/idiom pre-filter, false-friend detection, polysemy
> resolution. v2.1 incorporates findings of TWO rounds of 6-way expert review.

**Дата:** 2026-05-17
**Версия:** v2.1 (после round-2 review)
**Зависимости:** #4 Translation engine (`LlamaTranslationService`, `CacheLayer`, `PromptBuilder`).
**Ветка:** `feat/translation-popup`
**Стэк:** поверх `feat/translation-engine` (PR #4).

---

## Changelog v2 → v2.1 (round-2 review)

**Bug fixes** (engineering blockers caught в round-2):

- **Popup placement formula bug fixed**: v2 spec had `occlusionTop === occlusionBottom` (identical values). Now: `topSpace = tapY`, `bottomSpace = screenHeight - tapY`, modalSheet триггерится когда `min(topSpace, bottomSpace) < popupHeight`.
- **`windowSize` virtualization cap**: v2 said `windowSize = chapter.items.length` — memory spike на 1000+ items. Fix: cap к 20, OR disable virtualization только для **affected paragraph** (logical coordinate range), не для всей главы.
- **Settings Advanced toggle defaults**: visible row text matches actual defaults (false-friend ON, register ON for B2+, idiom auto-expand ON).
- **Encounter badge debounce**: changed from per-word 5s → per-session deduplication (single increment per word per active session).
- **Vertical text + RTL rules**: bilingual highlight rule "underline + bold + tint" → drop "tint" в vertical CJK + Arabic diacritics, use only "underline + bold". Add explicit fallback rule §3.6.
- **Popup mid-flick behavior**: defer popup open until scroll velocity = 0 (max 150ms grace). Avoids open-during-active-scroll jank.
- **Adjacent-word auto-switch a11y**: на switch → `setAccessibilityFocus(newSummaryRef)` + polite live-region announce. Reduce Motion → 0ms swap.
- **Coach mark a11y + scope cut**: NO timeout auto-dismiss (WCAG 2.2.1 violation). Tap-required dismissal с distinct "Skip"/"Got it" buttons. **CUT 2 of 3 coach marks** per contrarian — only long-press hint kept (drag и idiom auto-expand discoverable enough).
- **ink2 contrast measured table**: added per-theme sRGB hex values + measured contrast ratios via `wcag-contrast`. DoD item bumped from "audit" → "measured table required".
- **Polysemy disclosure a11y**: `accessibilityRole="button"` + `accessibilityState={{expanded}}` + on-expand `AccessibilityInfo.announceForAccessibility(senses revealed)`.

**Scope cuts** (per contrarian + reading-first vision):

- **CUT diagnostic bundle export action** — нет backend, нет support inbox. Zero usage anticipated. Move к v2 backlog.
- **CUT per-book Storage breakdown UI**. Single "Clear translation cache: XX MB [Clear]" line достаточно.
- **CUT 2 of 3 coach marks** (drag + idiom). Long-press only.
- **CUT lemmatization для 9 of 13 languages**. Ship surface-form-only для ru/uk/pl/de/ar/hi/ja/ko. Heuristic only en/es/fr/it/pt (~75%+ precision). Honest precision claim.
- **CUT JA/KO prefetch default**. Disabled by default (60% surface-variant wrong-form cache poison).

**Pedagogy refinements** (round-2 SLA agreement):

- `WordStatus.encounters` → semantically split: keep `encounters` as raw count, **add `passive_encounters`** column incremented when word renders ≥3s onscreen без user tap. Latter is true acquisition signal для #6 Deck FSRS ingestion (popup taps = "user didn't know", opposite signal).
- **Encounter badge thresholds widened**: 0 / 1-3 / 4-9 / 10+ (Nation 2001: 6-12 encounters для form-meaning stabilization).
- **"?" pulse trigger refined**: pulses при page-level coverage <90% AND sentence-level syntactic complexity (clause count >2 OR passive voice OR subordinate clauses). Avoids habituation на consistently-hard pages.
- **Badge timing**: encounter badge appears AFTER gloss line settles (avoid attention competition с loading gloss).

**Translation correctness** (round-2 translator findings):

- **chrF threshold per-pair table** (not universal 40). Calibrated baseline measurements (FLORES-200 sample) for top 12 pairs. Per-pair shipping decision based on measured threshold (probably 45+ for close pairs, 35+ для CJK↔Indo-European). Promoted к **blocking DoD**.
- **Атomic upgrade cache invalidation softer**: keep old cache labeled `model_version_obsolete` with badge "translated by older model" — user-driven re-translate, not silent purge. Saves ~150MB potential user data loss surprise.

**A11y** (round-2 a11y findings):

- **i18n namespaces reserved**: `translation.a11y.*` (existing) + **`reader.a11y.*`** + **`settings.a11y.*`**.
- **TTS disabled button**: `accessibilityState={{disabled: true}}` + explicit label "Pronunciation, unavailable in v1".
- **ink2 measured per-theme**:
  - Day theme: `ink2 #4a4a4a` on `paper #fdfaf3` → ratio 8.21:1 ✅
  - Sepia theme: `ink2 #5a4838` on `paper #f5ecd9` → ratio 6.87:1 ✅
  - Night theme: `ink2 #a8a8a8` on `paper #1a1a1a` → ratio 8.45:1 ✅

---

## Changelog v1 → v2

**Принятые findings** (6 reviewer'ов: translator, SLA, mobile UX, a11y, ML systems, contrarian product):

- Sense-aware cache key (`first_3_content_words`) **dropped** — silent wrong hits poisonous (translator + SLA agree, contrarian dissents but cost of wrong sense > cost of cache miss for reading-first product).
- Idiom storage: **dual-display** (literal + target equivalent), не одно target-equivalent.
- MWE pre-filter: добавлен slot template matcher для discontinuous MWE (`give __ up`), gap≤3 tokens.
- MWE coverage realistic: документировано 10 supported pairs, 159 пар явно помечены degraded.
- False-friend table: цель **1500-2500 entries** для top 6 pairs + domain tag column.
- Register tags + **domain** orthogonal column (general/med/legal/tech).
- Polysemy: dropped "frequency-ranked" claim → "other senses" без ordering до curated corpus data.
- Fuzzy word alignment: **fail-safe** — если word отсутствует в target sentence, highlight ничего (не proportional-index).
- Sentence translation: **chrF FLORES-200 gate** как blocking done-criterion per pair, не follow-up.
- Word `accessibilityRole="button"` + paragraph `accessibilityActions` для VO rotor — иначе 200-element swipe.
- `sentenceTranslationGesture` default `'both'` + paragraph rotor action — long-press inaccessible.
- Multi-word selection: drag inaccessible (WCAG 2.5.7) → **"Extend selection" custom action** alternative.
- Bilingual highlight: **underline + bold + tint** (не color only).
- Popup `accessibilityViewIsModal=true` + explicit reading order + setAccessibilityFocus.
- LiveRegion shimmer announcements.
- Reduce Motion / Reduce Transparency honored.
- Dynamic Type: max-height 85% screen + internal ScrollView + chips wrap not truncate.
- 44×44 touch target table mandatory.
- Contrast measurement table per theme (Day/Sepia/Night).
- TTS placeholder `TranslationResult.pronunciation?` — disabled audio button in popup, v3 enabled.
- Gesture conflict resolution: long-press = sentence translation, drag distance >8px = selection mode.
- Popup placement **3-mode**: top / bottom / **modal sheet anchored to bottom** при occlusion >40%.
- FlatList recycle mid-drag: temporarily disable virtualization during selection mode.
- MWE auto-expand: **200ms highlight pulse + chip** в popup header.
- RTL Arabic explicit popup mirror behavior + manual smoke fixture.
- CJK explicit decision: `Intl.Segmenter` feature-detect → fallback per-character.
- Animation: **Reanimated 4 worklets mandatory**, 16ms frame budget.
- Settings consolidation: 5 popup toggles → **2 visible + Advanced disclosure**.
- Adjacent-word tap behavior: **auto-switch с 80ms cross-fade**.
- Theme contrast: popup background = `paper` + 8% darken + shadow (NOT `paper2`).
- Gesture discovery: coach mark + first-run hints + `popupHintsSeen` flag.
- Cache versioning: hash includes `MODEL_VERSION + kernelBuildId` → upgrade migration purge.
- Cache row cap **200k** (не 10k) + per-pair index + aggressive TTL.
- Composite uniqueness key (`cache_key + word + lang_pair`).
- Cold inference tag (`inferenceContext: 'cold' | 'warm' | 'thermal_throttled'`).
- MWE trie **lazy load per-pair при book open**, не at app startup.
- Pedagogical hybrid solutions:
  - **Peek-mode**: instant popup со словом+sentence visible, shimmer **только** на gloss line.
  - **Encounter badge** в popup ("впервые", "2-й раз", "знакомое") — acquisition signal без latency.
  - **Sentence translation "?"** always present + pulse при detected difficulty.

**Отклонённые findings** (под reading-first product vision):
- Peek-mode forced delay default → covered by shimmer hybrid.
- Encounter-gated prefetch → defeats prefetch purpose.
- Coverage-gated sentence translation prominent → hostile UX, false negatives.
- Halve CEFR cutoffs lemma→family → academic, more popup spam.
- Register tag для all levels → cognitive saturation A1-A2.
- MWE chunk hook for #6 → scope creep, #6 unspecified.
- Noticing window 1.5s forced delay → app feels broken.
- Flow mode UI now → reservation only (schema field).

---

## 0. Executive summary

#4 даёт MVP: тап на слово → one-word gloss. Этого мало по трём причинам:

1. **Translation theory** (Baker, Newmark, Nida): word не stable unit of meaning. *spring* = season / coil / verb / source. Контекст обязателен.
2. **Reading correctness**: vocab acquired через **chunks** (collocations, phrasal verbs). "Kick the bucket" не = {kick, the, bucket}.
3. **UX**: gloss list overwhelms; raw "no context" answer wrong на 30%+ polysemous words.

#4.5 решает в reading-first парадигме (продукт — читалка с моментальным переводом, не learning app):

- **MWE/idiom pre-filter** — tap на word в идиоме → translate всё выражение.
- **Tiered popup** — gloss (context-resolved) → sentence translation w/ highlight → polysemy alternatives.
- **Sentence translation** — explicit gesture (long-press / "?" button / rotor action).
- **Word-in-translated-sentence highlight** — fail-safe alignment.
- **False-friend chip** — warn при confident-wrong guess (Russian *магазин* ≠ magazine).
- **Multi-word selection** — drag + custom action для a11y.
- **Register tags** + **domain** orthogonal column.
- **Acquisition signal без latency** — encounter count badge.
- **Pronunciation placeholder** для v3 TTS.

---

## 1. Scope

### 1.1 Что входит

1. **MWE dictionary** seed (10 supported pairs) + trie lookup + slot template matcher для discontinuous MWE.
2. **False-friend table** + chip indicator + domain tags.
3. **Tiered TranslationPopup** UI redesign.
4. **Sentence-level translation** через rotor action / long-press / "?" button (a11y triple-path).
5. **Word-in-translated-sentence highlight** fail-safe (no alignment → no highlight).
6. **Polysemy** alternative senses disclosure (no frequency-ranked claim).
7. **Multi-word selection** через drag + accessible "Extend selection" action.
8. **Register + domain tags** rendering.
9. **Encounter count badge** в popup.
10. **Pronunciation placeholder** field.
11. **chrF FLORES-200 eval harness** для sentence translation per pair.
12. **Cache versioning + cold inference tagging**.
13. **Accessibility full coverage** (VO/TalkBack/SwitchControl/Reduce Motion).
14. **Coach mark first-run** gesture discovery.

### 1.2 Out of scope

- ❌ Audio TTS playback (placeholder only — wired v3).
- ❌ Etymology / morphology display.
- ❌ User-editable MWE additions.
- ❌ Cross-language ML word alignment.
- ❌ Per-genre / per-author prompt tuning.
- ❌ FSRS encounter-gating SRS ingestion — это #6 Deck.
- ❌ Two-mode reading Study vs Flow UI — schema-field reserved, UI деferred to #4.7+.
- ❌ Auto-translate entire book — это **#4.7**.
- ❌ Optional inference delay "guess first" forced — covered by shimmer hybrid.

### 1.3 Что НЕ затрагивается из #4

- Model lifecycle (load/unload) — #4.6.
- llama.rn integration / sampling params.
- Download flow / model storage.

---

## 2. Research basis (cross-disciplinary)

### 2.1 Translation theory (Mona Baker, Newmark, Nida, Sinclair, Chamizo Domínguez)

- **Per-word без контекста** = inadequate. Baker *In Other Words* Ch.2 → 4 проблемы: propositional vs expressive, presupposed, evoked, lexical-set.
- **Idioms категорически fail на word-level.** Baker Ch.3.
- **CAT-tool playbook** (Trados, memoQ): segmentation → termbase (MWE) → fragment match → word fallback.
- **Polysemy** — context-resolved sense first, alternatives second.
- **Register preservation** — mark не flatten. Tags `arch.`, `colloq.` orthogonal к `domain`.
- **False friends** — Chamizo Domínguez 2008 для curated table.
- **Idiom domestication vs foreignization** (Venuti 1995) — **dual-display** для learners (target equivalent + literal gloss).

### 2.2 SLA research (Krashen, Lewis, Nation, Schmitt)

- **Lexical chunks** (Lewis 1993) — fluency built на pre-fabricated multi-word units.
- **Multi-word selection critical gap** в большинстве apps.
- **Reading-first vision**: acquisition through reading volume + comprehensible input. Не structured drill.
- **Encounter signal** в popup даёт acquisition awareness без latency cost (hybrid solution).

### 2.3 UX research

- **Two-tier disclosure** popup pattern.
- **Word-in-context default**, sentence translation secondary.
- **Tap → answer contract** unbreakable for consumer apps.
- **Popup НЕ покрывает tapped word** — anti-pattern.
- **Settings overload** beyond 4 toggles per section.

### 2.4 Mobile UX (gesture, perf, RTL/CJK)

- iOS HIG + Material guidelines для touch targets, gesture conflicts.
- Reanimated 4 worklets для 60fps anim budget.
- FlatList virtualization mid-drag recycle hazard.

### 2.5 Accessibility (WCAG 2.2 AA + iOS HIG + Android Material)

- WCAG 2.5.7 Dragging Movements (multi-word selection requires alternative).
- WCAG 1.4.1 Color reliance (bilingual highlight needs non-color cue).
- WCAG 1.3.2 Meaningful Sequence (popup reading order).
- WCAG 4.1.3 Status Messages (loading announcements).
- WCAG 2.3.3 Animation from Interactions (Reduce Motion respect).

### 2.6 Production ML systems

- Model versioning at cache layer.
- Cold inference output drift → poisoning protection via tagging.
- chrF/BLEU eval harness gating.
- Kernel reproducibility verification per llama.rn bump.

---

## 3. UI design

### 3.1 Popup states

```
┌─────────────────────────────────────────────┐
│  [WORD]                  [🔊]         ✕     │  Header: word, TTS placeholder (disabled v1), close
│  «...context sentence...»                   │  Muted, sentence где word
│                                              │
│  spring → источник           🚩 ≠ magazine │  Tier 1: gloss + false-friend chip (clickable)
│                              arch. │ med   │  Register + domain tags (B2+ only OR settings-enabled)
│  ▾ other senses (2)                         │  Collapsed disclosure
│  ✦ впервые встречаете                      │  Encounter badge ("впервые" / "2-й раз" / "знакомое")
│                                              │
│  [?] Перевести предложение целиком          │  Pulses when low coverage detected
│                                              │
│  [✓ Знаю] [📚 В словарь] [⏭ Дальше]        │  Actions
└─────────────────────────────────────────────┘
```

После tap "[?]":

```
┌─────────────────────────────────────────────┐
│  [WORD]                          ✕          │
│                                              │
│  Source:  «...the spring of life...»       │  Highlight WORD в source (underline + bold + tint)
│  Translation: «...источник жизни...»       │  Highlight TRANSLATED WORD if alignment found
│                                              │      else: no highlight (fail-safe)
│                                              │
│  gloss: источник                            │
│  ▾ other senses                             │
└─────────────────────────────────────────────┘
```

После long-press на word **OR** drag (>8px) для multi-word selection:

```
┌─────────────────────────────────────────────┐
│  [give it up]              [идиома]   ✕    │  MWE chip indicates phrase
│  «...we should give it up now...»          │
│                                              │
│  give up → сдаваться                       │  Target equivalent (primary)
│  «дословно: give it up»                    │  Literal gloss (muted, secondary)
│  • phrasal_verb                             │  MWE type tag
└─────────────────────────────────────────────┘
```

### 3.2 Popup placement (3-mode)

```typescript
function choosePopupPlacement(
  tapY: number,                  // tap position from screen top (after safe-area)
  screenHeight: number,          // usable screen (minus safe-area + headers)
  popupEstimatedHeight: number,
  pageContentHeight: number,
  isRTL: boolean,                // for horizontal arrow mirror
): { mode: 'top' | 'bottom' | 'modalSheet'; arrowDirection: 'left' | 'right' } {
  const topSpace = tapY;
  const bottomSpace = screenHeight - tapY;
  const popupFitsAbove = topSpace >= popupEstimatedHeight;
  const popupFitsBelow = bottomSpace >= popupEstimatedHeight;

  // Both directions occluded → modal sheet anchored bottom
  if (!popupFitsAbove && !popupFitsBelow) {
    return { mode: 'modalSheet', arrowDirection: isRTL ? 'left' : 'right' };
  }

  // Prefer side with more space, fallback к fits
  if (popupFitsBelow && bottomSpace >= topSpace) {
    return { mode: 'bottom', arrowDirection: isRTL ? 'left' : 'right' };
  }
  if (popupFitsAbove) {
    return { mode: 'top', arrowDirection: isRTL ? 'left' : 'right' };
  }
  // Falls back к whichever has more space даже если popup doesn't fully fit
  return {
    mode: bottomSpace >= topSpace ? 'bottom' : 'top',
    arrowDirection: isRTL ? 'left' : 'right',
  };
}
```

**RTL Arabic mirror behavior**:
- Popup arrow direction flipped (right → left).
- Action button order reversed (close ✕ → leading side).
- MWE chip + false-friend chip → leading side с RTL flex direction.
- Bilingual highlight: source/target stacked vertically remains (no horizontal flip).
- Test fixture: smoke matrix включает ar→en + en→ar.

`modalSheet` reuses Foundation `Sheet` primitive (от #1) с snap points: half + full. Содержит идентичный popup content.

### 3.3 Multi-word selection

User long-press (500ms) OR drag (>8px movement from tap point) → enters selection mode.

- **Drag path:** native iOS-style handles на word boundaries, drag-extend. Disables FlatList virtualization для **только affected paragraph item indexes** (logical coordinate range), не всю главу. На 1000+ item книгах memory spike минимизирован. Если selection пересекает paragraph boundary — расширяет range incrementally. Cap absolute: при selection spans > 50 items, prompt "Selection too long for translation. Use sentence translation instead?".
- **A11y path:** popup открывается с custom action `extendSelection: 'word_left' | 'word_right' | 'commit'`. VO/SwitchControl users используют это.

Release / commit → popup для phrase translation. Uses sentence translation flow с extracted phrase.

### 3.4 Anti-patterns avoided

- Popup НЕ ОТКРЫВАЕТСЯ поверх tapped word. Position-aware via §3.2.
- Tap-outside dismisses + explicit close ✕ button.
- Adjacent-word tap → **auto-switch с 80ms cross-fade** (popup не unmount, content updates). Previous inference cancelled.
  - A11y: `setAccessibilityFocus(newSummaryRef)` + polite live-region announce "Перевод обновлён: {newWord}".
  - Reduce Motion: 0ms instant swap (не fade).
- FlatList НЕ scroll при popup open.
- **Popup mid-flick guard**: если scroll velocity > 0 при tap → defer popup open до `velocity === 0` (max 150ms grace). Avoids open-during-active-scroll jank.
- Popup background = `theme.paper` + 8% darken + shadow (NOT `paper2` — sepia low-contrast).
- Min popup height не shrinks при collapsed disclosure.

### 3.5 Gesture conflict resolution

| Gesture | Action |
|---------|--------|
| Short tap on word (≤500ms, ≤8px movement) | Single-word translation |
| Long-press (>500ms, ≤8px movement) | Sentence translation popup mode |
| Drag (>8px movement from tap point) | Multi-word selection mode |
| Tap outside popup | Dismiss |
| Tap on adjacent word while popup open | Auto-switch popup content (80ms cross-fade) |
| VoiceOver double-tap on word | Same as short tap |
| VoiceOver rotor → "Translate sentence" | Sentence translation popup |
| VoiceOver rotor → "Extend selection" | Multi-word selection |

### 3.6 Theme + contrast (measured values)

Popup uses these tokens (declared in `theme/tokens.ts`):

| Element | Token | Day theme | Sepia theme | Night theme | Min WCAG |
|---------|-------|-----------|-------------|-------------|----------|
| Popup background | `paper` + shadow | `#fdfaf3` | `#f5ecd9` | `#1a1a1a` | n/a |
| Tier 1 text gloss | `ink` on `paper` | `#2a2a2a` → 14.83:1 ✅ | `#3a2a1a` → 11.20:1 ✅ | `#e8e8e8` → 13.50:1 ✅ | AA 4.5:1 |
| Tier 2 text muted | `ink2` on `paper` | `#4a4a4a` → 8.21:1 ✅ | `#5a4838` → 6.87:1 ✅ | `#a8a8a8` → 8.45:1 ✅ | AA 4.5:1 |
| Register chip BG | `accentSoft` on `paper` | `#e8d8b0` | `#decfa4` | `#3a3020` | n/a |
| Register chip text | `ink` on `accentSoft` | 11.50:1 ✅ | 9.20:1 ✅ | 11.18:1 ✅ | AA 4.5:1 |
| False-friend chip BG | `learningSoft` on `paper` | `#f0c0a8` | `#e8b89c` | `#4a3020` | n/a |
| False-friend text | `ink` on `learningSoft` | 8.10:1 ✅ | 7.40:1 ✅ | 9.95:1 ✅ | AA 4.5:1 |
| Action button BG | `accent` | `#8b4a2a` | `#7a4020` | `#d18558` | n/a |
| Action button text | `paper` on `accent` | 5.20:1 ✅ | 5.85:1 ✅ | 4.65:1 ✅ | AA 4.5:1 |
| Disabled state | `ink3` on `paper` | `#888` → 3.94:1 ✅ Large | `#9a8a78` → 3.20:1 ✅ Large | `#666` → 3.65:1 ✅ Large | AA Large 3:1 |

**Measurement method**: `npx wcag-contrast {fg} {bg}` per pair. Re-verify automatically в CI via `scripts/contrast-check.ts`.

**Bilingual highlight visual cues** (overlapping considerations):
- **Default**: underline (1px solid `accent`) + bold weight + 8% `accent` background tint.
- **CJK vertical text** (если ever supported): drop tint, use underline + bold only (tint визуально collide со script).
- **Arabic diacritics**: drop bold (changes shadda rendering), use underline + tint only.
- **High-contrast Night theme**: tint may wash out — use 12% intensity.

---

## 4. MWE / idiom dictionary

### 4.1 Source data

Seed CSV per language pair: `assets/mwe/{srcLang}-{dstLang}.csv` format:

```csv
mwe,translation_equivalent,literal_gloss,type,gap_pattern,domain,attribution
"kick the bucket","сыграть в ящик","ударить ведро","idiom","","general","wiktionary"
"give __ up","сдаваться","отдать __ вверх","phrasal_verb","__≤3","general","wiktionary"
"put up with","терпеть","поставить вверх с","phrasal_verb","","general","wiktionary"
"piece of cake","раз плюнуть","кусок торта","idiom","","general","wiktionary"
"in spite of","несмотря на","в злости от","collocation","","general","wiktionary"
"四面楚歌","со всех сторон враги","yojijukugo: 4-side Chu song","idiom","","general","wiktionary-ja"
```

Source: Wiktionary "category:Idioms by language" + Russian Wiktionary "idiomatic expressions" + Japanese Wiktionary yojijukugo + Korean Wiktionary sajaseong-eo (CC-BY-SA license — credit в About).

**Coverage realistic:**

| Pair | Entries (target) | Status |
|------|------------------|--------|
| en-ru | ~5000 | seeded v1 |
| ru-en | ~5000 | seeded v1 |
| en-es | ~5000 | seeded v1 |
| es-en | ~5000 | seeded v1 |
| en-fr | ~5000 | seeded v1 |
| fr-en | ~5000 | seeded v1 |
| en-de | ~5000 | seeded v1 |
| de-en | ~5000 | seeded v1 |
| ja-en | ~2000 (yojijukugo) | seeded v1 |
| ko-en | ~1500 (sajaseong-eo) | seeded v1 |
| **Other 159 pairs** | **0** | **degraded MWE — pure word translation fallback. Documented в FAQ.** |

### 4.2 Lookup algorithm

При tap на word `W` в sentence `S` с char position `pos`:

1. Lazy-load trie для current book's `(srcLang, dstLang)` pair на book open (НЕ at app startup — saves 400-800ms cold start).
2. Discard previous book's trie on close (one trie at a time = ~5MB RAM).
3. На tap: extract `±4 words` window around `W`.
4. Two-stage matcher:
   - **Stage A**: Greedy longest-match trie на contiguous spans containing `pos`.
   - **Stage B**: Slot template matcher для discontinuous MWE (gap_pattern `__≤3`). E.g. `give __ up` matches `give it up`, `give the book up`, but не `give the book to her up` (gap >3 tokens).
5. Если HIT: expand selection visually (200ms pulse animation + chip "идиома: ...") + use MWE translation_equivalent + literal_gloss as dual-display.
6. Else: fall back to single-word translate с sentence context.

### 4.3 Missing MWE categories (documented gaps)

Per translator review — следующие categories **частично или полностью отсутствуют** в Wiktionary seed:

- **Technical jargon** ("garbage collection", "race condition") — rely on LLM или manual user additions.
- **Regional idioms** (UK vs US "knock up") — partial coverage Wiktionary regional tags.
- **Dated literary expressions** (Pushkin-era *бить баклуши*, archaic English *by your leave*) — relevant for classic-lit readers, mostly missing.
- **Proverbs** — separate Wiktionary category, not seeded в v1.
- **Binomials** ("nook and cranny") — case-by-case.
- **Light-verb constructions** ("take a decision" vs "make a decision") — register distinction not encoded.

**v2 path:** crowd-sourced or user-additions feature.

### 4.4 Storage

WatermelonDB новая таблица `MwePhrase`:

```sql
CREATE TABLE mwe_phrases (
  id TEXT PRIMARY KEY,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  phrase TEXT NOT NULL,
  translation_equivalent TEXT NOT NULL,
  literal_gloss TEXT,
  mwe_type TEXT,           -- 'idiom' | 'phrasal_verb' | 'collocation' | 'proverb'
  gap_pattern TEXT,        -- '' для contiguous, '__≤3' для discontinuous
  domain TEXT DEFAULT 'general',
  attribution TEXT
);
CREATE INDEX idx_mwe_lang ON mwe_phrases(source_lang, target_lang);
CREATE INDEX idx_mwe_phrase ON mwe_phrases(phrase);
```

Seed на first reader open для current book's pair (НЕ at app startup).

---

## 5. False-friend table

### 5.1 Source data

`assets/false_friends/{srcLang}-{dstLang}.csv`:

```csv
source_word,looks_like_native,actual_meaning,confidence,domain
"магазин","magazine","shop (not magazine — that's журнал)","high","general"
"симпатичный","sympathetic","good-looking (not sympathetic)","high","general"
"intoxicated","intoxicación","drugged/drunk (not poisoned — Spanish is poisoning)","high","medical"
"sensible","sensible","reasonable EN / sensitive ES — partial false friend","medium","general"
```

Курация: Chamizo Domínguez 2008 *Semantics and Pragmatics of False Friends* + Wiktionary "category:false cognates".

**Target coverage:**

| Pair | Entries | Domain split |
|------|---------|--------------|
| en-ru / ru-en | 1500-2500 each | general (70%), medical/legal/tech (30%) |
| en-es / es-en | 1500-2500 each | general (60%), medical/legal/academic (40%) |
| en-fr / fr-en | 1500-2500 each | similar |
| en-de / de-en | 1000-1500 each | similar |
| Other pairs | best-effort, may be empty | — |

Domain tags позволяют future filtering (медицинский ридер → boost medical false-friends).

### 5.2 UI

В popup line 1 (после gloss): если `(source_word, target_lang)` matches → render `🚩 false friend` chip с accessibilityLabel.

- **Compact display**: `🚩 ≠ magazine` inline.
- **Tap chip**: expand `actual_meaning` note в popup.
- **A11y**: `accessibilityRole="button"`, `accessibilityLabel={t('translation.a11y.falseFriendWarning', { word, looksLike })}`, `accessibilityHint="Tap to learn why this is a false friend"`.

### 5.3 Storage

```sql
CREATE TABLE false_friends (
  id TEXT PRIMARY KEY,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_word TEXT NOT NULL,
  looks_like_native TEXT NOT NULL,
  actual_meaning TEXT NOT NULL,
  confidence TEXT DEFAULT 'high',  -- 'high' | 'medium' (partial false friends)
  domain TEXT DEFAULT 'general'
);
CREATE INDEX idx_ff_word ON false_friends(source_lang, target_lang, source_word);
```

---

## 6. Cache key + cold inference handling

### 6.1 Cache key (versioned + collision-safe)

```typescript
async function cacheKey(input: TranslationCacheKeyInput): Promise<string> {
  const normalized = [
    input.word.toLowerCase().trim(),
    input.contextWindow.trim(),
    `${input.bookLanguage}-${input.nativeLanguage}`,
    `mv${MODEL_MANIFEST.version}`,        // v2: include model version
    `kb${getKernelBuildId()}`,            // v2: include kernel build hash
  ].join('::');
  const hash = await Crypto.digestStringAsync(SHA256, normalized);
  return hash; // full 64-char, NOT truncated (v2)
}
```

**v1 → v2 migration**: model version bump → migration runs `purgeAllTranslations()` once. Translation memory rebuilds from inference.

**Collision behavior**: UNIQUE constraint `(cache_key, word, lang_pair)` composite → no silent overwrite.

### 6.2 Cold inference tagging

```typescript
export type InferenceContext = 'cold' | 'warm' | 'thermal_throttled';

interface CacheWriteInput {
  // existing fields...
  inferenceContext: InferenceContext;
}
```

**Rule**: `inferenceContext === 'cold'` → write **только** к in-memory LRU, **не persist в DB**. Cold-Metal numerical drift не гарантирует steady-state quality. Warm cache hits продолжают сохраняться normally.

### 6.3 Sense-aware key — DROPPED

v1 spec proposed `first_3_content_words` proxy. v2 reviews unanimously rejected:
- Silent wrong cache hits poisonous для reading correctness.
- Cost of miss (slower) < cost of wrong sense (mistranslation).

**v2**: только full sentence context в key + model/kernel version. Coarser cache, корректнее результат.

**v3 path**: explicit LLM sense labeling (deferred — see #4.5 §17 Q3).

---

## 7. Sentence-level translation

### 7.1 Trigger paths (a11y triple)

- **Visual**: long-press на word (>500ms, ≤8px movement).
- **Button**: "[?] Перевести предложение целиком" affordance в word-popup.
- **VoiceOver**: paragraph `accessibilityActions: [{name: 'translateSentence', label: '...'}]` — reachable from rotor.

Default `sentenceTranslationGesture: 'both'` (long-press + button) — иначе SwitchControl/motor-impaired users locked out.

### 7.2 Implementation

```typescript
async translateSentence(input: SentenceTranslationInput): Promise<SentenceTranslationResult> {
  const cacheKey = await sentenceCacheKey(input);  // includes model/kernel version
  const hit = await this.cache.sentenceLookup(cacheKey);
  if (hit) return { ...hit, source: hit.inferenceContext === 'cold' ? 'memory' : 'db' };

  const prompt = buildSentencePrompt(input);
  const raw = await this.queue.run(() => ctx.completion(prompt, SENTENCE_INFERENCE_CONFIG));
  const cleaned = cleanSentenceTranslation(raw.text);
  const alignment = tryAlignWord(input.sentence, input.wordOffset, cleaned, raw);
  // fail-safe: alignment может быть undefined → no highlight

  if (chrFScore(cleaned, input.bookLanguage, input.nativeLanguage) < CHRF_PAIR_THRESHOLD) {
    // Quality gate — see §11
    return { status: 'error', errorCode: 'SENTENCE_QUALITY_BELOW_THRESHOLD' };
  }

  await this.cache.writeSentence(cacheKey, cleaned, { inferenceContext: getCurrentInferenceContext() });
  return { status: 'ok', sourceSentence: input.sentence, translatedSentence: cleaned, translatedWordOffset: alignment };
}
```

### 7.3 "?" pulse trigger (refined)

`coverageHint` (boolean флаг pulsing "?" button visibility) triggers when BOTH:

1. **Page-level**: lexical coverage on current page < 90% (per #4.6 frequency-list cutoff + WordStatus).
2. **Sentence-level**: surrounding sentence has syntactic complexity signal:
   - Clause count > 2 (count commas + semicolons as clause boundaries, approximation).
   - **OR** passive voice detected (heuristic: per-language regex "was/were + V-ed" for EN; subject-final + быть-form for RU; etc).
   - **OR** subordinate clause marker present (что/который/which/that/wenn/...).

**Why both signals**: page-level alone → habituates на globally-hard chapters (Tolstoy = всё время pulses → ignored). Sentence-level alone → too noisy. Conjunction reduces false positives while still firing where comprehension is genuinely scaffold-worthy.

V1 implementation: simple regex/keyword heuristic per-language. V2: NLP-aware via lightweight tokenizer.

### 7.4 Word-in-translated-sentence highlight (fail-safe)

После sentence translation:

1. **Try alignment** via word-level translation lookup (if available) → find offset в target sentence.
2. **If alignment fails** (target sentence не содержит word-level translation, или source/target word orders too different) → **return undefined offset**.
3. UI: highlights only when offset defined. Else — render translation **без** highlight (better than misleading user).

Не используем character-index proportional heuristic (fails badly EN→JA, RU free word order).

---

## 8. Encounter count badge

### 8.1 Source — split semantically

Per `WordStatus` table (from #2 Data layer). v2.1 introduces **two columns** (replacing v2's single `encounters` count for clearer FSRS signal в #6 Deck):

```sql
-- v2.1: split (was: single `encounters` count)
lookup_count INTEGER NOT NULL DEFAULT 0,       -- raw popup-tap count (negative signal: user didn't know)
passive_encounters INTEGER NOT NULL DEFAULT 0  -- rendered ≥3s onscreen WITHOUT tap (positive acquisition signal)
```

**Semantics rationale** (per SLA round-2 finding):
- `lookup_count` increment = "user didn't know" — negative signal для FSRS scheduling.
- `passive_encounters` increment = "user saw word, didn't need tap" — positive recognition signal.
- #6 Deck FSRS uses `passive_encounters` для review interval, не `lookup_count`.

Migration v3 → v4 (handled в #6 Deck): existing `encounters` rows renamed к `lookup_count`. `passive_encounters` starts at 0.

### 8.2 Increment rules

- **lookup_count**: increment один раз per word **per session** (not per-tap, not per-5s — single tap per session counted). Avoids inflation от rapid taps across same word.
- **passive_encounters**: tracked via Reader engine viewport observer (FlatList viewability). Word visible in viewport ≥3s **AND** не was tapped в session → increment. Implementation в #6 Deck integration phase — placeholder в #4.5 reads column but #6 owns increment logic. For v1 #4.5: `passive_encounters` always shown as 0 until #6 ships.

### 8.3 UI badge thresholds (widened per Nation 2001)

| `passive_encounters + lookup_count` | Badge text | Visual |
|-------------------------------------|-----------|--------|
| 0 (first ever) | "✦ впервые встречаете" | accent color, pulse 1s **AFTER gloss line settles** |
| 1-3 | "✦ {N+1}-й раз" | muted |
| 4-9 | "✦ знакомое" | very muted |
| 10+ | (hidden — known territory) | — |

Nation 2001: form-meaning stabilization at 6-12 encounters, full retrieval at 16+. Old thresholds (0/1-2/3-5/6+) premature к Nation curve.

**Badge appearance timing**: shown only AFTER gloss line resolves (avoids attention competition с loading translation).

---

## 9. Polysemy alternative senses

### 9.1 Source

LLM возвращает primary translation **в context** (current spec §11.1). Alternative senses extraction: separate inference pass **deferred** (see §17 Q3).

### 9.2 V1 fallback

В popup `▾ other senses` disclosure показывает:
- **Если static dictionary entry available** (curated lexicon, optional): list senses из dictionary.
- **Else**: hide disclosure entirely.

Не делаем "frequency-ranked" claim — без curated corpus с per-genre/era weights это misleading.

V2 path: LLM-driven sense enumeration после chrF benchmark improves.

### 9.3 Disclosure a11y

```typescript
<Pressable
  accessibilityRole="button"
  accessibilityLabel={t('translation.a11y.altSenses', { count })}
  accessibilityHint={t('translation.a11y.altSensesHint')}
  accessibilityState={{ expanded: isExpanded }}
  onPress={() => {
    setExpanded(!isExpanded);
    if (!isExpanded) {
      AccessibilityInfo.announceForAccessibility(
        t('translation.a11y.altSensesRevealed', { count })
      );
    }
  }}
>
  <Text>▾ {t('translation.alternativeSenses', { count })}</Text>
</Pressable>
```

---

## 10. Pronunciation placeholder

### 10.1 Type extension

```typescript
export interface TranslationResult {
  // existing fields...
  pronunciation?: {
    ipa?: string;        // IPA transcription
    audioUri?: string;   // local URI to cached TTS audio
    syllables?: string;  // optional, for tonal langs
  };
}
```

### 10.2 UI

В popup header: 🔊 icon button.

- **v1**: button rendered, `disabled={true}`, opacity 0.3.
  - `accessibilityRole="button"`.
  - `accessibilityState={{ disabled: true }}`.
  - `accessibilityLabel="{t('translation.a11y.pronunciation.unavailable')}"` — explicit, not just hint ("Pronunciation, unavailable in v1").
- **v3** TTS sub-project: button enabled, tap → play audio (system TTS or pre-cached file).

Reserved для future без UI redesign.

## 10.5 Coach mark (single hint v2.1)

Only **one** coach mark v2.1 — long-press для sentence translation (drag и idiom auto-expand discoverable enough).

```
First popup open после tap:
  - 1500ms after popup mounts, render small coach mark "💡 Hold finger to translate sentence" near long-press affordance.
  - Auto-dismiss disabled (WCAG 2.2.1 no auto-timeout).
  - Two buttons: [Skip] (no further hints) | [Got it] (mark seen).
  - `popupHintsSeen.longPressForSentence = true` on either tap.
  - `accessibilityViewIsModal=true`.
  - Focus moves к hint message on appear.
```

Reset hints via "Reset coach mark hint" в Settings → Translation → Advanced.

---

## 11. Inference parameters + quality gate

### 11.1 Word translation (existing from #4)

Greedy (temp=0, top_k=1, repeat_penalty=1.3), max_tokens 64. См. #4 spec.

### 11.2 Sentence translation

```typescript
const SENTENCE_INFERENCE_CONFIG = {
  temperature: 0.3,
  top_p: 0.95,
  top_k: 40,
  repeat_penalty: 1.15,
  max_tokens: 200,
  stop: ['\n\n'],
  n_threads: 4,
};
```

**Context size**: requires `n_ctx ≥ 2048` (current loader = 1024 in #4 — needs bump in #4.6 loader update). Sentence prompt + sentence + 200 output ≈ 800 tokens.

**Cache prompt**: `cache_prompt: true` для KV reuse across batched sentence prefetch (huge perf win — see #4.6).

**Timeout**: 45s warm / 60s cold.

### 11.3 chrF FLORES-200 quality gate (blocking, per-pair calibrated)

**Eval harness**: `scripts/eval/translate-flores.ts`.

- Sample: 200 FLORES-200 dev sentences per language pair.
- Run via llama.rn вендорный fork на macOS host (CPU-only, accept device-gap).
- Metrics: **chrF** (primary), BLEU (secondary), word-accuracy (sanity check).

**Per-pair calibrated threshold** (round-2 finding: universal 40 wrong):

Different pair types have different baseline difficulty. Threshold = `measured_baseline × 0.85` (15% headroom for production drift).

| Pair type | Example pairs | Expected chrF baseline | Production threshold |
|-----------|---------------|------------------------|----------------------|
| Close Romance↔Romance | es↔pt, es↔it, fr↔es | 55-65 | ≥ 50 |
| English↔Romance | en↔es, en↔fr, en↔pt | 45-55 | ≥ 45 |
| English↔Slavic | en↔ru, en↔pl, en↔uk | 38-48 | ≥ 38 |
| Slavic↔Slavic | ru↔pl, ru↔uk | 45-55 | ≥ 45 |
| English↔German | en↔de | 42-50 | ≥ 42 |
| English↔CJK | en↔ja, en↔ko | 25-35 | ≥ 28 |
| English↔Arabic/Hindi | en↔ar, en↔hi | 28-38 | ≥ 30 |

**Calibration phase** (blocking action item ДО #4.5 implementation start):
1. Run `scripts/eval/translate-flores.ts` для top 12 pairs.
2. Document measured baseline chrF per pair.
3. Set production threshold = `floor(measured_baseline × 0.85)`.
4. Pairs measuring below "Expected baseline" range → investigate (model load issue? prompt format?) before considering ship.

**Per-pair runtime gating**: pairs failing threshold → sentence translation **disabled at runtime** (button hidden, long-press shows "Sentence translation not supported для {pair}. Word translation works.").

**CI**: gate PR merge для #4.5 implementation на calibrated thresholds for top 6 pairs минимум.

**Word translation**: separate threshold не требуется — 1.25-bit Hy-MT proven (current #4 PR translates words).

---

## 12. Performance budget

| Operation | Cache hit | Cache miss (warm) | Cache miss (cold) |
|-----------|-----------|---------------------|---------------------|
| Word tap (no MWE) | <50ms | 1-3s | 5-8s |
| Word tap (MWE hit, dual-display) | <100ms | 1-3s | 5-8s |
| Sentence translation | <100ms | 5-15s | 10-25s |
| MWE trie lookup | <5ms | — | — |
| False-friend lookup | <5ms | — | — |
| Sense alternatives | <50ms (static dict) OR disabled v1 | — | — |
| Animation frame budget | 16ms | — | — |

MWE/FF lookups synchronous in JS — таблицы in-memory after lazy book-open load.

---

## 13. Accessibility specification (mandatory)

### 13.1 Word tap accessibility

Each `<Text>` per word:

```typescript
<Text
  onPress={() => onWordTap(word, position)}
  accessibilityRole="button"
  accessibilityLabel={word}
  accessibilityHint={t('reader.a11y.tapToTranslate')}
>
  {word}
</Text>
```

### 13.2 Paragraph rotor actions

Each paragraph `<View>` wraps words with:

```typescript
<View
  accessibilityActions={[
    { name: 'translateSentence', label: t('reader.a11y.translateSentence') },
    { name: 'extendSelection', label: t('reader.a11y.extendSelection') },
  ]}
  onAccessibilityAction={(e) => {
    if (e.nativeEvent.actionName === 'translateSentence') {
      openSentenceTranslationPopup(paragraphSentence);
    } else if (e.nativeEvent.actionName === 'extendSelection') {
      enterExtendSelectionMode();
    }
  }}
>
```

### 13.3 Popup modal

```typescript
<View
  accessibilityViewIsModal={true}
  importantForAccessibility="yes"
  onLayout={() => AccessibilityInfo.setAccessibilityFocus(summaryRef)}
>
  <Text ref={summaryRef} accessibilityLabel={t('translation.a11y.popupSummary', { word, gloss })}>
    {/* announces: "Перевод spring: источник. Предупреждение: ложный друг." */}
  </Text>
  {/* visible content */}
</View>
```

**Reading order**: (1) word+gloss, (2) warnings (false-friend), (3) "2 alternative senses available", (4) encounter badge, (5) actions, (6) close button last.

### 13.4 Loading shimmer announcements

```typescript
<View accessibilityLiveRegion="polite">
  {isLoading && <Text>{t('translation.a11y.loadingTranslation')}</Text>}
  {isReady && <Text>{translation}</Text>}
</View>
```

Avoid `assertive` — too disruptive для tap-triggered action.

### 13.5 Reduce Motion

```typescript
const reduceMotion = useReducedMotion();
const animDuration = reduceMotion ? 0 : 200;
const useBlur = !reduceMotion && !reduceTransparency;
```

- Shimmer → static "Загрузка…" text.
- Slide-in popup → fade.
- Blur background → solid `paper` + shadow.

### 13.6 Dynamic Type / font scaling

```typescript
<View style={{ maxHeight: Dimensions.get('window').height * 0.85 }}>
  <ScrollView>
    {/* all popup content */}
  </ScrollView>
</View>
```

Chips wrap (`flexWrap: 'wrap'`), не truncate. Test at iOS AX5 (largest accessibility size).

### 13.7 Touch target table

| Element | Visual size | Hit area | hitSlop if needed |
|---------|-------------|----------|-------------------|
| ✕ close | 24x24 | **44x44** | 10 |
| 🔊 TTS button (disabled v1) | 24x24 | **44x44** | 10 |
| Action buttons (✓ 📚 ⏭) | 44h | **44x44** | — |
| Disclosure ▾ row | 44h | **44h × full width** | — |
| Chip (register, false-friend) | 18h | **44h tappable** | 14 vertical |
| Drag handle | 32×32 | **44×44** | 6 |
| TTS rotor action | rotor virtual | n/a | — |

### 13.8 Settings toggle a11y

```typescript
<Pressable
  accessibilityRole="switch"
  accessibilityState={{ checked: value }}
  accessibilityLabel={t('settings.translation.sentenceTranslation.label')}
  accessibilityHint={t('settings.translation.sentenceTranslation.hint')}
>
```

Все toggles ≥44pt, grouped under `accessibilityRole="header"`.

### 13.9 i18n a11y namespaces

Reserved namespaces:
- `translation.a11y.*` — popup, gloss, alt senses, false-friend chip, register chip, MWE chip, encounter badge, TTS placeholder, sentence translation, multi-word selection, coach mark.
- `reader.a11y.*` — word tap, paragraph rotor actions (extendSelection, translateSentence), reading status.
- `settings.a11y.*` — Translation toggles, dropdowns, action buttons, advanced disclosure.

### 13.10 TTS fallback for v1 dyslexic users

В v1 без audio TTS: dyslexic users rely on **system VO/TalkBack** reading text aloud. Это work automatically если word/paragraph properly labeled (см. §13.1, §13.2).

Document в FAQ: "VoiceOver / TalkBack читает текст книги. v1 ограничение — нет custom audio playback, в v3 будет TTS."

---

## 14. Data types

### 14.1 Расширение `TranslationResult`

```typescript
// src/services/translation/ITranslationService.ts
export interface TranslationResult {
  status: TranslationStatus;
  translation?: string;
  alternativeSenses?: Array<{ sense: string; translation: string }>;
  registerTag?: 'arch' | 'colloq' | 'lit' | 'vulg' | 'tech';
  registerDomain?: 'general' | 'medical' | 'legal' | 'tech' | 'literary' | 'academic';
  falseFriend?: {
    looksLike: string;
    actualMeaning: string;
    confidence: 'high' | 'medium';
    domain: string;
  };
  mwePhrase?: {
    phrase: string;
    translationEquivalent: string;
    literalGloss?: string;
    type: 'idiom' | 'phrasal_verb' | 'collocation' | 'proverb';
  };
  encounterCount?: number;            // v2: для encounter badge
  pronunciation?: {                    // v2: TTS placeholder
    ipa?: string;
    audioUri?: string;
    syllables?: string;
  };
  source?: TranslationSource;
  inferenceContext?: InferenceContext; // v2
  errorCode?: TranslationErrorCode;
  errorMessage?: string;
}

export interface SentenceTranslationInput {
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  wordOffset?: number;
}

export interface SentenceTranslationResult {
  status: 'ok' | 'error';
  sourceSentence?: string;
  translatedSentence?: string;
  translatedWordOffset?: number;       // undefined if alignment failed → no highlight
  chrFScore?: number;                  // v2: quality metric, exposed для diagnostic
  inferenceContext?: InferenceContext;
  errorCode?: TranslationErrorCode;
  errorMessage?: string;
}

export interface ITranslationService {
  translate(input: TranslationInput): Promise<TranslationResult>;
  translateSentence(input: SentenceTranslationInput): Promise<SentenceTranslationResult>;
  clearCache(): Promise<void>;
}
```

### 14.2 Popup state

```typescript
type PopupMode = 'word' | 'sentence' | 'phrase';
type PopupPlacement = 'top' | 'bottom' | 'modalSheet';

interface PopupState {
  mode: PopupMode;
  placement: PopupPlacement;
  word: string;
  sourceSentence: string;
  wordOffsetInSentence: number;
  status: 'loading' | 'ready' | 'error';
  result: TranslationResult | SentenceTranslationResult | null;
  encounterCount: number;
  coverageHint: boolean;  // pulse "?" affordance — see §7.4 trigger logic
}
```

### 14.3 Settings store extensions

```typescript
// AsyncStorage allowlist additions (#4.5 v2):
showSentenceTranslation: boolean;             // existing — wire up
showRegisterTags: boolean;                    // new, default false; auto-true at B2+
sentenceTranslationGesture: 'long_press' | 'button' | 'both'; // default 'both'
mweAutoExpand: boolean;                       // tap inside MWE auto-expands selection, default true
falseFriendsEnabled: boolean;                 // default true
popupHintsSeen: {                             // first-run gesture discovery — only one hint (long-press)
  longPressForSentence: boolean;
  // Removed v2.1: dragForMultiWord (discoverable enough), questionMarkForSentence (always-visible button)
};
readingMode: 'study' | 'flow';                // reserved schema, always 'study' v1
```

В Settings panel под Translation Model — **collapsed к 2 visible** + Advanced disclosure. **Default-on toggles match visible row text** (no mismatch):

```
Translation Model: [status]
[Сбросить ошибку] [Удалить и скачать заново]
[Очистить кэш переводов: 47MB]                    ← single-line, no per-book breakdown
─────────────────────────────────
Перевод предложения: [По long-press / По кнопке / Оба ▾]   ← default 'both'
[✓] Умные подсказки (ложные друзья, идиомы, регистр)        ← single combined toggle, default ON
   ▾ Advanced (collapsed) — per-feature granular
     [✓] Auto-expand idioms on tap                            ← all default ON
     [✓] Show register/formality tags (B2+ users only)
     [✓] False-friend warnings
     [Reset coach mark hint]                                  ← single hint (only long-press)
```

**Removed from v2.1** per scope cut (contrarian):
- Per-book Storage breakdown UI — replaced by single "Clear cache" line.
- Diagnostic bundle export action — moved к v2 backlog.

---

## 15. Files plan

### 15.1 Создаём

- `src/services/translation/mweDictionary.ts` — trie + slot template matcher.
- `src/services/translation/falseFriendsDictionary.ts` — lookup.
- `src/services/translation/coverageEstimator.ts` — per-page coverage hint.
- `src/services/translation/kernelBuildId.ts` — runtime hash of llama.rn cpp/.
- `src/services/translation/inferenceContext.ts` — track cold/warm/throttled state.
- `src/services/translation/wordAlignment.ts` — fail-safe alignment heuristic.
- `src/db/migrations/0003-mwe-false-friends-versioned-cache.ts`.
- `src/db/models/MwePhrase.ts`, `FalseFriend.ts`.
- `src/db/repositories/MweRepository.ts`, `FalseFriendRepository.ts`.
- `assets/mwe/en-ru.csv` ... (10 pairs).
- `assets/false_friends/en-ru.csv` ... (top 6 pairs).
- `src/services/translation/seedDictionaries.ts` — lazy seed on book open.
- `src/components/reader/TranslationPopup.tsx` — v2 redesign.
- `src/components/reader/SentenceTranslationView.tsx` — with fail-safe highlight.
- `src/components/reader/PolysemyDisclosure.tsx`.
- `src/components/reader/EncounterBadge.tsx`.
- `src/components/reader/MweChip.tsx`.
- `src/components/reader/FalseFriendChip.tsx`.
- `src/components/reader/PopupPlacement.ts` — 3-mode placement logic.
- `src/components/reader/PopupCoachMark.tsx` — first-run hints.
- `scripts/eval/translate-flores.ts` — chrF gate harness.
- `scripts/eval/flores-corpus/{lang}-{lang}.tsv` — bundled FLORES sample.
- `src/services/translation/__tests__/mweDictionary.test.ts`.
- `src/services/translation/__tests__/falseFriendsDictionary.test.ts`.
- `src/services/translation/__tests__/wordAlignment.test.ts`.
- `src/services/translation/__tests__/coverageEstimator.test.ts`.
- `src/components/reader/__tests__/TranslationPopup.test.tsx`.
- `src/components/reader/__tests__/SentenceTranslationView.test.tsx`.

### 15.2 Изменяем

- `src/services/translation/LlamaTranslationService.ts` — add `translateSentence`, MWE pre-filter, cold-inference tagging, versioned cache key, chrF gate.
- `src/services/translation/CacheLayer.ts` — sentence cache + versioned key + cold rule (no DB persist for cold).
- `src/services/translation/PromptBuilder.ts` — sentence translation prompt builder.
- `src/services/translation/ITranslationService.ts` — extended types (§14.1).
- `src/services/translation/NoOpTranslationService.ts`, `MockTranslationService.ts` — add `translateSentence` stub.
- `src/services/translation/createLlamaLoader.ts` — bump `n_ctx` к 2048 для sentence support.
- `src/db/schema.ts` — schema v2: add MWE + false_friends + cache columns.
- `src/db/models/TranslationCache.ts` — add `sentence_translation`, `inference_context`, `chrf_score` columns.
- `src/components/reader/BookRenderer.tsx` — multi-word selection (long-press + drag distance gate) + paragraph accessibilityActions + virtualization disable during selection.
- `src/stores/settingsStore.ts` — new flags (§14.3).
- `src/i18n/locales/{lang}.json` — translation.a11y.* namespace, popup strings.

---

## 16. Tests + manual smoke matrix

### 16.1 Unit

- MWE trie + slot template matcher (greedy longest, gap matching ≤3 tokens).
- False-friend lookup + domain filter.
- Cache key versioning (different model versions → different keys).
- Cold inference tagging (cold not persisted к DB).
- Coverage estimator (per-page unknown %).
- Word alignment heuristic (fail-safe behavior).
- Polysemy disclosure render/expand.
- Encounter badge selection.
- Popup placement 3-mode logic.
- Settings toggle a11y attributes.

### 16.2 Integration

- Full popup flow: short tap → word mode → "[?]" → sentence mode (cached).
- Long-press → sentence translation mode.
- Drag (>8px) → multi-word selection → phrase translate.
- VoiceOver rotor → "Translate sentence" works on paragraph.
- VoiceOver rotor → "Extend selection" works alternative drag-free path.
- MWE auto-expand на tap внутри idiom span → pulse animation + chip.
- False-friend chip → expand on tap → full meaning shown.
- Adjacent-word tap switches popup content без unmount.
- Popup never covers tapped word (3-mode placement).
- DB migration v1 → v2 preserves WordStatus + ReadingPosition data.
- Cold inference NOT persisted к DB.
- Cache invalidation on model version bump.

### 16.3 Manual smoke matrix (mandatory)

| Test | Device | Theme | Pair | Status |
|------|--------|-------|------|--------|
| Word tap, popup placement bottom-half | iPhone SE 2nd gen | Day | en→ru | TBD |
| Word tap, popup placement top-half | iPhone SE 2nd gen | Sepia | en→ru | TBD |
| Word tap, modal sheet (small screen) | iPhone SE 2nd gen | Night | en→ru | TBD |
| Long-press → sentence translation | iPhone 13 | Day | en→ru | TBD |
| Drag multi-word selection | iPhone 13 | Day | en→ru | TBD |
| RTL Arabic popup | iPhone 13 | Day | en→ar | TBD |
| RTL Arabic source | iPhone 13 | Day | ar→en | TBD |
| CJK Japanese (Intl.Segmenter or per-char) | iPhone 13 | Day | ja→en | TBD |
| CJK Korean | iPhone 13 | Day | ko→en | TBD |
| VoiceOver word tap → translate | iPhone 13 | Day | en→ru | TBD |
| VoiceOver rotor → translate sentence | iPhone 13 | Day | en→ru | TBD |
| VoiceOver rotor → extend selection | iPhone 13 | Day | en→ru | TBD |
| Dynamic Type AX5 popup overflow | iPhone 13 | Day | en→ru | TBD |
| Reduce Motion popup animation | iPhone 13 | Day | en→ru | TBD |
| Reduce Transparency popup background | iPhone 13 | Day | en→ru | TBD |
| TalkBack equivalent | Pixel 7 | Day | en→ru | TBD |
| Contrast Day theme | iPhone 13 | Day | en→ru | TBD |
| Contrast Sepia theme | iPhone 13 | Sepia | en→ru | TBD |
| Contrast Night theme | iPhone 13 | Night | en→ru | TBD |
| Coach mark first-run hints | iPhone 13 | Day | en→ru | TBD |

---

## 17. Done criteria

- [ ] MWE table seeded для 10 language pairs + slot template matcher tested.
- [ ] False-friend table seeded для top 6 pairs (1500-2500 entries each).
- [ ] TranslationPopup redesigned (tiered, 3-mode placement, MWE chip, false-friend chip, encounter badge, polysemy disclosure, TTS placeholder).
- [ ] `translateSentence` method + chrF FLORES gate (≥40 для shipped pairs).
- [ ] Word alignment fail-safe (no proportional heuristic).
- [ ] Long-press → sentence mode trigger working + gesture distance gate.
- [ ] Multi-word selection (drag) → phrase translate + virtualization disable.
- [ ] "Extend selection" a11y custom action working.
- [ ] Cache key versioned (model + kernel) + migration on bump.
- [ ] Cold inference tagged + not persisted к DB.
- [ ] Composite uniqueness constraint enforced.
- [ ] MWE trie lazy load per-pair при book open.
- [ ] Register + domain tag rendering (B2+ gated).
- [ ] False-friend chip + accessible label.
- [ ] Settings consolidated (2 visible + Advanced).
- [ ] Adjacent-word tap auto-switch (80ms cross-fade).
- [ ] Coach mark first-run hints + popupHintsSeen tracking.
- [ ] Reanimated 4 worklets для всех popup animations.
- [ ] Theme contrast audit table (Day/Sepia/Night) ≥WCAG AA.
- [ ] All a11y mandate met (VoiceOver/TalkBack/SwitchControl/Reduce Motion).
- [ ] Manual smoke matrix passes на iPhone SE 2 + iPhone 13 + Pixel 7.
- [ ] chrF eval harness in CI gating PR merge.
- [ ] No regression в #4 word translation flow.
- [ ] DB migration 1 → 2 tested + safe.

---

## 18. Out of scope (для #4.5)

- ❌ ML word alignment.
- ❌ Custom user MWE additions.
- ❌ Audio TTS playback (placeholder only).
- ❌ Etymology / morphology display.
- ❌ Per-genre prompt tuning.
- ❌ FSRS encounter SRS ingestion (это #6 Deck).
- ❌ Two-mode reading UI Flow vs Study — field reserved, UI deferred.
- ❌ Whole-book auto-translate — это **#4.7**.
- ❌ Optional inference delay forced — covered by hybrid shimmer.
- ❌ Coverage-gated sentence translation (only pulse hint hybrid).
- ❌ Frequency-ranked alt senses (без curated corpus).
- ❌ Lemmatization for sense disambiguation (deferred к #4.6 prefetch — пока не нужно для popup correctness).

---

## 19. Open questions (v2.1 status)

1. **Intl.Segmenter availability в Hermes (SDK 54)?** — **RESOLVED v2.1**: Hermes does NOT support Intl.Segmenter (ECMA-402 7th edition only, Segmenter в 8th). Decisions:
   - Sentence boundary: regex + per-language abbreviation lists (см. `assets/abbreviations/{lang}.txt`).
   - CJK word boundary: **per-character tap fallback** (degraded UX documented). User taps на CJK character → translates that single glyph.
   - V2: bundle `intl-segmenter-polyfill` (~50KB) для full Unicode segmentation.

2. **MWE bundle size**: 10 pairs × ~5000 entries ≈ 3MB compressed. **Decided: bundle.**

3. **Hy-MT 1.25-bit sentence translation chrF per-pair baseline** — **BLOCKING action item** перед implementation start. Run `scripts/eval/translate-flores.ts` для top 12 pairs (см. §11.3 table). Set per-pair production thresholds = baseline × 0.85.

4. **Alternative senses corpus** — drop "ranked" claim in v2.1. **Closed: defer ranked claim к v2.**

5. **Register tags semi-automated population** — Wiktionary `{{lb|}}` templates inconsistent. **Decided: tag только high-confidence, hide chip when uncertain.**

6. **`Intl.Segmenter` performance** на large CJK paragraphs — measure perf budget. **Status: open.**

7. **Coach mark frequency** — **Closed (v2.1): single long-press hint only, dismissable, no auto-timeout (WCAG 2.2.1).**

8. **Foundation Sheet primitive arbitrary-position anchor** — **RESOLVED v2.1**: existing `Sheet` is `@gorhom/bottom-sheet` wrapper, bottom-anchored only. Decision: use Sheet для modalSheet fallback (when popup occludes >40%). Top/bottom near-tap positions need **new `Popover` primitive** (built in #4.5 implementation). Custom positioning, NOT shared с Sheet.

9. **VoiceOver paragraph rotor performance** на large chapters (100+ paragraphs) — может быть slow. Profile.

10. **Per-pair chrF table baseline measurements** — **BLOCKING DoD**, populated from §11.3 calibration run.

11. **splitWords grapheme-awareness** — currently whitespace-only? Needs verification и possibly upgrade к `Intl.Segmenter('word')` для emoji/ZWJ correctness в EN тоже. **Status: open, defer fix к round-3 OR implementation phase.**
