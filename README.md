# Jerky Fixx Website (Version 2 mockup)

Scroll-driven 3D website mockup for **Jerky Fixx**, Albuquerque's small batch carne seca dealer. Built by DYAD Marketects.

## What's here

| Path | Contents |
| --- | --- |
| `index.html` | The whole site: markup, styles and scripts in one file |
| `models/` | 13 web-optimized 3D models (`.glb`, meshopt compressed, about 9 MB total) |
| `img/` | Logo, icons, backgrounds and photos (WebP) |
| `fonts/` | Zuume Rough, Fibre and Macabro, subset to WOFF2 |
| `vid/` | "In the Lab" clip and poster |

Libraries load from CDNs, so there's no build step: Three.js 0.169 (jsDelivr), GSAP 3.12.5 + ScrollTrigger (cdnjs) and Lenis 1.1.13 (jsDelivr).

## Run it locally

The models load with `fetch`, so open the site through a local server rather than double-clicking the file:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Page sections

0. **Loading screen:** live percentage from the model downloads, warning tape progress bar, then a lime curtain wipe
1. **Hero:** the jerky rises with a 360° twist, ingredients erupt and orbit its vertical axis, then the lime breaks the warning tape and fills the screen
2. **Top sellers:** 8 flavors on a spinning New Mexico Zia platter with a heat gauge
3. **Award:** the New Mexico Jerky Fest trophy (Most Exotic Flavor, Best Booth)
4. **Full menu:** all 25 flavors with heat filters, $7 small or $20 large
5. **The Fixx Family**
6. **In the Lab:** the carne seca process video with synced steps
7. **Dealer Locator:** map plus pop-up schedule (softball games)
8. **Reviews**
9. **Contact form**

## Before launch

- [ ] **Font license:** `fonts/zuume.woff2` comes from a personal-use demo of Zuume Rough. It's subset to the clean glyphs, but it needs a commercial license or a replacement face.
- [ ] **Lab video:** `vid/lab.mp4` is sample footage from another jerky brand. Replace it with Jerky Fixx's own process video.
- [ ] **Reviews:** the five reviews are placeholder copy. Swap in real Google or Facebook reviews.
- [ ] **Dealer Locator:** the dates and fields are samples. Sync them to the real softball schedule (the `EVENTS` and `SPOTS` arrays in `index.html`).
- [ ] **Top sellers and heat levels:** confirm them with the client (the `TOP` and `MENU` arrays).
- [ ] **Contact form:** it currently only validates on the page. Connect it to a form service or backend.
- [ ] **Register / Login / Cart:** these are placeholder links.
