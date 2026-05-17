// Fluera — multilingual sample texts.
// Same opening passage of "The Garden of Forking Paths" in 6 source languages.
// Each language is rendered with the typeface chosen FOR THAT LANGUAGE
// — set on a container via data-lang=".." (defined in tokens.css).
//
// Translations into Russian (the user's interface language) are rendered
// with the Cyrillic font pair, not the source-language pair.

const LANG_SAMPLES = {
  en: {
    label: "English",
    code: "EN",
    native: "English",
    dir: "ltr",
    pairing: "Source Serif 4 · Inter",
    book: "The Garden of Forking Paths",
    author: "J. L. Borges",
    chapter: "Ch. 3 — I.",
    paragraphs: [
      [
        "On a ", ["pale", "new"], " October morning, the ",
        ["tide", "new", "прилив"], " withdrew further than anyone could remember, leaving the ",
        ["wharf", "new", "пристань"], " of Vigàta open to the sky like the page of an old atlas.",
      ],
      [
        "Stephen wandered between the abandoned boats, counting the small pebbles his daughter had once arranged in the shape of a constellation.",
      ],
    ],
  },

  ru: {
    label: "Russian",
    code: "RU",
    native: "Русский",
    dir: "ltr",
    pairing: "Lora · Inter",
    book: "Сад расходящихся тропок",
    author: "Х. Л. Борхес",
    chapter: "Гл. 3 — I.",
    paragraphs: [
      [
        "Бледным октябрьским утром ", ["отлив", "new", "tide"], " отступил дальше, чем кто-либо мог припомнить, оставив ",
        ["пристань", "new", "wharf"], " Вигаты открытой небу, словно страница старого ",
        ["атласа", "learning", "atlas"], ".",
      ],
      [
        "Стивен бродил между заброшенными лодками, пересчитывая мелкие камешки, которые его дочь когда-то выложила в форме созвездия.",
      ],
    ],
  },

  ja: {
    label: "Japanese",
    code: "JP",
    native: "日本語",
    dir: "ltr",
    pairing: "Shippori Mincho · Noto Sans JP",
    book: "八岐の園",
    author: "ホルヘ・ルイス・ボルヘス",
    chapter: "第三章 — I.",
    paragraphs: [
      [
        "蒼白い十月の朝、", ["潮", "new", "прилив"], "は誰の記憶よりも遠くへ引き、ヴィガータの",
        ["波止場", "new", "пристань"], "を、古い", ["地図帳", "learning", "атлас"], "の一頁のように空へ開け放った。",
      ],
      [
        "ステファンは打ち捨てられた小舟のあいだを歩き、かつて娘が星座のかたちに並べた小石を数えていた。",
      ],
    ],
  },

  ko: {
    label: "Korean",
    code: "KR",
    native: "한국어",
    dir: "ltr",
    pairing: "Noto Serif KR · Noto Sans KR",
    book: "갈래길의 정원",
    author: "호르헤 루이스 보르헤스",
    chapter: "3장 — I.",
    paragraphs: [
      [
        "창백한 시월 아침, ", ["조수", "new", "прилив"], "는 누구의 기억보다 멀리 물러나, 비가타의 ",
        ["부두", "new", "пристань"], "를 옛 ", ["지도책", "learning", "атлас"], "의 한 페이지처럼 하늘을 향해 열어 놓았다.",
      ],
      [
        "스테판은 버려진 배들 사이를 거닐며, 그의 딸이 언젠가 별자리 모양으로 배열해 둔 작은 조약돌들을 세고 있었다.",
      ],
    ],
  },

  ar: {
    label: "Arabic",
    code: "AR",
    native: "العربية",
    dir: "rtl",
    pairing: "Amiri · Noto Sans Arabic",
    book: "حديقة الدروب المتشعبة",
    author: "خورخي لويس بورخيس",
    chapter: "الفصل ٣ — أولاً",
    paragraphs: [
      [
        "في صباحٍ شاحبٍ من أكتوبر، انحسر ", ["المدُّ", "new", "прилив"], " أبعد مما يذكر أحد، تاركاً ",
        ["رصيف", "new", "пристань"], " فيغاتا مفتوحاً على السماء كصفحةٍ من ", ["أطلسٍ", "learning", "атлас"], " قديم.",
      ],
      [
        "تجوَّل ستيفان بين القوارب المهجورة، يُحصي الحصى الصغيرة التي رتَّبتها ابنته يوماً على هيئة كوكبة.",
      ],
    ],
  },

  hi: {
    label: "Hindi",
    code: "HI",
    native: "हिन्दी",
    dir: "ltr",
    pairing: "Tiro Devanagari · Noto Sans Devanagari",
    book: "द्विभाजित पथों का उद्यान",
    author: "ख़ोरख़े लुइस बोर्ख़ेस",
    chapter: "अध्याय ३ — I.",
    paragraphs: [
      [
        "अक्टूबर की एक पीली सुबह, ", ["ज्वार", "new", "прилив"], " इतनी दूर तक हट गया जितना किसी को याद नहीं था, और विगाता का ",
        ["घाट", "new", "пристань"], " पुराने ", ["मानचित्र", "learning", "атлас"], " के एक पन्ने की तरह खुले आकाश के नीचे रह गया।",
      ],
      [
        "स्तीफ़न परित्यक्त नौकाओं के बीच घूमता रहा, उन छोटे कंकड़ों को गिनते हुए जिन्हें उसकी बेटी ने कभी एक नक्षत्र के आकार में सजाया था।",
      ],
    ],
  },
};

// ───────────────────────────────────────────────────────────────
// Renderer — paragraph array → JSX with tap-words.
// Reuses the .fl-reading / .fl-word styles from tokens.css.
// ───────────────────────────────────────────────────────────────
function MultilingualParagraphs({ paragraphs, showHighlights = true, onTapWord, activeId }) {
  return (
    <>
      {paragraphs.map((p, pi) => (
        <p key={pi} style={{ margin: "0 0 1.1em 0", textIndent: pi === 0 ? 0 : "1.2em", textWrap: "pretty" }}>
          {p.map((seg, si) => {
            if (typeof seg === "string") return <span key={si}>{seg}</span>;
            const [w, status, translation] = seg;
            const id = `${pi}-${si}`;
            const isActive = activeId === id;
            return (
              <span
                key={id}
                className={`fl-word ${showHighlights ? status : ""} ${isActive ? "is-active" : ""}`}
                onClick={() => onTapWord && onTapWord({ id, word: w, status, translation })}
              >{w}</span>
            );
          })}
        </p>
      ))}
    </>
  );
}

Object.assign(window, { LANG_SAMPLES, MultilingualParagraphs });
