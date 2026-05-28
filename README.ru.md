# Fluera

> 🇷🇺 Русская версия — [🇬🇧 English (default)](./README.md)

Мультиязычное мобильное приложение-читалка для изучения языков через
чтение. Тап по слову → **перевод on-device** (без бэкенда), перетаскивание
для выбора фразы, удержание для перевода предложения, сохранение в
SRS-колоду. Поддерживает EPUB и FB2, 13 языков интерфейса, полностью офлайн.

**Стек:** React Native 0.81 · Expo SDK 54 · TypeScript strict · Zustand v5 ·
WatermelonDB 0.28 · react-native-unistyles v3 · @gorhom/bottom-sheet v5 ·
Reanimated 4 · llama.rn (vendored форк с STQ1_0 patch) · Hy-MT1.5-1.8B
GGUF в квантизации 1.25-bit.

---

## Что работает сегодня

Статус roadmap:

| # | Sub-project | Статус | Заметки |
|---|-------------|--------|---------|
| 1 | Foundation | ✅ готов | Темы (3 темы × 6 script-вариантов), 12 UI-примитивов, 26 иконок, Expo Router, embedded шрифты. |
| 2 | Data layer | ✅ готов | WatermelonDB 0.28 schema (v3), repositories, Zustand persist для preferences. |
| 3 | Reader engine | ✅ готов | EPUB и FB2 парсеры написаны с нуля — без WebView. Native render через `ContentItem[]` / `InlineNode[]`. |
| 4 | Translation core | ✅ готов | On-device LLM (Hy-MT1.5-1.8B-1.25bit) через vendored llama.rn форк. Покрывает все 13 × 13 = 169 языковых пар. |
| 4.5 | Popup redesign | ✅ готов | Многоуровневый попап (слово / фраза / предложение), MWE-детекция, false friends, polysemy, race-safe таппинг. |
| **4.6** | **Prefetch + Lifecycle** | 🚧 в работе | Idle unload, lazy reload, page-ahead prefetch с battery / thermal-гейтами. |
| 5 | Library | ⏳ планируется | OPDS-каталоги + локальный импорт файлов. |
| 6 | Deck | ⏳ планируется | FSRS-6 интервальное повторение на основе encounters из reading sessions. |
| 7 | Stats | ⏳ планируется | Reading streak, выученные слова, графики. |
| 8 | Onboarding / Settings polish | ⏳ планируется | First-run флоу, история lookup, OPDS-креды, redownload. |

**v2 backlog:** перевод целой книги пакетно, геймификация, TTS,
диагностический bundle export, тяжёлые лемматизаторы для ru/uk/pl/de/ar/hi/ja/ko.

---

## Продуктовое видение

Reading-first приложение. Пользователь открывает книгу на иностранном
языке и читает; моментальный перевод слова / фразы / предложения всегда
под рукой. Освоение лексики происходит **органично через чтение** — это
не основной KPI. Весь experience работает on-device: нет API-ключей,
нет облачного fallback, нет бэкенда ни в v1, ни в v2.

---

## Языки

Язык интерфейса, язык книги и родной язык полностью симметричны. В v1
поддерживаются 13 языков:

`en` · `ru` · `pl` · `uk` · `es` · `fr` · `de` · `it` · `pt` · `ja` · `ko` ·
`ar` · `hi`

On-device модель обязана покрывать все 169 пар; качество per-pair
варьируется, но baseline-перевод всегда доступен.

---

## Запуск (dev)

```bash
# 1. Установить JS-зависимости
npm install

# 2. Только iOS: установить CocoaPods (требуется macOS + Xcode)
cd ios && pod install && cd ..

# 3. Native prebuild (нужен только после изменения config plugins / native deps)
npx expo prebuild --clean

# 4. Собрать dev-client
npx expo run:ios       # требует macOS host
npx expo run:android   # любой host с Android SDK

# 5. После того как dev-client установлен, можно итерировать только по JS:
npx expo start --dev-client
```

> Expo Go **не поддерживается** — у Fluera есть native-модули (llama.rn fork,
> WatermelonDB, secure store, blur и т.д.).

---

## Тесты + качество

```bash
npm test               # Jest unit-тесты
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
```

Запускать все три перед коммитом. CI workflow в
`.github/workflows/kernel-verify.yml` дополнительно прогоняет
kernel-fidelity check на каждый llama.rn bump.

---

## Размер приложения

В bundle лежат ~38 шрифтов (~15–25 MB) чтобы все 6 script-вариантов
рендерились офлайн без FOUT/FOIT. Сознательный trade-off в пользу
офлайн-чтения. APK splits и lazy script loading в v2 backlog.

GGUF-модель Hy-MT (~462 MB) **скачивается на первом запуске**, не
бандлится, поэтому бинарь в App Store / Play Store остаётся компактным.

---

## Структура репозитория

```
app/                              # роуты Expo Router
  reader/[bookId].tsx             # экран читалки
  library/                        # библиотека + импорт
  settings/                       # настройки

src/
  components/                     # UI, организовано по доменам
    reader/                       # попап, sentence card, encounter badge, …
    settings/                     # секции настроек
    ui/                           # примитивы
    icons/                        # 26 кастомных SVG-иконок

  services/
    reader/                       # EPUB/FB2 парсеры + sentence extraction
    translation/                  # llama.rn adapter, cache, prefetch, MWE
    library/                      # OPDS + file import (планируется)

  stores/                         # Zustand stores (с persist)
  db/                             # WatermelonDB schema, models, repositories
  theme/                          # tokens + Unistyles конфиг
  i18n/                           # 13 locale JSON
  types/                          # канонические render-типы
  fixtures/                       # dev/test фикстуры

vendor/llama.rn/                  # vendored fork c STQ1_0 patch
assets/                           # icons, splash, шрифты (build-time)
docs/superpowers/                 # specs, planы, smoke matrices, handoff
```

---

## Документация

- **Канонический design-doc:** `docs/superpowers/specs/2026-03-13-fluera-design.md`
  (исходный; частично переподписан per-sub-project спеками ниже).
- **Foundation:** `docs/superpowers/specs/2026-05-15-foundation-design.md`
- **Translation popup (#4.5):**
  `docs/superpowers/specs/2026-05-17-translation-popup-design.md`
- **Prefetch + Lifecycle (#4.6):**
  `docs/superpowers/specs/2026-05-17-translation-prefetch-design.md`
- **Стандарты проекта:** [`CLAUDE.md`](./CLAUDE.md) — coding conventions,
  AsyncStorage allowlist, theming rules, security policies, observability
  decisions.

---

## Лицензия и данные

- Код: см. `LICENSE` (TBD до публичного релиза).
- Книги: не поставляются с приложением. Пользователь импортирует свои
  файлы или подключает OPDS-каталог (#5).
- Translation cache: хранится только локально. "Очистить историю переводов"
  в Settings purge'ит его; "Удалить все мои данные" также wipe'ит
  `WordOccurrence.context_sentence` и `ReadingStats`.

Нет telemetry, нет аналитики, нет remote crash reporting в v1.
