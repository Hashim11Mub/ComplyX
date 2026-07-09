"""
Verbatim-excerpt cleanup.

Retrieved chunks are windowed slices of long articles, so their raw text can
start or end mid-word or mid-sentence ("aph (3-2-2). When engaging...",
"...with enhanced due diligence measures ta"). clean_excerpt() trims both
edges to readable boundaries while only ever REMOVING text from the ends:
the result is always a contiguous substring of the input, so the
quote-faithfulness guarantee (excerpt appears verbatim in the retrieved
chunk) is preserved by construction. Nothing is inserted, ever.
"""

import re

# Sentence-ending punctuation followed by whitespace (Arabic marks included).
_BOUNDARY = re.compile(r"[.!?؟؛](?=\s)")
# A boundary that is actually a list marker ("7." / "(3)" numbering), not a
# sentence end: a 1-2 digit token directly before the period.
_LIST_MARKER_TAIL = re.compile(r"(?:^|[\s(])\d{1,2}\.$")
# Characters that betray a mid-sentence start when they open the text.
_BAD_START = ",;:)]»،؛"


def _sentence_ends(text: str) -> list[int]:
    """Indexes of real sentence-ending punctuation (list markers excluded)."""
    ends = []
    for match in _BOUNDARY.finditer(text):
        i = match.start()
        if _LIST_MARKER_TAIL.search(text[max(0, i - 4): i + 1]):
            continue
        ends.append(i)
    return ends


def clean_excerpt(text: str, max_len: int = 1200) -> str:
    t = (text or "").strip()
    if not t:
        return t

    # 1. Hard cap at a word boundary (never mid-word).
    if len(t) > max_len:
        cut = t[:max_len]
        space = cut.rfind(" ")
        if space > max_len // 2:
            cut = cut[:space]
        t = cut.rstrip()

    # 2. Leading fragment: a latin lowercase letter or continuation
    #    punctuation means we are mid-word/mid-sentence. Skip to the first
    #    real sentence start within reach; otherwise drop the partial token.
    if t[0].islower() or t[0] in _BAD_START:
        window = min(300, len(t) // 2)
        starts = [i for i in _sentence_ends(t) if i < window]
        if starts:
            t = t[starts[0] + 1:].lstrip()
        else:
            space = t.find(" ")
            if 0 < space < 40:
                t = t[space + 1:].lstrip()

    # 3. Trailing fragment: if the text does not end on sentence punctuation,
    #    cut back to the last real sentence end when that keeps at least half
    #    of the text; otherwise just drop the (possibly partial) last token.
    if t and t[-1] not in ".!?؟؛:":
        ends = [i for i in _sentence_ends(t) if i >= len(t) // 2]
        if ends:
            t = t[: ends[-1] + 1]
        else:
            match = re.search(r"\s\S{1,24}$", t)
            if match and match.start() > len(t) // 2:
                t = t[: match.start()].rstrip()

    return t.strip()
