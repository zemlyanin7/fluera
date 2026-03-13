export function generateBridgeScript(): string {
  return `
    (function() {
      // --- Word Tap Detection ---
      document.addEventListener('click', function(e) {
        if (window.getSelection().toString().length > 0) return;

        var range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!range || !range.startContainer || range.startContainer.nodeType !== 3) return;

        var textNode = range.startContainer;
        var text = textNode.textContent;
        var offset = range.startOffset;

        // Unicode-aware word boundary: Latin + Cyrillic + Polish diacritics
        var wordChar = /[a-zA-Z\\u00C0-\\u024F\\u0400-\\u04FF\\w]/;
        var start = offset;
        var end = offset;
        while (start > 0 && wordChar.test(text[start - 1])) start--;
        while (end < text.length && wordChar.test(text[end])) end++;

        var word = text.substring(start, end).trim();
        if (!word) return;

        var sentence = extractSentence(textNode, word);

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'wordTap',
          word: word,
          sentence: sentence,
        }));
      });

      // --- Phrase Selection ---
      var selectionTimeout;
      document.addEventListener('selectionchange', function() {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(function() {
          var sel = window.getSelection();
          var phrase = sel.toString().trim();
          if (phrase && phrase.split(/\\s+/).length >= 2) {
            var sentence = '';
            if (sel.anchorNode) {
              sentence = extractSentence(sel.anchorNode, phrase);
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'phraseSelect',
              phrase: phrase,
              sentence: sentence,
            }));
          }
        }, 500);
      });

      // --- Sentence Extraction ---
      function extractSentence(node, word) {
        var el = node.nodeType === 3 ? node.parentElement : node;
        var block = el;
        while (block && !['P', 'DIV', 'SECTION', 'ARTICLE'].includes(block.tagName)) {
          block = block.parentElement;
        }
        var fullText = (block || el).textContent || '';
        var wordIndex = fullText.toLowerCase().indexOf(word.toLowerCase());
        if (wordIndex === -1) return fullText.substring(0, 200);

        var sentenceStart = fullText.lastIndexOf('.', wordIndex);
        var qStart = fullText.lastIndexOf('?', wordIndex);
        var eStart = fullText.lastIndexOf('!', wordIndex);
        sentenceStart = Math.max(sentenceStart, qStart, eStart) + 1;

        var sentenceEnd = fullText.indexOf('.', wordIndex + word.length);
        var qEnd = fullText.indexOf('?', wordIndex + word.length);
        var eEnd = fullText.indexOf('!', wordIndex + word.length);
        var ends = [sentenceEnd, qEnd, eEnd].filter(function(e) { return e !== -1; });
        sentenceEnd = ends.length > 0 ? Math.min.apply(null, ends) + 1 : fullText.length;

        return fullText.substring(sentenceStart, sentenceEnd).trim();
      }

      // --- Word Highlighting ---
      window.highlightWords = function(wordColors) {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        var textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        var batch = 0;
        function processBatch() {
          var end = Math.min(batch + 500, textNodes.length);
          for (var i = batch; i < end; i++) {
            var node = textNodes[i];
            if (!node.parentElement || node.parentElement.classList.contains('fluera-highlighted')) continue;

            var words = node.textContent.split(/(\\s+)/);
            if (words.length <= 1 && !wordColors[words[0].toLowerCase()]) continue;

            var frag = document.createDocumentFragment();
            var hasHighlight = false;

            words.forEach(function(part) {
              var lower = part.toLowerCase().replace(/[^a-zA-Z\\u00C0-\\u024F\\u0400-\\u04FF]/g, '');
              var color = wordColors[lower];
              if (color && color !== 'transparent') {
                var span = document.createElement('span');
                span.textContent = part;
                span.style.color = color;
                span.className = 'fluera-highlighted';
                frag.appendChild(span);
                hasHighlight = true;
              } else {
                frag.appendChild(document.createTextNode(part));
              }
            });

            if (hasHighlight) {
              node.parentElement.replaceChild(frag, node);
            }
          }
          batch = end;
          if (batch < textNodes.length) {
            requestAnimationFrame(processBatch);
          }
        }
        requestAnimationFrame(processBatch);
      };

      // --- Location Tracking (throttled 500ms) ---
      var lastLocationTime = 0;
      if (typeof book !== 'undefined' && book.rendition) {
        book.rendition.on('relocated', function(location) {
          var now = Date.now();
          if (now - lastLocationTime < 500) return;
          lastLocationTime = now;

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'locationChange',
            cfi: location.start.cfi,
            progress: location.start.percentage || 0,
          }));
        });
      }
    })();
  `;
}
