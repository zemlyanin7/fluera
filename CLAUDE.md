# Fluera — Development Rules

## Язык общения

Всё общение с пользователем ведётся на русском языке.

## Project Overview

Fluera is a multilingual reader app for learning languages through reading. React Native (Expo) mobile app with Fastify backend.

- **Spec:** `docs/superpowers/specs/2026-03-13-fluera-design.md`
- **Research Brief:** `doc/fluera-research-brief-v3.docx`

## Tech Stack

- **Framework:** React Native with Expo (Expo Router for navigation)
- **Language:** TypeScript (strict mode)
- **State:** Zustand (client state) + TanStack React Query (server state)
- **UI:** Tamagui (themed components)
- **Database:** WatermelonDB (offline-first SQLite)
- **Animations:** Reanimated 3
- **i18n:** i18next + react-i18next
- **Testing:** Jest + React Native Testing Library
- **Backend:** Fastify + PostgreSQL + Redis (in `backend/` directory when added)

## Architecture Rules

### File Structure
- Routes go in `app/` (Expo Router file-based routing)
- All non-route code goes in `src/`
- Components are organized by feature domain: `src/components/reader/`, `src/components/library/`, etc.
- Shared UI components go in `src/components/ui/`
- Business logic goes in `src/services/`
- Zustand stores go in `src/stores/`
- Custom hooks go in `src/hooks/`
- Database schema and models go in `src/db/`

### State Management
- **Zustand** for UI state (reader position, theme, settings). No Redux.
- **React Query** for server data (OPDS catalogs, sync API, translations). Never store server data in Zustand.
- **WatermelonDB** for persistent offline data (books, words, progress). Access via model classes, never raw SQL.
- Do NOT mix state layers. A component should use either Zustand OR React Query for a given piece of data, not both.

### Component Patterns
- Functional components only. No class components.
- Use Tamagui components (`XStack`, `YStack`, `Text`, `Button`, etc.) instead of raw React Native views.
- Use Tamagui theme tokens for colors — never hardcode hex values in components. Theme tokens are defined in `src/theme/`.
- Prefer `const` exports for components. Use `React.memo()` only when profiling shows it's needed.
- Keep components under 200 lines. Extract sub-components or hooks when approaching this limit.

### TypeScript
- Strict mode enabled. No `any` types except in third-party library wrappers.
- Use `interface` for object shapes, `type` for unions/intersections.
- Export types from the file where they are defined, not from barrel files.
- Prefer `unknown` over `any` for untyped external data, then narrow with type guards.

### Translations (i18n)
- All user-facing strings MUST use i18next `t()` function. Never hardcode strings.
- Translation keys use dot notation: `library.bookCard.progress`, `reader.translation.loading`
- Locale files are in `src/i18n/locales/{lang}.json`
- MVP languages: `en`, `ru`, `pl`, `uk`
- `bookLanguage` + `nativeLanguage` are always parameterized — never assume a specific language pair.

### Reader
- Epub renders in WebView via @epubjs-react-native. Communication via `postMessage`/`onMessage` bridge.
- FB2 renders as native React Native components. Parser uses fast-xml-parser.
- Word highlighting and tap detection are handled differently per format — check the format-specific component.
- Translation popup is a shared component used by both readers.

### Database (WatermelonDB)
- Schema changes require migrations in `src/db/migrations/`
- `WordStatus` table stores global word knowledge (one entry per unique word per language pair)
- `WordOccurrence` table stores per-book context (where a word was encountered)
- Never query the database directly in components — use hooks (`useWordStatus`, `useBookProgress`, etc.)

### LLM Translation
- All LLM calls go through `src/services/translation/TranslationService.ts`
- Primary: DeepSeek V3.2. Fallback: Gemini Flash-Lite. Premium (v2): Claude Haiku.
- Always check TranslationCache before making API calls.
- Cache key: `SHA-256(lowercase(word) + context_window + lang_pair)` truncated to 32 chars.
- Timeouts: 3s primary, 5s fallback. One retry before fallback.
- Never expose API keys in client code. Use environment variables via Expo constants.

## Code Quality

### Testing
- Write tests for services and business logic. Test files next to source: `MyService.test.ts`.
- Use React Native Testing Library for component tests.
- Test translation service with mocked LLM responses.
- Test WatermelonDB models with in-memory database.
- Run `npx expo lint` before committing.

### Git Conventions
- Branch naming: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`
- Commit messages: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Keep commits atomic — one logical change per commit.

### Security
- No API keys, tokens, or secrets in code. Use `.env` files (gitignored) + Expo constants.
- Validate all OPDS XML input before parsing (defense against XXE).
- Sanitize user-entered catalog URLs.
- Use HTTPS for all API calls.
- Run OWASP mobile security checker (`.claude/skills/owasp-mobile-security-checker/`) before releases.

### Performance
- Reader must be smooth — no jank during scrolling or word highlighting.
- Translation popup should appear in <500ms (cache hit) or <3s (API call).
- Book difficulty calculation runs in background thread (`InteractionManager.runAfterInteractions()`).
- Use `React.lazy` for non-critical screens (Stats, Settings).
- Profile with Flipper/React DevTools before optimizing — don't premature-optimize.

## Commands

```bash
# Development
npx expo start                    # Start dev server
npx expo start --ios              # iOS simulator
npx expo start --android          # Android emulator

# Testing
npx jest                          # Run all tests
npx jest --watch                  # Watch mode
npx expo lint                     # Lint

# Build
npx eas build --platform ios      # iOS build
npx eas build --platform android  # Android build
```

## Skills Available

Project-local skills in `.claude/skills/`:
- `react-native-expert` — RN architecture, Expo Router, platform handling
- `react-expert` — React patterns, hooks, state management
- `typescript-pro` — Advanced TypeScript types and patterns
- `javascript-pro` — Modern JS, async patterns
- `api-designer` — REST API design patterns
- `architecture-designer` — System architecture decisions
- `code-reviewer` — Code review checklist
- `database-optimizer` — Query and index optimization
- `test-master` — Testing methodology and patterns
- `owasp-mobile-security-checker` — Mobile security audit scripts
