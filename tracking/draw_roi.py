"""Draw the 20 m analytical ROI for one camera position.

Usage:
    python draw_roi.py VIDEO.mp4 --segment G1 --out rois.json

Left-click to add polygon vertices, right-click to undo, Enter to save,
Esc to quit without saving. One ROI per segment (camera position); if the
camera was re-positioned between seasons, use --key G1_winter etc.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--segment", required=True, help="ROI key, e.g. G1 or G1_winter")
    ap.add_argument("--out", default="rois.json")
    ap.add_argument("--frame", type=int, default=30, help="frame index to draw on")
    a = ap.parse_args()

    cap = cv2.VideoCapture(a.video)
    cap.set(cv2.CAP_PROP_POS_FRAMES, a.frame)
    ok, img = cap.read()
    cap.release()
    if not ok:
        raise SystemExit(f"cannot read frame {a.frame} of {a.video}")

    pts = []

    def on_mouse(ev, x, y, *_):
        if ev == cv2.EVENT_LBUTTONDOWN:
            pts.append([x, y])
        elif ev == cv2.EVENT_RBUTTONDOWN and pts:
            pts.pop()

    win = f"ROI {a.segment}  (L-click add, R-click undo, Enter save, Esc quit)"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(win, on_mouse)
    while True:
        view = img.copy()
        for p in pts:
            cv2.circle(view, tuple(p), 5, (0, 255, 255), -1)
        if len(pts) > 1:
            cv2.polylines(view, [np.array(pts, np.int32)], len(pts) > 2, (0, 255, 0), 2)
        cv2.imshow(win, view)
        k = cv2.waitKey(20) & 0xFF
        if k == 27:
            return
        if k in (13, 10) and len(pts) >= 3:
            break
    cv2.destroyAllWindows()

    out = Path(a.out)
    rois = json.loads(out.read_text()) if out.exists() else {}
    rois[a.segment] = {"polygon": pts, "frame_size": [img.shape[1], img.shape[0]]}
    out.write_text(json.dumps(rois, indent=2))
    print(f"saved ROI '{a.segment}' with {len(pts)} vertices to {out}")


if __name__ == "__main__":
    main()
