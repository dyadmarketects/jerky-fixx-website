# Jerky Fixx Website (Version 2 mockup)

Scroll-driven 3D website mockup for **Jerky Fixx**, Albuquerque's small batch carne seca dealer. Built by DYAD Marketects.

## Live site

https://jerkyfixx.com (GitHub Pages, custom domain via Cloudflare DNS)

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

1. **Hero:** jerky rises, ingredients erupt and orbit on load; scrolling widens the orbit until the lime breaks the tape and fills the screen
2. **FIXX Fiend Favs (top sellers):** turntable carousel with arrows, tabs, swipe and autoplay, size toggle and add to cart
3. **Award winning jerky:** pink bull trophy (Most Exotic Flavor, Best Booth)
4. **Full menu:** 25 flavor icons with heat filters; tap one for the big detail card and add to cart
5. **The legend:** looping roadrunner clip that reveals the logo behind it
6. **The Fixx Family:** big family photo plus an auto-scrolling, swipeable photo carousel
7. **In the Lab:** Jerky Fixx batch video
8. **Dealer locator:** Google Map + Jerky Fest (Oct 31, 2026, Isleta Resort & Casino) + dealer alert signup
9. **FIXX Fiends VIP Club:** coming soon waitlist
10. **Follow the fixx:** Hot Cheeto promo video + social links + review link
11. **FAQ** and **Contact** (order or question form)
12. Cart drawer with checkout, cookie consent banner, how-to hints, social side tab

## Forms and orders

All forms (checkout, contact, VIP, dealer alerts) post to a Google Apps Script web app that emails jerkyfixx@gmail.com and dyadmarketects@gmail.com and logs every submission in a shared Google Sheet. Setup: `backend/SETUP.md`, then paste the web app URL into `FORM_ENDPOINT` near the top of the main `<script>` in `index.html`. Until then, forms open a pre-filled email to both addresses.

## Updating content (safe edits)

- Flavors, descriptions, heat levels: `FLAVORS` array in `index.html`
- Top sellers: `TOPN` (names) and `TOPM` (3D ingredients) arrays
- Next event: the `#dealer` section markup and the `icsBtn` calendar code
- FAQ: the `#faq` section

## Before launch

- [ ] Deploy the form backend (`backend/SETUP.md`) and paste the URL into `FORM_ENDPOINT`
- [ ] Font license: `fonts/zuume.woff2` is a personal-use demo of Zuume Rough; buy a commercial license or swap the face
- [ ] Have privacy.html and terms.html reviewed (they're templates), then remove the template note at the top
- [ ] Confirm heat levels and flavor descriptions in the `FLAVORS` array
- [ ] Replace `img/jerky-fixx-family-booth.webp` with a high resolution family photo and add more carousel photos
