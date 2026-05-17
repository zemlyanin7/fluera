// Fluera — supporting screens.
// Library, Onboarding, Import, Settings, Progress, Flashcards, Word Card.

// ─────────────────────────────────────────────────────────────
// Onboarding — pick languages (RU → EN), step 2 of 3
// ─────────────────────────────────────────────────────────────
function OnboardingScreen({ theme = "light" }) {
  const languages = [
    { code: "EN", name: "English",      sub: "Most popular",   active: true },
    { code: "ES", name: "Español",      sub: "Spanish",        active: false },
    { code: "FR", name: "Français",     sub: "French",         active: false },
    { code: "DE", name: "Deutsch",      sub: "German",         active: false },
    { code: "IT", name: "Italiano",     sub: "Italian",        active: false },
    { code: "PT", name: "Português",    sub: "Portuguese",     active: false },
    { code: "JP", name: "日本語",        sub: "Japanese",       active: false },
  ];
  return (
    <PhoneShell theme={theme}>
      <div style={{ padding: "8px 24px 0", display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="fl-icon-btn" aria-label="Back"><IcChevronLeft size={18}/></button>
          <div style={{ flex: 1, height: 3, background: "color-mix(in oklab, var(--ink) 10%, transparent)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: "66%", height: "100%", background: "var(--ink)", borderRadius: 99 }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>2 / 3</span>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="fl-section-label">Step two</div>
          <div className="fl-h1" style={{ marginTop: 8 }}>I'm reading in…</div>
          <div style={{ fontFamily: "var(--font-reading)", fontSize: 16, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>
            Fluera will translate from this language into Russian as you tap.
          </div>
        </div>

        <div style={{ marginTop: 22, flex: 1, overflow: "auto", paddingBottom: 90 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {languages.map((l) => (
              <div key={l.code} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 16,
                background: l.active ? "var(--ink)" : "color-mix(in oklab, var(--ink) 4%, transparent)",
                color: l.active ? "var(--paper)" : "var(--ink)",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: l.active ? "var(--paper)" : "var(--paper-2)",
                  color: l.active ? "var(--ink)" : "var(--ink-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 13, letterSpacing: ".05em",
                }}>{l.code}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 16 }}>{l.name}</div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: l.active ? "color-mix(in oklab, var(--paper) 70%, transparent)" : "var(--ink-3)", marginTop: 1 }}>{l.sub}</div>
                </div>
                {l.active && <IcCheck size={20}/>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "absolute", left: 24, right: 24, bottom: 28 }}>
          <button className="fl-btn fl-btn--primary fl-btn--block">Continue <IcArrowRight size={16}/></button>
        </div>
      </div>
    </PhoneShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Library
// ─────────────────────────────────────────────────────────────
const SAMPLE_BOOKS = [
  {
    title: "The Garden of Forking Paths",
    author: "J. L. Borges",
    cover: "linear-gradient(160deg, #C0392B 0%, #8B2A1F 60%, #5C1810 100%)",
    progress: 13, // %
    lang: "EN",
    pageRange: "42 / 318",
    new: false,
  },
  {
    title: "Hojas en el Viento",
    author: "Ana Lima",
    cover: "linear-gradient(150deg, #E5B85F 0%, #B88826 50%, #7B5C18 100%)",
    progress: 0,
    lang: "ES",
    pageRange: "—",
    new: true,
  },
  {
    title: "Une saison à Lyon",
    author: "Marc Duval",
    cover: "linear-gradient(155deg, #3F5B8F 0%, #233C66 50%, #0F2143 100%)",
    progress: 71,
    lang: "FR",
    pageRange: "208 / 294",
    new: false,
  },
  {
    title: "Briefe an einen jungen Dichter",
    author: "R. M. Rilke",
    cover: "linear-gradient(155deg, #4E5B3F 0%, #2E3823 60%, #1A1F12 100%)",
    progress: 100,
    lang: "DE",
    pageRange: "Finished",
    new: false,
  },
];

function BookCover({ book, w = 78, h = 108 }) {
  return (
    <div className="fl-cover" style={{ width: w, height: h, background: book.cover, flexShrink: 0 }}>
      <div className="spine" />
      <div style={{
        position: "absolute", left: 8, right: 8, top: 10,
        fontFamily: "var(--font-reading)", fontSize: 10, color: "rgba(255,255,255,.9)", lineHeight: 1.15, fontWeight: 500,
        textShadow: "0 1px 2px rgba(0,0,0,.2)",
      }}>{book.title}</div>
      <div style={{
        position: "absolute", left: 8, right: 8, bottom: 10,
        fontFamily: "var(--font-ui)", fontSize: 7, color: "rgba(255,255,255,.7)", letterSpacing: ".06em", textTransform: "uppercase",
      }}>{book.author}</div>
    </div>
  );
}

function LibraryScreen({ theme = "light" }) {
  const current = SAMPLE_BOOKS[0];
  const rest = SAMPLE_BOOKS.slice(1);
  return (
    <PhoneShell theme={theme}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "8px 22px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-3)", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>Tuesday, 13 May</div>
            <div className="fl-h1" style={{ marginTop: 2 }}>Library</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="fl-icon-btn"><IcSearch size={18}/></button>
            <button className="fl-icon-btn" style={{ background: "var(--ink)", color: "var(--paper)" }}><IcPlus size={18}/></button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", paddingBottom: 100 }}>
          {/* Currently reading card */}
          <div style={{ padding: "0 18px 14px" }}>
            <div className="fl-section-label" style={{ padding: "0 4px 8px" }}>Continue reading</div>
            <div style={{
              background: "var(--paper-2)",
              borderRadius: 22, padding: 18,
              display: "flex", gap: 16,
            }}>
              <BookCover book={current} w={92} h={130} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ fontFamily: "var(--font-reading)", fontSize: 19, fontWeight: 500, color: "var(--ink)", lineHeight: 1.15, letterSpacing: "-.01em" }}>{current.title}</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>{current.author}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span className="fl-pill">{current.lang}</span>
                  <span className="fl-pill"><IcFlame size={11}/> 14-day streak</span>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <div style={{ flex: 1, height: 3, background: "color-mix(in oklab, var(--ink) 10%, transparent)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${current.progress}%`, height: "100%", background: "var(--accent)", borderRadius: 99 }} />
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>{current.pageRange}</div>
                </div>
              </div>
            </div>
            <button className="fl-btn fl-btn--primary fl-btn--block" style={{ marginTop: 10 }}>
              <IcPlay size={14}/> Resume — 22 min left
            </button>
          </div>

          {/* Shelf */}
          <div style={{ padding: "8px 22px 0" }}>
            <div className="fl-section-label">Your shelf</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 14px 0" }}>
            {rest.map((b, i) => (
              <div key={i} style={{
                display: "flex", gap: 14, padding: "10px 8px",
                borderRadius: 14, alignItems: "center",
              }}>
                <BookCover book={b} w={48} h={68} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-reading)", fontSize: 16, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{b.author} · {b.lang}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    {b.progress === 100 ? (
                      <span className="fl-pill" style={{ background: "var(--known-soft)", color: "var(--known)" }}><IcCheck size={11}/> Finished</span>
                    ) : b.progress === 0 ? (
                      <span className="fl-pill" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>NEW</span>
                    ) : (
                      <>
                        <div style={{ flex: 1, height: 2, background: "color-mix(in oklab, var(--ink) 10%, transparent)", borderRadius: 99, overflow: "hidden", maxWidth: 100 }}>
                          <div style={{ width: `${b.progress}%`, height: "100%", background: "var(--ink-2)", borderRadius: 99 }} />
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>{b.progress}%</span>
                      </>
                    )}
                  </div>
                </div>
                <button className="fl-icon-btn" style={{ background: "transparent" }}><IcMore size={16}/></button>
              </div>
            ))}
          </div>
        </div>

        <FlTabBar active="library" />
      </div>
    </PhoneShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab bar (shared)
// ─────────────────────────────────────────────────────────────
function FlTabBar({ active }) {
  const tabs = [
    { id: "library", label: "READ", Ic: IcBook },
    { id: "deck",    label: "DECK", Ic: IcCards },
    { id: "stats",   label: "STATS", Ic: IcGraph },
    { id: "you",     label: "YOU", Ic: IcSettings },
  ];
  return (
    <div className="fl-tabbar">
      {tabs.map((t) => (
        <div key={t.id} className={`tab ${active === t.id ? "active" : ""}`}>
          <t.Ic size={20} color={active === t.id ? "var(--ink)" : "var(--ink-3)"} />
          <div>{t.label}</div>
          <div className="ind" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reader settings sheet (font/theme on the reader screen)
// ─────────────────────────────────────────────────────────────
function ReaderSettingsScreen({ theme = "sepia" }) {
  return (
    <PhoneShell theme={theme}>
      {/* Background: dim version of reader */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none" }}>
        <ReaderTextStatic theme={theme} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "color-mix(in oklab, var(--paper) 60%, transparent)" }} />

      <div className="fl-sheet" style={{ paddingBottom: 40 }}>
        <div className="handle" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="fl-h2">Reading</div>
          <button className="fl-icon-btn" style={{ background: "transparent" }}><IcClose size={18}/></button>
        </div>

        {/* Theme */}
        <div style={{ marginTop: 18 }}>
          <div className="fl-section-label">Paper</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
            {[
              { id: "light",  bg: "#F5EFE4", ink: "#1F1A14", name: "Day"   },
              { id: "sepia",  bg: "#ECDFC6", ink: "#2A2117", name: "Sepia", selected: true },
              { id: "dark",   bg: "#16130E", ink: "#EDE6D6", name: "Night" },
            ].map((t) => (
              <div key={t.id} style={{
                background: t.bg, color: t.ink,
                borderRadius: 14,
                padding: "16px 12px",
                border: `2px solid ${t.selected ? "var(--accent)" : "transparent"}`,
                fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 13,
                textAlign: "center",
              }}>
                <div style={{ fontFamily: "var(--font-reading)", fontSize: 22, marginBottom: 4 }}>Aa</div>
                {t.name}
              </div>
            ))}
          </div>
        </div>

        {/* Type size */}
        <div style={{ marginTop: 18 }}>
          <div className="fl-section-label">Size</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <span style={{ fontFamily: "var(--font-reading)", fontSize: 14, color: "var(--ink-2)" }}>A</span>
            <div style={{ flex: 1, height: 28, position: "relative", display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "color-mix(in oklab, var(--ink) 12%, transparent)", borderRadius: 99 }} />
              <div style={{ position: "absolute", left: 0, width: "45%", height: 2, background: "var(--ink)", borderRadius: 99 }} />
              {[0, 0.25, 0.45, 0.7, 1].map((p, i) => (
                <div key={i} style={{
                  position: "absolute", left: `${p * 100}%`, top: "50%", transform: "translate(-50%, -50%)",
                  width: 8, height: 8, borderRadius: 99,
                  background: p === 0.45 ? "var(--ink)" : "color-mix(in oklab, var(--ink) 18%, transparent)",
                  border: p === 0.45 ? "4px solid var(--paper)" : "none",
                  boxShadow: p === 0.45 ? "0 0 0 1px var(--ink)" : "none",
                  width: p === 0.45 ? 22 : 8,
                  height: p === 0.45 ? 22 : 8,
                }} />
              ))}
            </div>
            <span style={{ fontFamily: "var(--font-reading)", fontSize: 24, color: "var(--ink)" }}>A</span>
          </div>
        </div>

        {/* Typeface */}
        <div style={{ marginTop: 18 }}>
          <div className="fl-section-label">Typeface</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {[
              { id: "serif", label: "Source Serif", ff: "var(--font-reading)", selected: true },
              { id: "sans",  label: "Geist",        ff: "var(--font-ui)",      selected: false },
            ].map((t) => (
              <div key={t.id} style={{
                background: t.selected ? "var(--ink)" : "color-mix(in oklab, var(--ink) 6%, transparent)",
                color: t.selected ? "var(--paper)" : "var(--ink)",
                borderRadius: 14, padding: "14px 14px",
                fontFamily: t.ff, fontSize: 18, fontWeight: 500, letterSpacing: "-.01em",
              }}>{t.label}</div>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div style={{ marginTop: 18 }}>
          {[
            { lbl: "Highlight unknown words",  on: true },
            { lbl: "Show sentence translation", on: false },
            { lbl: "Page-flip animation",       on: true },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid color-mix(in oklab, var(--ink) 8%, transparent)" }}>
              <div style={{ flex: 1, fontFamily: "var(--font-ui)", fontSize: 15, color: "var(--ink)" }}>{r.lbl}</div>
              <div style={{
                width: 44, height: 26, borderRadius: 99,
                background: r.on ? "var(--accent)" : "color-mix(in oklab, var(--ink) 18%, transparent)",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: 3, left: r.on ? 21 : 3,
                  width: 20, height: 20, borderRadius: 99, background: "white",
                  transition: "left .15s",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}

// Inert version of reader content for backgrounds
function ReaderTextStatic({ theme }) {
  return (
    <div style={{ paddingTop: 70 }}>
      <ReaderTopBar />
      <div style={{ padding: "20px 28px" }}>
        <div className="fl-reading">
          {READER_SAMPLE.paragraphs.map((p, pi) => (
            <p key={pi} style={{ margin: "0 0 1.1em 0", textIndent: pi === 0 ? 0 : "1.2em" }}>
              {p.map((seg, si) => {
                if (typeof seg === "string") return <span key={si}>{seg}</span>;
                return <span key={si} className={`fl-word ${seg[1]}`}>{seg[0]}</span>;
              })}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Progress / Stats screen — streak, words learned, week chart
// ─────────────────────────────────────────────────────────────
function ProgressScreen({ theme = "light" }) {
  const days = [
    { d: "M", v: 0.6 },
    { d: "T", v: 0.9 },
    { d: "W", v: 0.35 },
    { d: "T", v: 0.7 },
    { d: "F", v: 1.0 },
    { d: "S", v: 0.5 },
    { d: "S", v: 0.15, today: true },
  ];
  return (
    <PhoneShell theme={theme}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "8px 22px 6px" }}>
          <div className="fl-section-label">Last 30 days</div>
          <div className="fl-h1" style={{ marginTop: 2 }}>Your reading</div>
        </div>

        <div style={{ flex: 1, overflow: "auto", paddingBottom: 100 }}>
          {/* Streak hero */}
          <div style={{ padding: "12px 18px 0" }}>
            <div style={{
              background: "var(--ink)", color: "var(--paper)",
              borderRadius: 22, padding: 22, position: "relative", overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "color-mix(in oklab, var(--paper) 70%, transparent)", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>Current streak</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                    <span style={{ fontFamily: "var(--font-reading)", fontSize: 64, fontWeight: 500, color: "var(--paper)", letterSpacing: "-.03em", lineHeight: 1, fontFeatureSettings: '"tnum" 1' }}>14</span>
                    <span style={{ fontFamily: "var(--font-reading)", fontSize: 18, color: "color-mix(in oklab, var(--paper) 80%, transparent)" }}>days</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "color-mix(in oklab, var(--paper) 70%, transparent)", marginTop: 6 }}>Read today to keep it</div>
                </div>
                <div style={{
                  width: 64, height: 64, borderRadius: 99,
                  background: "color-mix(in oklab, var(--accent) 90%, transparent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <IcFlame size={36} color="var(--paper)"/>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 22, height: 64 }}>
                {days.map((day, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: "100%",
                      height: `${day.v * 100}%`,
                      borderRadius: 4,
                      background: day.today ? "var(--accent)" : "color-mix(in oklab, var(--paper) 75%, transparent)",
                      opacity: day.today ? 1 : 0.7,
                    }} />
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "color-mix(in oklab, var(--paper) 70%, transparent)" }}>{day.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ padding: "14px 18px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="fl-card">
              <div className="fl-section-label">Words learned</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                <span style={{ fontFamily: "var(--font-reading)", fontSize: 32, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.02em", fontFeatureSettings: '"tnum" 1' }}>428</span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--known)", fontWeight: 600 }}>+12</span>
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>this week</div>
            </div>
            <div className="fl-card">
              <div className="fl-section-label">Reading time</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                <span style={{ fontFamily: "var(--font-reading)", fontSize: 32, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.02em", fontFeatureSettings: '"tnum" 1' }}>3.4</span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--ink-2)" }}>h</span>
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>this week</div>
            </div>
            <div className="fl-card">
              <div className="fl-section-label">Pages</div>
              <div style={{ fontFamily: "var(--font-reading)", fontSize: 32, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.02em", marginTop: 4, fontFeatureSettings: '"tnum" 1' }}>87</div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>this week</div>
            </div>
            <div className="fl-card">
              <div className="fl-section-label">Vocab level</div>
              <div style={{ fontFamily: "var(--font-reading)", fontSize: 32, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.02em", marginTop: 4 }}>B1</div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>est. CEFR</div>
            </div>
          </div>

          {/* Achievements row */}
          <div style={{ padding: "16px 18px 0" }}>
            <div className="fl-section-label" style={{ paddingLeft: 4 }}>Achievements</div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, overflowX: "auto" }}>
              {[
                { icon: IcFlame,    name: "Two weeks",   sub: "14-day streak", earned: true },
                { icon: IcBook,     name: "First book",  sub: "Finished one",  earned: true },
                { icon: IcSparkle,  name: "100 words",   sub: "Vocab milestone", earned: true },
                { icon: IcGlobe,    name: "Polyglot",    sub: "3 languages",   earned: false },
                { icon: IcStar,     name: "Bookworm",    sub: "10h in a week", earned: false },
              ].map((a, i) => (
                <div key={i} style={{
                  flexShrink: 0, width: 96,
                  background: a.earned ? "var(--paper-2)" : "color-mix(in oklab, var(--ink) 3%, transparent)",
                  borderRadius: 16, padding: 14, textAlign: "center",
                  opacity: a.earned ? 1 : 0.5,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 99, margin: "0 auto 8px",
                    background: a.earned ? "var(--accent)" : "color-mix(in oklab, var(--ink) 8%, transparent)",
                    color: a.earned ? "white" : "var(--ink-3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <a.icon size={22}/>
                  </div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{a.name}</div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{a.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <FlTabBar active="stats" />
      </div>
    </PhoneShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Flashcards / Review (SRS-style)
// ─────────────────────────────────────────────────────────────
function FlashcardsScreen({ theme = "light", revealed = false }) {
  return (
    <PhoneShell theme={theme}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 22px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="fl-icon-btn"><IcClose size={18}/></button>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[0,1,2,3,4,5,6].map((i) => (
              <div key={i} style={{
                width: 18, height: 3, borderRadius: 99,
                background: i < 3 ? "var(--ink)" : "color-mix(in oklab, var(--ink) 12%, transparent)",
              }} />
            ))}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>3 / 7</span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 40 }}>
          {/* Card */}
          <div style={{
            background: "var(--paper-2)",
            borderRadius: 24,
            padding: "32px 26px",
            minHeight: 360,
            display: "flex", flexDirection: "column",
            position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="fl-pill" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>From The Garden…</span>
              <button className="fl-icon-btn" style={{ background: "transparent" }}><IcVolume size={18}/></button>
            </div>

            <div style={{ marginTop: 28, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-reading)", fontSize: 44, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.02em", lineHeight: 1.05 }}>wharf</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-3)", marginTop: 6 }}>/wɔːrf/  ·  noun</div>
            </div>

            {revealed ? (
              <>
                <hr className="fl-hr" style={{ margin: "26px 0 18px" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-reading)", fontSize: 28, color: "var(--ink)" }}>пристань</div>
                  <div style={{ fontFamily: "var(--font-reading)", fontSize: 14, color: "var(--ink-2)", marginTop: 10, fontStyle: "italic", padding: "0 12px", lineHeight: 1.4 }}>
                    "the <span style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 3, padding: "0 3px" }}>wharf</span> of Vigàta open to the sky…"
                  </div>
                </div>
              </>
            ) : (
              <div style={{ marginTop: "auto", textAlign: "center", padding: "0 0 8px" }}>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-3)" }}>Tap card to reveal</div>
              </div>
            )}
          </div>

          {/* Rating row (visible when revealed) */}
          {revealed ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 18 }}>
              {[
                { lbl: "Again",  sub: "<1m",  bg: "color-mix(in oklab, oklch(0.62 0.18 25) 18%, transparent)", fg: "oklch(0.55 0.18 25)" },
                { lbl: "Hard",   sub: "6m",   bg: "var(--learning-soft)", fg: "var(--learning)" },
                { lbl: "Good",   sub: "1d",   bg: "var(--known-soft)", fg: "var(--known)" },
                { lbl: "Easy",   sub: "4d",   bg: "var(--ink)", fg: "var(--paper)" },
              ].map((b, i) => (
                <div key={i} style={{
                  background: b.bg, color: b.fg,
                  borderRadius: 14, padding: "12px 0", textAlign: "center",
                  fontFamily: "var(--font-ui)",
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{b.lbl}</div>
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2, fontFamily: "var(--font-mono)" }}>{b.sub}</div>
                </div>
              ))}
            </div>
          ) : (
            <button className="fl-btn fl-btn--primary fl-btn--block" style={{ marginTop: 18 }}>
              Show answer
            </button>
          )}
        </div>
      </div>
    </PhoneShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Word Card (detailed view, opened from Deck)
// ─────────────────────────────────────────────────────────────
function WordCardScreen({ theme = "light" }) {
  return (
    <PhoneShell theme={theme}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 18px 4px" }}>
          <button className="fl-icon-btn"><IcChevronLeft size={18}/></button>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-3)" }}>5 of 428</div>
          <button className="fl-icon-btn"><IcHeart size={18}/></button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px 100px" }}>
          <div className="fl-section-label">English noun</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
            <h1 style={{ fontFamily: "var(--font-reading)", fontSize: 48, fontWeight: 500, color: "var(--ink)", letterSpacing: "-.025em", margin: 0, lineHeight: 1 }}>wharf</h1>
            <button className="fl-icon-btn" aria-label="Play"><IcVolume size={18}/></button>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink-3)", marginTop: 6 }}>/wɔːrf/  ·  plural: wharves</div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            <span className="fl-pill" style={{ background: "var(--learning-soft)", color: "var(--learning)" }}>Learning</span>
            <span className="fl-pill">CEFR · B2</span>
            <span className="fl-pill">Seen 3×</span>
            <span className="fl-pill">Next: in 1d</span>
          </div>

          <div style={{ marginTop: 26 }}>
            <div className="fl-section-label">Translation</div>
            <div style={{ fontFamily: "var(--font-reading)", fontSize: 30, color: "var(--ink)", marginTop: 4, letterSpacing: "-.01em" }}>пристань <span style={{ color: "var(--ink-3)", fontSize: 18 }}>, причал</span></div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="fl-section-label">Definition</div>
            <div style={{ fontFamily: "var(--font-reading)", fontSize: 16, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.5 }}>
              A level quayside area to which a ship may be moored to load and unload.
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="fl-section-label">First seen</div>
            <div style={{ marginTop: 8, padding: 16, background: "var(--paper-2)", borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <BookCover book={SAMPLE_BOOKS[0]} w={32} h={44} />
                <div>
                  <div style={{ fontFamily: "var(--font-reading)", fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{SAMPLE_BOOKS[0].title}</div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--ink-3)" }}>p. 42 · 11 May</div>
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-reading)", fontSize: 15, color: "var(--ink-2)", marginTop: 12, fontStyle: "italic", lineHeight: 1.5 }}>
                "…leaving the <span style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 3, padding: "0 3px" }}>wharf</span> of Vigàta open to the sky like the page of an old atlas."
              </div>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="fl-section-label">Related</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {["pier", "dock", "quay", "harbor", "jetty"].map((w) => (
                <span key={w} className="fl-pill" style={{ fontSize: 13, padding: "7px 12px", fontFamily: "var(--font-reading)" }}>{w}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          position: "absolute", left: 18, right: 18, bottom: 24,
          display: "flex", gap: 8,
        }}>
          <button className="fl-btn fl-btn--ghost" style={{ flex: 1 }}>Forget</button>
          <button className="fl-btn fl-btn--accent" style={{ flex: 2 }}><IcCards size={16}/> Practice</button>
        </div>
      </div>
    </PhoneShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Import screen (drag-drop EPUB / FB2)
// ─────────────────────────────────────────────────────────────
function ImportScreen({ theme = "light" }) {
  return (
    <PhoneShell theme={theme}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 22px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="fl-icon-btn"><IcChevronLeft size={18}/></button>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Add a book</div>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="fl-section-label">From your phone</div>
          <button style={{
            display: "block", width: "100%",
            marginTop: 8, padding: "22px 22px",
            border: "none", textAlign: "left",
            borderRadius: 18,
            background: "var(--ink)",
            color: "var(--paper)",
            cursor: "pointer",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "var(--accent)", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <IcPlus size={26}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-reading)", fontSize: 19, fontWeight: 500, letterSpacing: "-.01em" }}>Choose a file</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "color-mix(in oklab, var(--paper) 70%, transparent)", marginTop: 3 }}>EPUB · FB2 · FB2.zip · TXT</div>
              </div>
              <IcChevronRight size={20} color="color-mix(in oklab, var(--paper) 70%, transparent)"/>
            </div>
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
            {[
              { name: "Files",    sub: "On device",  c: "oklch(0.55 0.12 250)" },
              { name: "Cloud",    sub: "Drive / iCloud", c: "oklch(0.62 0.13 200)" },
              { name: "URL",      sub: "Paste link", c: "oklch(0.48 0.08 280)" },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "14px 12px",
                background: "color-mix(in oklab, var(--ink) 4%, transparent)",
                borderRadius: 14, textAlign: "center",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11, margin: "0 auto 8px",
                  background: s.c, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {i === 0 ? <IcBook size={18}/> : i === 1 ? <IcGlobe size={18}/> : <IcLayers size={18}/>}
                </div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.name}</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div className="fl-section-label">Free libraries</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {[
              { name: "Project Gutenberg", sub: "Public-domain classics", c: "#2E7D5B" },
              { name: "Standard Ebooks",   sub: "Beautifully formatted",  c: "#7A4E2D" },
            ].map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", background: "color-mix(in oklab, var(--ink) 4%, transparent)",
                borderRadius: 14,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: s.c, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-reading)", fontWeight: 500, fontSize: 18,
                }}>{s.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>{s.name}</div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{s.sub}</div>
                </div>
                <IcChevronRight size={18} color="var(--ink-3)"/>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{
          padding: 16, background: "var(--paper-2)", borderRadius: 16,
          marginBottom: 30,
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--ink)", color: "var(--paper)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <IcLayers size={18}/>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>On-device translation</div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.4 }}>
              Your books and translations stay on your phone. The 84&nbsp;MB language model runs offline.
            </div>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

Object.assign(window, {
  OnboardingScreen, LibraryScreen, ReaderSettingsScreen, ProgressScreen,
  FlashcardsScreen, WordCardScreen, ImportScreen, BookCover, FlTabBar, SAMPLE_BOOKS,
});
