"""Minimal-change editing helpers for python-docx: replace text across runs, keep run formatting."""
from docx.enum.text import WD_COLOR_INDEX


def replace_in_paragraph(p, old, new, highlight=False):
    """Replace the first occurrence of `old` in paragraph p (which may span runs). Returns True if replaced."""
    runs = p.runs
    full = "".join(r.text for r in runs)
    i = full.find(old)
    if i < 0:
        return False
    j = i + len(old)
    pos = 0; first = None
    for k, r in enumerate(runs):
        a, b = pos, pos + len(r.text); pos = b
        if b <= i or a >= j:
            continue
        s, e = max(i, a) - a, min(j, b) - a
        if first is None:
            first = r
            if highlight and (s > 0 or e < len(r.text)):
                # split so only the new text is highlighted
                pre, post = r.text[:s], r.text[e:]
                r.text = pre
                nr = _insert_run_after(r, new); nr.font.highlight_color = WD_COLOR_INDEX.YELLOW
                if post:
                    _insert_run_after(nr, post)
            else:
                r.text = r.text[:s] + new + r.text[e:]
                if highlight:
                    r.font.highlight_color = WD_COLOR_INDEX.YELLOW
        else:
            r.text = r.text[:s] + r.text[e:]
    return True


def _insert_run_after(run, text):
    import copy
    new_r = copy.deepcopy(run._r)
    run._r.addnext(new_r)
    from docx.text.run import Run
    nr = Run(new_r, run._parent)
    nr.text = text
    return nr


def replace_everywhere(doc, old, new, highlight=False, count_expected=None):
    n = 0
    paras = list(doc.paragraphs)
    for t in doc.tables:
        for row in t.rows:
            for c in row.cells:
                paras.extend(c.paragraphs)
    seen = set()
    for p in paras:
        if id(p._p) in seen:
            continue
        seen.add(id(p._p))
        while old in p.text and replace_in_paragraph(p, old, new, highlight):
            n += 1
            if old in new:
                break
    if count_expected is not None and n != count_expected:
        raise ValueError(f"'{old}' replaced {n} times, expected {count_expected}")
    return n


def set_cell(cell, text, highlight=False):
    """Set a table cell's text, keeping the formatting of its first run."""
    p = cell.paragraphs[0]
    if p.runs:
        p.runs[0].text = text
        for r in p.runs[1:]:
            r.text = ""
        if highlight and p.runs[0].text != "":
            p.runs[0].font.highlight_color = WD_COLOR_INDEX.YELLOW
    else:
        r = p.add_run(text)
        if highlight:
            r.font.highlight_color = WD_COLOR_INDEX.YELLOW
