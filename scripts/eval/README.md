# Translation quality evaluation harness

> Per-pair chrF baseline measurement для Hy-MT 1.5 1.8B 1.25-bit Sherry quant.
> Required blocking action item для #4.5 sentence translation gate.

## What this measures

chrF (character n-gram F-score) на FLORES-200 dev subset. Per-pair production
threshold = measured baseline × 0.85 (15% headroom for production drift).

См. `docs/superpowers/specs/2026-05-17-translation-popup-design.md` §11.3.

## Prerequisites

1. **Build llama-cli с STQ1_0 kernel patch** (PR #22836):

```bash
# Clone llama.cpp fresh (not from vendor — git state broken там)
mkdir -p ~/dev/llama-eval && cd ~/dev/llama-eval
git clone --depth 100 https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
git fetch origin pull/22836/head:pr-22836
git merge --no-edit pr-22836  # apply STQ kernel

# Build CPU-only (Metal optional но adds variability)
cmake -B build -DLLAMA_METAL=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target llama-cli -j 8
```

2. **Download model** (одноразово, ~440MB):

```bash
cd ~/dev/llama-eval
curl -L -o Hy-MT1.5-1.8B-1.25bit.gguf \
  "https://huggingface.co/tencent/Hy-MT1.5-1.8B-1.25bit-GGUF/resolve/main/Hy-MT1.5-1.8B-1.25bit.gguf"
# Verify SHA: 987121bc98dd7107078019f63e72447d67b224efe97da75811e74529e22e3525
```

3. **Download FLORES-200 dev set** (CC-BY-SA 4.0):

```bash
cd scripts/eval
curl -L -o flores200_dataset.tar.gz \
  "https://tinyurl.com/flores200dataset"
tar -xzf flores200_dataset.tar.gz
# Creates flores200_dataset/dev/ with per-language files
```

4. **Install scoring deps**:

```bash
pip install sacrebleu  # chrF + BLEU implementation
```

## Run

```bash
cd scripts/eval
./run-eval.sh
```

Expected runtime: **~3-4 hours** для 12 pairs × 200 sentences each on CPU.

## Output

`scripts/eval/results.json`:

```json
{
  "measuredAt": "2026-05-17T22:00:00Z",
  "model": "Hy-MT1.5-1.8B-1.25bit",
  "kernelBuild": "pr22836-stq1_0",
  "host": "MacBook Pro M4",
  "pairs": [
    {
      "source": "en", "target": "ru",
      "sentenceCount": 200,
      "chrF": 42.3,
      "BLEU": 28.1,
      "productionThreshold": 35.9,
      "ship": true
    },
    ...
  ]
}
```

## Per-pair priority (top 12)

1. en→ru / ru→en
2. en→es / es→en
3. en→fr / fr→en
4. en→de / de→en
5. en→pt / pt→en
6. en→ja / ja→en (CJK — expect lower)
7. en→ko / ko→en (CJK)
8. en→ar / ar→en (RTL)
9. en→hi / hi→en
10. ru→pl / pl→ru (Slavic↔Slavic)
11. es↔fr, es↔pt (close Romance)
12. fr↔de (close European)

## Production threshold per pair type

| Pair type | Threshold | Reason |
|-----------|-----------|--------|
| Close Romance↔Romance | ≥ 50 | High baseline expected |
| English↔Romance | ≥ 45 | Standard |
| English↔Slavic | ≥ 38 | Moderate |
| Slavic↔Slavic | ≥ 45 | Close family |
| English↔German | ≥ 42 | Standard |
| English↔CJK | ≥ 28 | Typologically distant |
| English↔Arabic/Hindi | ≥ 30 | Typologically distant |

Pairs below threshold → sentence translation disabled at runtime (button hidden).

## Acceptance gate

PR #4.5 merge blocked unless top 6 pairs pass calibrated threshold:
en↔ru, en↔es, en↔fr, en↔de (minimum production set).

CJK + Arabic + Hindi acceptable to skip sentence translation если ниже threshold —
word translation still works on those pairs.
