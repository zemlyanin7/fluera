// Fluera — inline icons (24×24, currentColor strokes).
// Each icon is a standalone SVG component; no JSX-in-prop indirection
// (Babel standalone chokes on fragments-inside-attributes for long SVG paths).

const _svg = (children, props = {}) => {
  const { size = 22, color = "currentColor", strokeWidth = 1.8, fill = "none" } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
         stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
};

const IcChevronLeft  = (p) => _svg(<path d="M15 6l-6 6 6 6"/>, p);
const IcChevronRight = (p) => _svg(<path d="M9 6l6 6-6 6"/>, p);
const IcChevronDown  = (p) => _svg(<path d="M6 9l6 6 6-6"/>, p);
const IcClose        = (p) => _svg(<><path d="M6 6l12 12"/><path d="M6 18L18 6"/></>, p);
const IcSearch       = (p) => _svg(<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>, p);
const IcPlus         = (p) => _svg(<><path d="M12 5v14"/><path d="M5 12h14"/></>, p);
const IcBook         = (p) => _svg(<><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2V5z"/><path d="M4 19h14"/></>, p);
const IcLibrary      = (p) => _svg(<><rect x="3" y="4" width="6" height="16" rx="1.5"/><rect x="11" y="4" width="4" height="16" rx="1.5"/><path d="M17 5l3 1-2 14-3-1z"/></>, p);
const IcSparkle      = (p) => _svg(<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z"/>, p);
const IcFlame        = (p) => _svg(<path d="M12 3c1 3 4 4 4 8a4 4 0 1 1-8 0c0-1.5.5-2.5 1.5-3.5C10 9 11 6 12 3z"/>, p);
const IcGraph        = (p) => _svg(<><path d="M4 19h16"/><path d="M6 16V9"/><path d="M11 16V5"/><path d="M16 16v-4"/><path d="M21 16V11"/></>, p);
const IcCards        = (p) => _svg(<><rect x="3" y="6" width="13" height="14" rx="2"/><path d="M7 3h13a1 1 0 0 1 1 1v13"/></>, p);
const IcPlay         = (p) => _svg(<path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>, p);
const IcVolume       = (p) => _svg(<><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9c1.5 1 1.5 5 0 6"/></>, p);
const IcBookmark     = (p) => _svg(<path d="M6 4h12v17l-6-4-6 4z"/>, p);
const IcStar         = (p) => _svg(<path d="M12 3l2.7 5.5 6 .9-4.4 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.3 9.4l6-.9z"/>, p);
const IcHeart        = (p) => _svg(<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>, p);
const IcCheck        = (p) => _svg(<path d="M5 12l5 5 9-11"/>, p);
const IcArrowRight   = (p) => _svg(<><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></>, p);
const IcGlobe        = (p) => _svg(<><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 3 15 0 18"/><path d="M12 3c-3 3-3 15 0 18"/></>, p);
const IcFontSize     = (p) => _svg(<><path d="M3 18l5-12 5 12"/><path d="M5 14h6"/><path d="M14 18l4-8 4 8"/><path d="M15.5 15h5"/></>, p);
const IcMoon         = (p) => _svg(<path d="M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z"/>, p);
const IcMore         = (p) => _svg(<><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></>, p);
const IcLayers       = (p) => _svg(<><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/></>, p);
const IcSettings     = (p) => _svg(<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.2-1.6l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2.8-1.6L13 2h-4l-.6 2.6A7 7 0 0 0 5.6 6.2L3.2 5.4l-2 3.4 2 1.6A7 7 0 0 0 3 12c0 .6.1 1.1.2 1.6l-2 1.6 2 3.4 2.4-.8a7 7 0 0 0 2.8 1.6L9 22h4l.6-2.6a7 7 0 0 0 2.8-1.6l2.4.8 2-3.4-2-1.6c.1-.5.2-1 .2-1.6z"/></>, p);

Object.assign(window, {
  IcChevronLeft, IcChevronRight, IcChevronDown, IcClose, IcSearch, IcPlus,
  IcBook, IcLibrary, IcSparkle, IcFlame, IcGraph, IcSettings, IcCards, IcPlay,
  IcVolume, IcBookmark, IcStar, IcHeart, IcCheck, IcArrowRight, IcGlobe,
  IcFontSize, IcMoon, IcMore, IcLayers,
});
