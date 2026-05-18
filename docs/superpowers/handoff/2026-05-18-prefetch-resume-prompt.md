# Resume Prompt — #4.6 Translation Prefetch Plan Fixes

> Paste этот текст целиком в новую Claude session чтобы продолжить.

---

## Context

Проект: Fluera (mobile reading app + on-device LLM translation), `/Users/andrei/development/Mobile/Fluera`. Stack: RN 0.81.5 + Expo SDK 54 + TS strict + Jest 29 + WatermelonDB 0.28 + Zustand v5 + react-native-unistyles v3 + llama.rn vendored fork.

Текущая ветка: `main`. Последние коммиты `f69ba5e` (contextual word translation в попапе) + `9f1b80d` (progressive UI + max_tokens cuts) уже на main и pushed.

Roadmap состояние:
- #1 Foundation, #2 Data layer, #3 Reader engine, #4 Translation core, #4.5 Translation Popup Polish — все done и merged в main.
- **#4.6 Translation Prefetch + Lifecycle** — в работе, на стадии "fix plan v1 → v2".
- #5 Library, #6 Deck, #7 Stats, #8 Onboarding/Settings polish — pending.

## Что сделано в предыдущей session

1. Прочитана спека `docs/superpowers/specs/2026-05-17-translation-prefetch-design.md` (v2.1, 1000 lines).
2. Subagent написал план v1 `docs/superpowers/plans/2026-05-18-translation-prefetch.md` (47 tasks, 9 phases, 4086 lines).
3. 3 parallel reviewers (architecture / RN-Expo / TDD plan quality) нашли **18 P0 + 24 P1 issues**.
4. Все findings сохранены в `docs/superpowers/handoff/2026-05-18-prefetch-plan-review-findings.md` — **читай в первую очередь**.
5. Попытки rewrite/patch agent падали (background tasks hang). Нужен иной подход.

## Что делать сейчас

**Цель**: исправить plan v1 → v2 (применить все 18 P0 + ключевые P1), затем execute через subagent-driven-development.

### Recommended approach (попробуй inline-mode сначала)

Сделай **inline в текущей session**, без dispatch agents. Reasoning: prior background agents падали; inline = ты видишь каждый Edit, можешь контролировать.

Шаги:

1. **Прочитай review findings**: `docs/superpowers/handoff/2026-05-18-prefetch-plan-review-findings.md` (полный список 18 P0 + 24 P1 с конкретными fix-snippets).
2. **Прочитай план v1**: `docs/superpowers/plans/2026-05-18-translation-prefetch.md` (4086 lines, читай по частям через `offset`/`limit`).
3. **Прочитай ключевые existing файлы** для ground truth:
   - `src/services/translation/LlamaContextAdapter.ts` (real completion signature)
   - `src/db/schema.ts` (SCHEMA_VERSION=3 уже)
   - `src/services/translation/createLlamaLoader.ts` (`n_ctx: 2048` уже set)
   - `jest.setup.js` (existing mocks)
   - `app/reader/[bookId].tsx` (onWordTap + scroll handler для Task 5.4 wire-up)
   - `package.json` (confirm `expo-crypto@~15.0.9`, `expo-file-system@~19.0.22`)
4. **Apply fixes via Edit tool**, P0 first, P1 после. Каждый fix → отдельный `Edit` call.
   - **A0 series** (architecture P0s): tasks 2.1 (unload), 2.2 (queue+dispatcher+cap), 2.4 (failure counter)
   - **E0 series** (RN/Expo P0s): tasks 0.3 (battery), new 0.4 (SecureStore mock), new 0.5 (js-sha256 install), 3.3 (BatteryBridge composed call), 7.3 (SHA chunked + file-system pin), 7.4 (`/next` Paths.availableDiskSpace)
   - **T0 series** (plan format P0s): tasks 4.3 (fixture generator), 5.4 (read [bookId].tsx и pin real wire-up patches), 6.2 (English fallback honesty), 6.4 (AboutSection explicit), 7.3 (drop adjustment step), 8.3+8.4 (grep enumeration → unconditional delete)
   - **P1 highlights**: idle timer re-arm, scheduler re-entry guard, TTL lazy purge, AppState 'inactive' no-unload, accessibility cross-platform, useEffect cleanup pattern
5. **Add changelog section** to top of plan (after Tech Stack line): "## Changelog v1 → v2" listing все fixes.
6. **Не renumber** existing tasks. Insert new tasks как suffix letters (5.4a, 7.3a) или в Phase 0.
7. **После всех edits**, перечитай changelog + spot-check 3-5 tasks чтобы verify no broken cross-references.

### Alternative approach (только если inline не справляется)

Если context filling up, dispatch **patch-mode agent** через `general-purpose` subagent. Промпт уже есть в `docs/superpowers/handoff/2026-05-18-prefetch-patch-mode-agent-prompt.md` (если не существует, создай его на основе review findings). Background mode чтобы не блокировать. Note: prior 2 agents падали — возможно, давай агенту меньший scope (chunk by chunk).

## Environment facts (verified, не перепроверяй)

- Expo SDK 54, `expo-crypto: ~15.0.9`, `expo-file-system: ~19.0.22` уже installed
- `expo-battery` НЕ installed (нужен `npx expo install expo-battery`)
- `expo-secure-store` IS installed (но не mocked в jest.setup)
- `js-sha256` НЕ installed (Phase 0 new task: `npm i js-sha256`)
- DB SCHEMA_VERSION = 3 → migration 0004 will bump к 4
- `inference_context` column уже в v3 schema → migration 0004 adds только `source`, `ttl_days`, `chrf_score`
- `createLlamaLoader` уже имеет `n_ctx: 2048` → Phase 8 adds только `cache_prompt: true`
- llama.rn adapter: `completion(promptOrMessages: string | ChatMsg[], config: InferenceConfig)` — 2 positional args

## Когда план v2 готов

1. Self-review: scan для "TBD", "implement later", "tests for above", forward references, signature inconsistencies (`runInference(prompt, config, priority)`, `canPrefetch()`, `onBatteryStateChange({pct, charging, lowPower})`).
2. Update `CLAUDE.md` если добавил новые dependencies или changed persist allowlist.
3. Show user summary: что added/changed.
4. Спроси user: execute via subagent-driven-development или сначала повторный review?

## Caveman mode

Session активен caveman mode (full). Drop articles/filler/pleasantries. Fragments OK. Code/commits/security pisat normal.

## Files to know

- `docs/superpowers/specs/2026-05-17-translation-prefetch-design.md` — spec v2.1 (source of truth)
- `docs/superpowers/plans/2026-05-18-translation-prefetch.md` — plan v1 (нужно patch'ить → v2)
- `docs/superpowers/handoff/2026-05-18-prefetch-plan-review-findings.md` — **18 P0 + 24 P1 с fix snippets** ← начни отсюда
- `docs/superpowers/specs/2026-05-17-translation-popup-design.md` — #4.5 spec (для контекста)
- `CLAUDE.md` — project rules
- `package.json` — installed deps

## Что не делать

- Не run jest до plan v2 ready.
- Не create branches (Phase 0 Task 1 plan'а это делает).
- Не dispatch sub-sub-agents (3-deep stack invites hangs).
- Не trust v1 plan — фактически broken по 18 пунктам.

Начни с чтения review findings file. После прочтения, начни Edit'ить plan v1 by sections.
