#!/usr/bin/env python3
"""Turns photos dropped in by Fixx Studio into web ready .webp files (needs Pillow).
  img/flavors/<slug>.jpg|jpeg|png  -> img/flavors/<slug>.webp  600x600 centered crop (catalog photo)
  img/uploads/<name>.jpg|jpeg|png  -> img/uploads/<name>.webp  max 2000px on the long side
The original is deleted after conversion. Safe to run any number of times."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    from PIL import Image, ImageOps
except ImportError:
    print("optimize_media: Pillow not installed, skipped"); sys.exit(0)
SRC = (".jpg", ".jpeg", ".png")
done = 0
def convert(path, square):
    global done
    im = ImageOps.exif_transpose(Image.open(path))
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") and not square else "RGB")
    if square:
        im = ImageOps.fit(im, (600, 600), Image.LANCZOS, centering=(0.5, 0.45))
    else:
        im.thumbnail((2000, 2000), Image.LANCZOS)
    out = os.path.splitext(path)[0] + ".webp"
    im.save(out, "WEBP", quality=82, method=6)
    os.remove(path); done += 1
    print("optimized", os.path.relpath(out, ROOT))
for folder, square in (("img/flavors", True), ("img/uploads", False)):
    d = os.path.join(ROOT, folder)
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.lower().endswith(SRC):
                convert(os.path.join(d, f), square)
print("optimize_media: %d file(s)" % done)
