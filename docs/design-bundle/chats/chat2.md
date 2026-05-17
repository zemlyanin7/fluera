# Многоязычная типография

_Started 2026-05-13 17:16 UTC_

---

## User

тут есть такой нюанс что в разных языках красивым выглядят разные шрифты. Например если мы берем шрифт на котором европейские языки хорошо отображаются будет криво на японском. 
Поэтому нужно для каждого языка (не только интерфейса а и для книг и переводов) использовать соответствующий шрифт.

## Assistant

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

I'll build out a per-language typography system. Different scripts genuinely need different typefaces — what looks elegant in Latin (Source Serif 4) feels foreign in Japanese, what works for Cyrillic doesn't carry Arabic's rhythm. Let me declare the system and show it across the reader, translations, and a type specimen.

**Plan:**
1. Per-script font stacks via `[data-lang]` attribute — Lora/Inter (Cyrillic), Shippori Mincho/Noto Sans JP (Japanese), Amiri/Noto Sans Arabic (Arabic, RTL), Noto Serif KR/Sans KR (Korean), etc. Latin keeps Source Serif/Geist.
2. New canvas section: same Borges paragraph rendered in 5 languages, each in its native typography. Plus a type specimen comparing all pairs side-by-side.
3. Translation sheet demos showing JP→RU and AR→RU, each side using the right font.
4. Tweak to swap the live reader's book language.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Added a per-language typography system. The reader, translation sheet, and UI now switch typefaces by script — Source Serif/Inter for Latin, Lora for Cyrillic, Shippori Mincho for Japanese, Noto Serif KR for Korean, Amiri (RTL) for Arabic, Tiro Devanagari for Hindi. New canvas section **Typography per language** with:

- A live artboard wired to a "Book language" tweak (try cycling through it)
- Per-language reader screens — same Borges passage, six scripts
- Two mixed-script translation sheets (JP→RU and AR→RU) showing source word and Russian translation each in their proper font
- A wide type specimen artboard comparing all six pairs side by side

Activated by setting `data-lang="ja|ru|ar|…"` on any container; the var stack in `tokens.css` cascades down.The typography system is live in the canvas — open the "Typography per language" section to compare scripts, or use the Tweaks panel to swap the book's language on the live artboard.

## User

теперь мне нужен какой-то файл объясняющий принципы дизайна и выбора шрифтов

## Assistant

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: write_file]_

_[tool: register_assets]_

_[tool: done]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: done]_

The file got truncated — let me append the rest:Создал **Typography Principles.html** — editorial-документ в 6 принципах:

1. **The script chooses the font, not the brand** — с наглядным "плохо vs хорошо" примером на японском
2. **Two roles, two faces, per language** — таблица всех пар (Latin/Cyrillic/JP/KR/AR/HI), каждая строка отрисована в собственном шрифте
3. **Metrics travel with the script** — line-height и tracking как часть выбора шрифта (1.65 для латиницы → 1.95 для арабского)
4. **Mixed scripts get mixed type** — как устроены билингвальные карточки (JP→RU, AR→RU)
5. **One attribute switches everything** — `data-lang="ja"` как единственный API, с кодом из `tokens.css`
6. **What we will not do** — анти-паттерны: универсальные шрифты, fallback chains, транслитерация

Каждый принцип демонстрирует сам себя — текст на разных языках в документе показан в правильных шрифтах.

_[tool: fork_verifier_agent]_

Документ готов — открывается у вас в превью.

