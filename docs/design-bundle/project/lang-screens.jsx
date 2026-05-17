// Fluera — multilingual reader screens & typography specimen.
// Demonstrates per-language font pairing: the book renders in its source
// language with its proper font; the translation sheet (always Russian
// for this user) uses the Cyrillic pair.

// ─────────────────────────────────────────────────────────────
// MultilingualReaderScreen
// Same chapter, different source language, rendered with the typeface
// chosen for that script. Try tapping a word.
// ─────────────────────────────────────────────────────────────
function MultilingualReaderScreen({ theme = "light", langKey = "en", showHighlights = true, showSheet = false }) {
  const sample = LANG_SAMPLES[langKey];
  const [active, setActive] = React.useState(
    showSheet
      ? (() => {
          // pick the first tagged word as the "tapped" one
          for (const p of sample.paragraphs) for (const seg of p) {
            if (Array.isArray(seg) && seg[2]) return { id: "demo", word: seg[0], translation: seg[2], status: seg[1] };
          }
          return null;
        })()
      : null
  );

  return (
    <PhoneShell theme={theme}>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
      }} data-lang={langKey}>
        {/* Top bar — UI uses the source language's UI font (looks native).
            Book metadata is in source language. */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "4px 18px 8px",
        }}>
          <button className="fl-icon-btn"><IcChevronLeft size={18}/></button>
          <div style={{ textAlign: "center", lineHeight: 1.15 }}>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{sample.chapter}</div>
            <div style={{ fontFamily: "var(--font-reading)", fontStyle: "italic", fontSize: 12, color: "var(--ink-3)" }}>{sample.book}</div>
          </div>
          <button className="fl-icon-btn"><IcFontSize size={18}/></button>
        </div>

        <div style={{ flex: 1, overflow: "auto", paddingTop: 4, paddingBottom: 80 }}>
          <div style={{ padding: "12px 28px 4px" }}>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 600 }}>
              {sample.native} · {sample.pairing}
            </div>
            <div className="fl-h1" style={{ marginTop: 6, fontFamily: "var(--font-reading)" }}>
              {sample.book}
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>{sample.author}</div>
          </div>

          <div className="fl-reading" style={{ padding: "20px 28px 0" }}>
            <MultilingualParagraphs
              paragraphs={sample.paragraphs}
              showHighlights={showHighlights}
              activeId={active && active.id}
              onTapWord={(w) => setActive(active && active.id === w.id ? null : w)}
            />
          </div>
        </div>

        {/* Bottom progress (chrome stays in source-lang UI font for cohesion) */}
        <div style={{
          position: "absolute", left: 22, right: 22, bottom: 22,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>42 / 318</div>
          <div style={{ flex: 1, height: 2, background: "color-mix(in oklab, var(--ink) 12%, transparent)", borderRadius: 99, position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "13%", background: "var(--ink)", borderRadius: 99 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
            <IcFlame size={13} color="var(--accent)"/> 14
          </div>
        </div>
      </div>

      {/* Translation sheet — content uses Russian (interface) font pair. */}
      {showSheet && active && (
        <BilingualTranslationSheet
          sourceLang={langKey}
          word={active}
          onClose={() => setActive(null)}
        />
      )}
    </PhoneShell>
  );
}

// ─────────────────────────────────────────────────────────────
// BilingualTranslationSheet
// The source-language word is rendered in the source-language font.
// The translation (Russian) uses the Cyrillic pair. Side-by-side.
// ─────────────────────────────────────────────────────────────
function BilingualTranslationSheet({ sourceLang, word, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", zIndex: 24 }} />
      <div className="fl-sheet" data-lang="ru" style={{ paddingBottom: 36 }}>
        <div className="handle" />

        {/* Top row — source word (in its native font) + label */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
          <div data-lang={sourceLang} style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-3)", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>
              {LANG_SAMPLES[sourceLang].native}
            </div>
            <div style={{
              fontFamily: "var(--font-reading)",
              fontSize: 32, fontWeight: 500, color: "var(--ink)",
              letterSpacing: 0, marginTop: 2,
              direction: LANG_SAMPLES[sourceLang].dir,
            }}>{word.word}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: 4 }}>
            <IcClose size={20}/>
          </button>
        </div>

        <hr className="fl-hr" style={{ margin: "16px 0 14px" }} />

        {/* Russian translation — in Cyrillic font pair */}
        <div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-3)", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>
            Русский
          </div>
          <div style={{ fontFamily: "var(--font-reading)", fontSize: 26, color: "var(--ink)", marginTop: 4, letterSpacing: 0 }}>
            {word.translation}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          <span className="fl-pill" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>сущ.</span>
          <span className="fl-pill">CEFR · B1</span>
          <span className="fl-pill">★ ★ ☆</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button className="fl-btn fl-btn--accent" style={{ flex: 1 }}>
            <IcPlus size={16}/> В колоду
          </button>
          <button className="fl-icon-btn" aria-label="Sound"><IcVolume size={18}/></button>
          <button className="fl-icon-btn" aria-label="More"><IcMore size={18}/></button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// TypographySpecimen
// A wide, designer-y artboard. Shows the same opening line across
// 6 scripts, each in its proper pair. The point: a single font
// cannot do this justice. The system must.
// ─────────────────────────────────────────────────────────────
function TypographySpecimen({ width = 1120, height = 760 }) {
  const order = ["en", "ru", "ja", "ko", "ar", "hi"];

  return (
    <div style={{
      width, height,
      background: "#F5EFE4", color: "#1F1A14",
      padding: "44px 52px",
      boxSizing: "border-box",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: "1px solid color-mix(in oklab, #1F1A14 14%, transparent)", paddingBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "#8A8170", fontWeight: 600 }}>Fluera Typography · ƒ.01</div>
          <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 40, fontWeight: 500, letterSpacing: "-.02em", marginTop: 4 }}>One book, six scripts, six typefaces.</div>
        </div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#8A8170", textAlign: "right", lineHeight: 1.6 }}>
          The same opening passage of<br/>
          <em style={{ fontFamily: "'Source Serif 4', serif", fontStyle: "italic" }}>The Garden of Forking Paths</em><br/>
          rendered in its mother script.
        </div>
      </div>

      {/* Grid: 6 cards, 3×2 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "1fr 1fr",
        gap: 20,
        marginTop: 24,
        height: "calc(100% - 110px)",
      }}>
        {order.map((k) => {
          const s = LANG_SAMPLES[k];
          // Take the first paragraph, strip [w, status, tr] → just w
          const text = s.paragraphs[0].map((seg) => typeof seg === "string" ? seg : seg[0]).join("");
          return (
            <div key={k} data-lang={k} style={{
              background: "#FBF7EE",
              borderRadius: 14,
              padding: "18px 20px",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}>
              {/* Header strip */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 22, fontWeight: 600,
                  letterSpacing: 0,
                  direction: s.dir,
                }}>{s.native}</div>
                <div style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10, color: "#8A8170",
                  letterSpacing: ".05em",
                }}>{s.code}</div>
              </div>
              <div style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10, color: "#8A8170",
                letterSpacing: ".04em",
                marginTop: 2,
              }}>{s.pairing}</div>

              <hr style={{ border: 0, height: 1, background: "color-mix(in oklab, #1F1A14 10%, transparent)", margin: "12px 0 14px" }} />

              {/* Body sample in the language's reading font */}
              <div style={{
                fontFamily: "var(--font-reading)",
                fontSize: 17,
                lineHeight: "var(--reading-leading)",
                letterSpacing: "var(--reading-letter-spacing)",
                color: "#1F1A14",
                direction: s.dir,
                flex: 1,
                overflow: "hidden",
                textWrap: "pretty",
              }}>{text}</div>

              {/* Glyph showcase strip — Aa/А-а/あ-語/한글/أب/अआ */}
              <div style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid color-mix(in oklab, #1F1A14 8%, transparent)",
                display: "flex", alignItems: "baseline", justifyContent: "space-between",
                fontFamily: "var(--font-reading)",
                color: "#564E42",
                direction: s.dir,
              }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>{
                  k === "en" ? "Aa Bb Cc" :
                  k === "ru" ? "Аа Бб Дд" :
                  k === "ja" ? "あ 雨 語" :
                  k === "ko" ? "가 한 글" :
                  k === "ar" ? "ا ب ت ث" :
                  "अ आ ज्ञ"
                }</span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "#8A8170", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600, direction: "ltr" }}>read · ui</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer rule */}
      <div style={{
        position: "absolute", left: 52, right: 52, bottom: 18,
        display: "flex", justifyContent: "space-between",
        fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#8A8170",
        letterSpacing: ".06em",
      }}>
        <span>tokens.css · [data-lang]</span>
        <span>FLUERA / TYPE</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  MultilingualReaderScreen, BilingualTranslationSheet, TypographySpecimen,
});
