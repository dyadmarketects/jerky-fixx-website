# Fixx Studio: how to make changes to jerkyfixx.com

You are working on a request from **Aaliyah Penn**, who runs the Jerky Fixx website. She writes in plain English from Fixx Studio (jerkyfixx.com/studio). Vince King (DYAD Marketects) reviews every change before it goes live, so be bold and do what she asked. Make her idea look like it was always part of the site.

## The request
- The request is a Markdown file in `studio-requests/`. Do exactly what it says, in the site's style.
- Files she attached are listed in the request and live in `uploads/<request-id>/` on this branch.
- If something is unclear, pick the most reasonable reading and say what you chose in your summary.

## Where things live (never hand-edit generated files)
| What | Edit this | Then run |
|---|---|---|
| Flavors, heat (0 to 5), descriptions, bag prices, catalog photo paths | `data/flavors.json` | `python3 tools/sync_flavors.py` |
| Catalog photo for a flavor | replace `img/flavors/<flavor-slug>.webp` (600x600 webp) | nothing |
| Interior pages (jerky, our story, the lab, dealer locator, VIP, contact, FAQ, legal) | `tools/pages/<name>.html` | `python3 tools/build_pages.py` |
| A new page | new `tools/pages/<slug>.html`, copy the header format of `tools/pages/our-story.html`, set `"path": "/<slug>/"` | `python3 tools/build_pages.py` |
| Nav, mobile menu, footer links | `cart.html` (the builder copies it everywhere) | `python3 tools/build_pages.py` then `python3 tools/build_blog.py` |
| Home page | `index.html` (careful: 3D scene and scroll code live there) | `python3 tools/build_pages.py` |
| Blog posts | `blog/posts/YYYY-MM-DD-slug.md`, see `blog/README.md` | `python3 tools/build_blog.py` |
| Styles | `css/site.css` (append new rules at the end) | nothing |
| Photos dropped in `img/uploads/` or `img/flavors/` as jpg/png | leave them | `python3 tools/optimize_media.py` (turns them into webp) |

Always finish by running, in order: `python3 tools/sync_flavors.py`, `python3 tools/build_pages.py`, `python3 tools/build_blog.py`. They must print "All checks passed."

## Media she uploads
- Photos: convert to `.webp`, max 2000px on the long side, quality about 82, with Pillow. Put site photos in `img/uploads/`, flavor photos in `img/flavors/<flavor-slug>.webp` (600x600, centered crop).
- Videos: keep `.mp4` (H.264). If ffmpeg is available, shrink to 720px wide with `-crf 27 -movflags +faststart` and make a poster jpg. Put them in `vid/uploads/`.
- Every image needs real, descriptive alt text. Delete the original from `uploads/` once you've placed the optimized copy.

## Look and feel (match what's already there)
- Colors: `--bp-light #F088F2`, `--bp-pink #E15CF2`, `--bp-purple #9F22F2`, `--bp-deep #580AA6`, `--bp-ink #0D0D0D`, `--bp-blush #FDEFFD`, plus the site magenta. The yellow warning tape stays yellow. No yellow green anywhere else.
- Reuse the existing page blocks instead of inventing new ones: `pg-block`, `pg-split`, `pg-h2` (with an `<em>` highlight word), `pg-p`, `pg-lead`, `pg-cards`, `pg-steps`, `pg-panel`, `pg-fig`, `pg-facts`, `eyebrow ui`, buttons `btn btn-lime` / `btn btn-pink`, pills `pill pill-dark`.
- Headings are short and punchy. Interior page heroes use the `"hero"` header field (eyebrow, plain word, boxed word, meta line).
- Must work on phones first. Check that nothing overflows at 390px wide.

## Voice
Warm, conversational, a little cheeky. Contractions. No dashes of any kind in copy. First person "we" for the family, "I" when it's Aaliyah's blog.

## Hard rules
- Never invent facts: prices, awards, dates, events, ingredients, reviews or quotes must come from the request or the existing site.
- Never touch `FORM_ENDPOINT` in `js/shop.js`, the order flow, `backend/`, `.github/`, `CNAME`, or anything with keys or customer data. No online payments.
- Don't delete pages or blog posts unless the request clearly asks for it.
- Keep URLs that already exist working.

## When you're done
Write a short, friendly summary for Aaliyah and Vince to `studio-summary.md` in the repo root (it is not committed): what you changed, which pages to look at, and anything you chose or couldn't do. Bullet points, plain English.
