"""Tracked-change find/replace for .docx (real w:del / w:ins revisions)."""
import copy, datetime, docx
from docx.oxml.ns import qn
AUTHOR = "Author"; DATE = datetime.datetime(2026, 11, 16).strftime("%Y-%m-%dT%H:%M:%SZ")
_id = [9000]
def _nid():
    _id[0] += 1; return str(_id[0])

def _runs(p):
    return [r for r in p.iterchildren() if r.tag == qn("w:r")]

def _rtext(r):
    return "".join(t.text or "" for t in r.iter(qn("w:t")))

def _set_text(r, txt):
    ts = list(r.iter(qn("w:t")))
    for t in ts[1:]: t.getparent().remove(t)
    ts[0].text = txt; ts[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

def _split(r, k):
    """split run r at char k -> (left, right); returns right run (inserted after r)."""
    txt = _rtext(r); r2 = copy.deepcopy(r)
    _set_text(r, txt[:k]); _set_text(r2, txt[k:]); r.addnext(r2); return r2

def replace(p, old, new, occurrence=1):
    """p: lxml w:p element. Returns True if replaced."""
    runs = _runs(p); full = "".join(_rtext(r) for r in runs)
    pos = -1
    for _ in range(occurrence):
        pos = full.find(old, pos + 1)
        if pos < 0: return False
    end = pos + len(old)
    # split at boundaries
    def cut(at):
        off = 0
        for r in _runs(p):
            L = len(_rtext(r))
            if off < at < off + L: _split(r, at - off); return
            off += L
    cut(pos); cut(end)
    sel, off = [], 0
    for r in _runs(p):
        L = len(_rtext(r))
        if off >= pos and off + L <= end and L > 0: sel.append(r)
        off += L
    rpr = sel[0].find(qn("w:rPr"))
    d = p.makeelement(qn("w:del"), {qn("w:id"): _nid(), qn("w:author"): AUTHOR, qn("w:date"): DATE})
    sel[0].addprevious(d)
    for r in sel:
        for t in r.iter(qn("w:t")): t.tag = qn("w:delText")
        d.append(r)
    if new:
        ins = p.makeelement(qn("w:ins"), {qn("w:id"): _nid(), qn("w:author"): AUTHOR, qn("w:date"): DATE})
        nr = p.makeelement(qn("w:r"), {})
        if rpr is not None: nr.append(copy.deepcopy(rpr))
        t = nr.makeelement(qn("w:t"), {}); t.text = new; t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve"); nr.append(t)
        ins.append(nr); d.addnext(ins)
    return True

def all_paragraphs(doc):
    body = doc.element.body
    return list(body.iter(qn("w:p")))

def ptext(p):
    return "".join(_rtext(r) for r in _runs(p))

def apply(doc, edits, log):
    """edits: list of (anchor, old, new). anchor: substring identifying paragraph (or None = old itself)."""
    ps = all_paragraphs(doc)
    for anchor, old, new in edits:
        if old == new: continue
        hits = [p for p in ps if (anchor or old) in ptext(p) and old in ptext(p)]
        if len(hits) != 1:
            log.append(f"!! {len(hits)} hits for [{anchor}] {old[:50]}"); continue
        ok = replace(hits[0], old, new); log.append(("ok " if ok else "!! fail ") + old[:60] + " -> " + new[:60])
