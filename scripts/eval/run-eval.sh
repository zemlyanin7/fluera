#!/usr/bin/env bash
# chrF FLORES-200 baseline measurement для Hy-MT 1.5 1.8B 1.25-bit
# See README.md for prereqs.

set -euo pipefail

# Config
LLAMA_CLI="${LLAMA_CLI:-$HOME/dev/llama-eval/llama.cpp/build/bin/llama-cli}"
MODEL="${MODEL:-$HOME/dev/llama-eval/Hy-MT1.5-1.8B-1.25bit.gguf}"
FLORES_DIR="${FLORES_DIR:-./flores200_dataset/dev}"
SAMPLE_SIZE="${SAMPLE_SIZE:-200}"
OUTPUT="${OUTPUT:-results.json}"

# Pairs to evaluate (12 priority)
PAIRS=(
  "eng_Latn:rus_Cyrl"  # en→ru
  "rus_Cyrl:eng_Latn"  # ru→en
  "eng_Latn:spa_Latn"  # en→es
  "spa_Latn:eng_Latn"
  "eng_Latn:fra_Latn"  # en→fr
  "fra_Latn:eng_Latn"
  "eng_Latn:deu_Latn"  # en→de
  "deu_Latn:eng_Latn"
  "eng_Latn:por_Latn"  # en→pt
  "por_Latn:eng_Latn"
  "eng_Latn:jpn_Jpan"  # en→ja (CJK)
  "jpn_Jpan:eng_Latn"
)

LANG_NAMES=(
  ["eng_Latn"]="English"
  ["rus_Cyrl"]="Russian"
  ["spa_Latn"]="Spanish"
  ["fra_Latn"]="French"
  ["deu_Latn"]="German"
  ["por_Latn"]="Portuguese"
  ["jpn_Jpan"]="Japanese"
  ["kor_Hang"]="Korean"
)

# Production threshold per type
threshold_for() {
  local pair="$1"
  case "$pair" in
    eng_Latn:spa_Latn|spa_Latn:eng_Latn|eng_Latn:fra_Latn|fra_Latn:eng_Latn|eng_Latn:por_Latn|por_Latn:eng_Latn) echo 45 ;;
    eng_Latn:rus_Cyrl|rus_Cyrl:eng_Latn) echo 38 ;;
    eng_Latn:deu_Latn|deu_Latn:eng_Latn) echo 42 ;;
    eng_Latn:jpn_Jpan|jpn_Jpan:eng_Latn|eng_Latn:kor_Hang|kor_Hang:eng_Latn) echo 28 ;;
    *) echo 40 ;;
  esac
}

# Verify prereqs
[ -x "$LLAMA_CLI" ] || { echo "llama-cli not found at $LLAMA_CLI"; exit 1; }
[ -f "$MODEL" ] || { echo "Model not found at $MODEL"; exit 1; }
[ -d "$FLORES_DIR" ] || { echo "FLORES dir not found at $FLORES_DIR"; exit 1; }
command -v sacrebleu >/dev/null || { echo "Install sacrebleu: pip install sacrebleu"; exit 1; }

echo "[eval] Starting Hy-MT 1.5 1.8B 1.25-bit chrF baseline measurement"
echo "[eval] $SAMPLE_SIZE sentences × ${#PAIRS[@]} pairs"
echo "[eval] Output: $OUTPUT"
echo ""

# Initialize JSON output
cat > "$OUTPUT" <<EOF
{
  "measuredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "model": "Hy-MT1.5-1.8B-1.25bit",
  "kernelBuild": "pr22836-stq1_0",
  "host": "$(uname -m) $(sw_vers -productName 2>/dev/null || uname -s)",
  "sampleSize": $SAMPLE_SIZE,
  "pairs": [
EOF

FIRST=true

for PAIR in "${PAIRS[@]}"; do
  SRC=${PAIR%:*}
  DST=${PAIR#*:}
  SRC_LANG="${LANG_NAMES[$SRC]:-$SRC}"
  DST_LANG="${LANG_NAMES[$DST]:-$DST}"

  echo "[eval] $SRC → $DST ($SRC_LANG → $DST_LANG)"

  SRC_FILE="$FLORES_DIR/$SRC.dev"
  REF_FILE="$FLORES_DIR/$DST.dev"

  [ -f "$SRC_FILE" ] || { echo "  SKIP — $SRC_FILE missing"; continue; }
  [ -f "$REF_FILE" ] || { echo "  SKIP — $REF_FILE missing"; continue; }

  # Sample first N lines
  head -n "$SAMPLE_SIZE" "$SRC_FILE" > /tmp/src.txt
  head -n "$SAMPLE_SIZE" "$REF_FILE" > /tmp/ref.txt

  # Translate via llama-cli
  > /tmp/hyp.txt
  WORDS_DONE=0
  while IFS= read -r LINE; do
    PROMPT="Translate the following segment into $DST_LANG, without additional explanation：$LINE"
    OUTPUT_TEXT=$("$LLAMA_CLI" -m "$MODEL" -p "$PROMPT" \
      --jinja -ngl 0 -n 200 --top-k 1 --temp 0 -c 2048 \
      --silent 2>/dev/null | tail -n 1 | head -c 1000)
    echo "$OUTPUT_TEXT" >> /tmp/hyp.txt
    WORDS_DONE=$((WORDS_DONE + 1))
    if [ $((WORDS_DONE % 20)) -eq 0 ]; then
      echo "  $WORDS_DONE / $SAMPLE_SIZE done"
    fi
  done < /tmp/src.txt

  # Score chrF + BLEU
  CHRF=$(sacrebleu /tmp/ref.txt -i /tmp/hyp.txt -m chrf --quiet | awk '{print $NF}')
  BLEU=$(sacrebleu /tmp/ref.txt -i /tmp/hyp.txt -m bleu --quiet | awk '{print $3}' | tr -d ',')
  THRESHOLD=$(threshold_for "$PAIR")
  SHIP=$([ "$(echo "$CHRF >= $THRESHOLD" | bc -l)" -eq 1 ] && echo "true" || echo "false")

  echo "  chrF: $CHRF | BLEU: $BLEU | threshold: $THRESHOLD | ship: $SHIP"

  # Append к JSON
  COMMA=$($FIRST && echo "" || echo ",")
  cat >> "$OUTPUT" <<EOF
$COMMA    {
      "source": "$SRC", "target": "$DST",
      "sourceName": "$SRC_LANG", "targetName": "$DST_LANG",
      "sentenceCount": $SAMPLE_SIZE,
      "chrF": $CHRF,
      "BLEU": $BLEU,
      "productionThreshold": $THRESHOLD,
      "ship": $SHIP
    }
EOF
  FIRST=false
done

cat >> "$OUTPUT" <<EOF

  ]
}
EOF

echo ""
echo "[eval] Done. Results: $OUTPUT"
cat "$OUTPUT"
