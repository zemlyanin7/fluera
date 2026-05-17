// Fluera — shared phone-shell components.
// Wraps each screen in an iPhone-shaped frame at design size 390×844.
// We DON'T use the full IOSDevice from the starter because Fluera's reader
// screen has its own custom statusbar/topbar styling per theme.

const PHONE_W = 390;
const PHONE_H = 844;

// Minimal status bar that picks up var(--ink) so it adapts to dark / sepia.
function FlStatusBar({ time = "9:41" }) {
  return (
    <div className="fl-statusbar">
      <span>{time}</span>
      <div className="icons">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.7"/><rect x="4.5" y="5" width="3" height="6" rx="0.7"/><rect x="9" y="2.5" width="3" height="8.5" rx="0.7"/><rect x="13.5" y="0" width="3" height="11" rx="0.7"/></svg>
        <svg width="16" height="11" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z"/><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z"/><circle cx="8.5" cy="10.5" r="1.5"/></svg>
        <svg width="25" height="11" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill="currentColor" fillOpacity="0.5"/></svg>
      </div>
    </div>
  );
}

// The phone shell — rounded corners, dynamic island, home indicator.
// `theme` selects the CSS theme variant. Children are the screen.
function PhoneShell({ children, theme = "light", time = "9:41", noHome = false, style = {} }) {
  return (
    <div
      className="fl-screen"
      data-theme={theme}
      style={{
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: 48,
        boxShadow: "0 30px 60px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.10), inset 0 0 0 4px #0c0a08",
        ...style,
      }}
    >
      {/* Dynamic island */}
      <div style={{
        position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)",
        width: 122, height: 35, borderRadius: 24, background: "#000", zIndex: 40,
      }} />
      <FlStatusBar time={time} />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {children}
      </div>
      {!noHome && (
        <div className="fl-homebar"><div className="hb" /></div>
      )}
    </div>
  );
}

Object.assign(window, { PhoneShell, FlStatusBar, PHONE_W, PHONE_H });
