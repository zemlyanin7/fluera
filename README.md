# Fluera

Мобильная читалка для изучения языков через чтение. Тап по слову → перевод в
родной язык → сохранение в SRS-колоду. Поддержка EPUB + FB2, перевод
on-device (без бэкенда).

## Sub-project статус

**#1 Foundation — завершён.** Визуально-навигационный каркас:
3 темы × 6 script variants через Unistyles v3, 12 UI-примитивов, 26 иконок,
navigation Expo Router, шрифты embed через config plugin.

Следующие: #2 Data layer, #3 Import + parsers, #4 Reader engine,
#5 Translation UX, #6 Word knowledge + Deck, #7 Stats, #8 Library polish.

## Запуск (dev)

```bash
# Установка
npm install

# Native prebuild (требуется после изменения plugins / нативных deps)
npx expo prebuild --clean

# Локальный dev-client (Expo Go НЕ работает — у нас native modules)
npx expo run:ios     # macOS
npx expo run:android

# Дальше Metro можно запускать без пересборки:
npx expo start --dev-client
```

## Тесты + качество

```bash
npm test               # Jest unit-тесты
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
```

## Размер app

В bundle лежат 38 шрифтов (~15-25 MB) для поддержки 6 скриптов offline.
Сознательный trade-off в пользу offline-чтения. В v2 рассмотрим APK splits
или lazy-load JP/KR/AR/HI.

## Документация

- Спека Foundation: `docs/superpowers/specs/2026-05-15-foundation-design.md`
- План реализации: `docs/superpowers/plans/2026-05-15-foundation.md`
- Стандарты проекта: `CLAUDE.md`
