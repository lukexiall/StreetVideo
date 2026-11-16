"""Re-extract observed segment duration from raw session videos (Section 3.3).

Detection : Ultralytics YOLO (person class), default yolo26x.pt
Tracking  : BoT-SORT with ReID (botsort_reid.yaml in this folder)
Timing    : bottom-centre of the box crossing INTO the ROI polygon starts the
            clock; crossing OUT ends it (departure_status = 1). A track still
            inside the ROI when it is lost or when the video ends is kept up to
            its last reliable sighting and coded right-censored (status = 0).
            Re-entry by the same track ID within --reentry-gap seconds is
            treated as one continuous visit (short occlusion / jitter).

One output row per pedestrian visit, written to a CSV per video plus a
`review_flags` column for the manual QC step (short tracks, very long
durations, censored records, edge-of-frame exits).

Usage (one video):
    python extract_durations.py --video G1_2025-07-21_morning.mp4 \
        --session G1_2025-07-21_morning --roi-key G1 --rois rois.json --out out/

Batch (folder of videos named <segment>_<date>_<period>.mp4):
    python extract_durations.py --video-dir videos/ --rois rois.json --out out/
"""
import argparse
import csv
import json
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent


def inside(poly, x, y):
    return cv2.pointPolygonTest(poly, (float(x), float(y)), False) >= 0


def process(video, session, poly, args):
    from ultralytics import YOLO

    model = YOLO(args.model)
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    cap.release()

    state = {}   # tid -> dict(in_roi, entry_f, last_in_f, last_seen_f, last_xy)
    visits = []  # finished visits

    def close(tid, end_f, status, flag=""):
        s = state[tid]
        dur = (end_f - s["entry_f"]) / fps
        visits.append({
            "session": session, "track_id": tid,
            "entry_s": round(s["entry_f"] / fps, 3),
            "exit_s": round(end_f / fps, 3),
            "duration_s": round(dur, 3),
            "departure_status": status,
            "review_flags": flag,
        })
        s["in_roi"] = False
        s["entry_f"] = None

    stream = model.track(
        source=str(video), stream=True, persist=True, classes=[0],
        tracker=args.tracker, conf=args.conf, imgsz=args.imgsz,
        vid_stride=args.stride, verbose=False, device=args.device,
    )
    f = -args.stride
    lost_after = int(args.lost_s * fps)
    gap = int(args.reentry_gap * fps)
    for res in stream:
        f += args.stride
        seen = set()
        if res.boxes is not None and res.boxes.id is not None:
            for (x1, y1, x2, y2), tid in zip(res.boxes.xyxy.cpu().numpy(),
                                             res.boxes.id.int().cpu().tolist()):
                bx, by = (x1 + x2) / 2, y2  # bottom-centre
                seen.add(tid)
                s = state.setdefault(tid, {"in_roi": False, "entry_f": None,
                                           "last_in_f": None, "last_seen_f": f,
                                           "last_xy": (bx, by)})
                now_in = inside(poly, bx, by)
                if now_in and not s["in_roi"]:
                    if s["entry_f"] is None:
                        s["entry_f"] = f
                    s["in_roi"] = True
                elif not now_in and s["in_roi"]:
                    s["in_roi"] = False
                    s["exit_f"] = f  # tentative; confirmed after `gap`
                if now_in:
                    s["last_in_f"] = f
                s["last_seen_f"] = f
                s["last_xy"] = (bx, by)
        # confirm exits / censor lost tracks
        for tid, s in state.items():
            if s["entry_f"] is None:
                continue
            if not s["in_roi"] and "exit_f" in s and f - s["exit_f"] >= gap:
                x = s["last_xy"][0]
                edge = "edge_exit" if (x < 0.03 * W or x > 0.97 * W) else ""
                close(tid, s.pop("exit_f"), 1, edge)
            elif s["in_roi"] and tid not in seen and f - s["last_seen_f"] > lost_after:
                close(tid, s["last_in_f"], 0, "lost_in_roi")
    # video end
    for tid, s in state.items():
        if s["entry_f"] is None:
            continue
        if not s["in_roi"] and "exit_f" in s:
            close(tid, s.pop("exit_f"), 1)
        else:
            close(tid, s["last_in_f"], 0, "video_end")

    for v in visits:
        flags = [v["review_flags"]] if v["review_flags"] else []
        if v["duration_s"] < args.min_s:
            flags.append("very_short")
        if v["duration_s"] > args.long_s:
            flags.append("very_long")
        v["review_flags"] = ";".join(flags)
    return visits, fps, n_frames


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video")
    ap.add_argument("--session", help="defaults to video file stem")
    ap.add_argument("--roi-key", help="defaults to segment = first token of stem")
    ap.add_argument("--video-dir")
    ap.add_argument("--rois", required=True)
    ap.add_argument("--out", default="out")
    ap.add_argument("--model", default="yolo26x.pt")
    ap.add_argument("--tracker", default=str(HERE / "botsort_reid.yaml"))
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--stride", type=int, default=1, help="process every Nth frame")
    ap.add_argument("--device", default=None, help="0 for GPU, cpu, mps")
    ap.add_argument("--lost-s", type=float, default=3.0, help="censor after N s unseen in ROI")
    ap.add_argument("--reentry-gap", type=float, default=1.0)
    ap.add_argument("--min-s", type=float, default=2.0)
    ap.add_argument("--long-s", type=float, default=600.0)
    a = ap.parse_args()

    rois = json.loads(Path(a.rois).read_text())
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    vids = [Path(a.video)] if a.video else sorted(
        p for p in Path(a.video_dir).iterdir() if p.suffix.lower() in {".mp4", ".mov"})
    for v in vids:
        dest = out / f"{v.stem}.csv"
        if dest.exists():
            print("skip (done)", v.name)
            continue
        session = a.session if a.video and a.session else v.stem
        key = a.roi_key if a.video and a.roi_key else v.stem.split("_")[0]
        if key not in rois:
            print(f"!! no ROI for '{key}', skipping {v.name}")
            continue
        poly = np.array(rois[key]["polygon"], dtype=np.int32)
        visits, fps, nf = process(v, session, poly, a)
        with dest.open("w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=["session", "track_id", "entry_s", "exit_s",
                                               "duration_s", "departure_status", "review_flags"])
            w.writeheader()
            w.writerows(visits)
        n_flag = sum(bool(x["review_flags"]) for x in visits)
        print(f"{v.name}: {len(visits)} visits, {n_flag} flagged for review ({nf/fps/60:.1f} min @ {fps:.0f} fps)")


if __name__ == "__main__":
    main()
