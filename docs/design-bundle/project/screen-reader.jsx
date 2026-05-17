// Fluera — Reader screen (interactive centerpiece).
// Tap a word → translation sheet rises. Tap controls → settings/font sheets.
// Highlight-mode shows learning/new word tints; off by default for clean reading.

const READER_SAMPLE = {
  book: "The Garden of Forking Paths",
  author: "J. L. Borges",
  chapterTitle: "I.",
  chapterNum: "Ch. 3",
  page: 42,
  totalPages: 318,
  // Each paragraph is an array. Items:
  //   string  → plain run (split into words at render time, status "plain")
  //   [w, st] → single word with status: "known" | "learning" | "new" | "tr"
  //   [w, st, tr] → like above with a literal translation override
  paragraphs: [
    [
      "On a ", ["pale", "new", "бледный"], " ", ["October", "learning"], " morning, the ",
      ["tide", "new", "прилив"], " withdrew further than anyone could remember, leaving the ",
      ["wharf", "new", "пристань"], " of Vigàta open to the sky like the page of an old ",
      ["atlas", "learning", "атлас"], ".",
    ],
    [
      "Stephen ", ["wandered", "learning", "бродил"], " between the ", ["abandoned", "known"],
      " boats, ", ["counting", "known"], " the small ", ["pebbles", "new", "галька"],
      " his daughter had once arranged in the shape of a ", ["constellation", "new", "созвездие"],
      ". He had not been here since the ", ["autumn", "known"], " she left.",
    ],
    [
      "It was, he thought, the kind of ", ["silence", "learning"],
      " that exists only in places that have ", ["surrendered", "new", "сдались"], " their use.",
    ],
  ],
};

// Default Russian translations for any word not given a literal. Keyed by lowercase.
const READER_DICT = {
  on: "на", a: "(артикль)", morning: "утро", the: "(артикль)", withdrew: "отступил",
  further: "дальше", than: "чем", anyone: "кто-либо", could: "мог", remember: "помнить",
  leaving: "оставляя", of: "(предлог)", open: "открытый", to: "(предлог)", sky: "небо",
  like: "как", page: "страница", an: "(артикль)", old: "старый",
  october: "октябрь", stephen: "Стивен", between: "между", abandoned: "заброшенный",
  boats: "лодки", counting: "считая", his: "его", daughter: "дочь", had: "(вспом.)",
  once: "однажды", arranged: "расставила", in: "в", shape: "форма",
  he: "он", not: "не", been: "был", here: "здесь", since: "с тех пор как",
  autumn: "осень", she: "она", left: "ушла", it: "это", was: "было",
  thought: "подумал", kind: "вид", that: "который", exists: "существует",
  only: "только", places: "места", have: "имеют", their: "их", use: "использование",
};

function tokenize(run) {
  // split a plain string into [word | space | punct] tokens, preserving order
  // returns array of { kind: 'w'|'p'|'s', text }
  const out = [];
  const re = /([A-Za-zÀ-ÿ']+)|(\s+)|([^A-Za-zÀ-ÿ'\s]+)/g;
  let m;
  while ((m = re.exec(run)) !== null) {
    if (m[1]) out.push({ kind: "w", text: m[1] });
    else if (m[2]) out.push({ kind: "s", text: m[2] });
    else out.push({ kind: "p", text: m[3] });
  }
  return out;
}

function ReaderText({ showHighlights, activeWord, onTapWord, typeface }) {
  // Renders all paragraphs.
  return (
    <div className="fl-reading" data-typeface={typeface} style={{
      padding: "0 28px",
    }}>
      {READER_SAMPLE.paragraphs.map((p, pi) => (
        <p key={pi} style={{ margin: "0 0 1.1em 0", textIndent: pi === 0 ? 0 : "1.2em", textWrap: "pretty" }}>
          {p.map((seg, si) => {
            if (typeof seg === "string") {
              const toks = tokenize(seg);
              return toks.map((t, ti) => {
                if (t.kind !== "w") return <span key={`${pi}-${si}-${ti}`}>{t.text}</span>;
                const isActive = activeWord && activeWord.id === `${pi}-${si}-${ti}`;
                return (
                  <span
                    key={`${pi}-${si}-${ti}`}
                    className={`fl-word ${isActive ? "is-active" : ""}`}
                    onClick={() => onTapWord({
                      id: `${pi}-${si}-${ti}`,
                      word: t.text,
                      translation: READER_DICT[t.text.toLowerCase()] || "—",
                      status: "plain",
                    })}
                  >{t.text}</span>
                );
              });
            }
            // tagged word [w, status, translation?]
            const [w, status, tr] = seg;
            const id = `${pi}-${si}`;
            const isActive = activeWord && activeWord.id === id;
            return (
              <span
                key={id}
                className={`fl-word ${showHighlights ? status : ""} ${isActive ? "is-active" : ""}`}
                onClick={() => onTapWord({
                  id, word: w, status,
                  translation: tr || READER_DICT[w.toLowerCase()] || "—",
                })}
              >{w}</span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Translation surfaces — three UX variants
// ─────────────────────────────────────────────────────────────

function TooltipBubble({ word, onClose, style = {} }) {
  if (!word) return null;
  return (
    <div style={{
      position: "absolute",
      background: "var(--ink)",
      color: "var(--paper)",
      borderRadius: 12,
      padding: "10px 14px",
      boxShadow: "0 6px 18px rgba(0,0,0,.18)",
      fontFamily: "var(--font-ui)",
      fontSize: 14,
      maxWidth: 220,
      zIndex: 30,
      ...style,
    }}>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2, letterSpacing: ".04em", textTransform: "uppercase" }}>{word.word}</div>
      <div style={{ fontWeight: 500 }}>{word.translation}</div>
      {/* arrow */}
      <div style={{ position: "absolute", top: "100%", left: 28, width: 0, height: 0,
        borderLeft: "7px solid transparent", borderRight: "7px solid transparent",
        borderTop: "7px solid var(--ink)" }} />
    </div>
  );
}

function TranslationSheet({ word, onClose, expanded = false }) {
  if (!word) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", zIndex: 24,
        }} />
      <div className="fl-sheet" style={{ paddingBottom: 48 }}>
        <div className="handle" />
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
          <div style={{ fontFamily: "var(--font-reading)", fontSize: 30, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em" }}>{word.word}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)" }}>/ˈweɪvz/</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: 4 }}>
            <IcClose size={20}/>
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <span className="fl-pill" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>noun</span>
          <span className="fl-pill">CEFR · B1</span>
          <span className="fl-pill">★ ★ ☆</span>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="fl-section-label">RU</div>
          <div style={{ fontFamily: "var(--font-reading)", fontSize: 22, color: "var(--ink)", marginTop: 4 }}>
            {word.translation}
          </div>
        </div>

        {expanded && (
          <>
            <div style={{ marginTop: 18 }}>
              <div className="fl-section-label">Definition</div>
              <div style={{ fontFamily: "var(--font-reading)", fontSize: 16, lineHeight: 1.45, color: "var(--ink-2)", marginTop: 4 }}>
                Withdrew — moved back or away from a position previously held.
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="fl-section-label">In context</div>
              <div style={{ fontFamily: "var(--font-reading)", fontSize: 15, color: "var(--ink-2)", marginTop: 4, fontStyle: "italic" }}>
                "…the tide <span style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 3, padding: "0 3px" }}>{word.word}</span> further than anyone could remember…"
              </div>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button className="fl-btn fl-btn--accent" style={{ flex: 1 }}>
            <IcPlus size={16}/> Save to deck
          </button>
          <button className="fl-icon-btn" aria-label="Sound"><IcVolume size={18}/></button>
          <button className="fl-icon-btn" aria-label="More"><IcMore size={18}/></button>
        </div>
      </div>
    </>
  );
}

function HighlightPanel({ word, onClose }) {
  if (!word) return null;
  return (
    <div style={{
      position: "absolute",
      left: 14, right: 14, bottom: 92,
      background: "var(--paper)",
      borderRadius: 18,
      padding: "14px 18px",
      boxShadow: "0 12px 28px rgba(0,0,0,.16), 0 0 0 1px color-mix(in oklab, var(--ink) 8%, transparent)",
      zIndex: 26,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-reading)", fontSize: 22, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em" }}>{word.word}</div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--ink-2)", marginTop: 2 }}>{word.translation}</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        <button className="fl-icon-btn" aria-label="Sound"><IcVolume size={16}/></button>
        <button className="fl-icon-btn" aria-label="Save" style={{ background: "var(--accent)", color: "white" }}><IcPlus size={16}/></button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Top bar + bottom controls
// ─────────────────────────────────────────────────────────────
function ReaderTopBar({ onMenu, onSettings }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "4px 18px 8px",
    }}>
      <button className="fl-icon-btn" onClick={onMenu} aria-label="Library">
        <IcChevronLeft size={18}/>
      </button>
      <div style={{ textAlign: "center", lineHeight: 1.1 }}>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{READER_SAMPLE.chapterNum}</div>
        <div style={{ fontFamily: "var(--font-reading)", fontStyle: "italic", fontSize: 12, color: "var(--ink-3)" }}>{READER_SAMPLE.book}</div>
      </div>
      <button className="fl-icon-btn" onClick={onSettings} aria-label="Settings">
        <IcFontSize size={18}/>
      </button>
    </div>
  );
}

function ReaderBottomBar({ page, total, streak }) {
  const pct = Math.round((page / total) * 100);
  return (
    <div style={{
      position: "absolute", left: 22, right: 22, bottom: 22,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: ".04em" }}>{page} / {total}</div>
      <div style={{
        flex: 1, height: 2, background: "color-mix(in oklab, var(--ink) 12%, transparent)",
        borderRadius: 99, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "var(--ink)", borderRadius: 99 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
        <IcFlame size={13} color="var(--accent)"/> {streak}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Reader
// ─────────────────────────────────────────────────────────────
function ReaderScreen({
  theme = "light",
  typeface = "serif",
  fontSize,
  showHighlights = true,
  translationMode = "sheet",  // "tooltip" | "sheet" | "panel" | "sheet-rich"
}) {
  const [active, setActive] = React.useState(null);

  const onTap = (w) => {
    if (active && active.id === w.id) setActive(null);
    else setActive(w);
  };

  // tooltip placement helper: simple fixed offset relative to top reading area.
  // (Real impl would measure target rect; we fake a believable position.)
  const tooltipStyle = active ? {
    left: 60, top: 290,
  } : {};

  return (
    <PhoneShell theme={theme}>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        fontFamily: "var(--font-ui)",
        ...(fontSize ? { "--reading-size": `${fontSize}px` } : {}),
      }}>
        <ReaderTopBar />
        <div style={{ flex: 1, overflow: "auto", paddingTop: 4, paddingBottom: 80 }}>
          <div style={{ padding: "12px 28px 18px" }}>
            <div style={{ fontFamily: "var(--font-reading)", fontSize: 13, letterSpacing: ".22em", textTransform: "uppercase", color: "var(--ink-3)" }}>Chapter</div>
            <div className="fl-h1" style={{ marginTop: 4 }}>{READER_SAMPLE.chapterTitle}</div>
          </div>
          <ReaderText
            showHighlights={showHighlights}
            activeWord={active}
            onTapWord={onTap}
            typeface={typeface}
          />
        </div>
        <ReaderBottomBar page={READER_SAMPLE.page} total={READER_SAMPLE.totalPages} streak={14} />
      </div>

      {translationMode === "tooltip" && active && (
        <TooltipBubble word={active} onClose={() => setActive(null)} style={tooltipStyle} />
      )}
      {translationMode === "sheet" && (
        <TranslationSheet word={active} onClose={() => setActive(null)} />
      )}
      {translationMode === "sheet-rich" && (
        <TranslationSheet word={active} onClose={() => setActive(null)} expanded />
      )}
      {translationMode === "panel" && (
        <HighlightPanel word={active} onClose={() => setActive(null)} />
      )}
    </PhoneShell>
  );
}

Object.assign(window, {
  ReaderScreen, ReaderText, TranslationSheet, TooltipBubble, HighlightPanel,
  ReaderTopBar, ReaderBottomBar, READER_SAMPLE, READER_DICT, tokenize,
});
