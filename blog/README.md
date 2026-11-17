# Jerky Fixx blog

Static blog for https://jerkyfixx.com/blog/, built by a Python 3 standard library script. Nothing to install.

## Add a post

1. Drop a Markdown file in `blog/posts/` named `YYYY-MM-DD-slug.md`.
2. Run `python3 tools/build_blog.py` from the repo root.
3. Check the validation report at the end (it exits non-zero on any problem), then commit `blog/`, `blog.css`, `sitemap.xml` and anything else that changed.

The script is idempotent. It regenerates `blog/index.html`, `blog/<slug>/index.html`, `blog/aaliyah-penn/index.html`, `blog/feed.xml` and the blog entries in `sitemap.xml`. Existing non-blog sitemap entries are left alone. The header, footer, cookie banner and scripts are copied from `cart.html` at build time, so after changing the nav or footer in `cart.html`, re-run `python3 tools/build_pages.py` and this build.

Never edit generated HTML by hand. Edit the `.md` and rebuild.

## Front matter

```
---
title: Where to Buy Jerky in Albuquerque
slug: where-to-buy-jerky-in-albuquerque
date: 2026-10-29
updated: 2026-10-29
description: 140 to 158 characters, used as the meta description.
keywords: jerky albuquerque, where to buy jerky in albuquerque
box: Albuquerque
hero: /img/jerky-fixx-family-booth.webp
hero_alt: Describe the image for screen readers and search.
excerpt: One or two sentences for the blog index card and RSS.
---
```

| Field | Required | Notes |
| --- | --- | --- |
| title | yes | The h1. The page title is the title plus " &#124; Jerky Fixx" and must be 60 characters or less. |
| description | yes | Meta description, 140 to 158 characters. |
| slug | yes | URL becomes `/blog/<slug>/`. Match the file name. |
| date | yes | `YYYY-MM-DD`, first publish date. |
| updated | no | `YYYY-MM-DD`, used for `dateModified` and sitemap `lastmod`. Defaults to date. Bump it when you revise a post. |
| keywords | yes | Comma separated. First one is the primary keyword. |
| box | no | Text at the end of the title shown in the lime box. Defaults to the last word. |
| hero | yes | Root-absolute image path that exists in the repo. Every post needs its own hero that no other post uses, relevant to the topic (check `grep -h '^hero:' blog/posts/*.md`). Make one if needed: crop or recolor a real Jerky Fixx photo, or compose a branded graphic from /img assets with Pillow, saved as /img/blog/<slug>.webp. Never use stock photos of other brands. The builder auto-creates the 1200x630 share image. |
| hero_alt | yes | Descriptive alt text for the hero image. |
| excerpt | yes | Short summary for cards and RSS. |

## Markdown supported

`##` and `###` headings (no `#`, the title is the h1), paragraphs, `-` lists, `1.` lists, `>` quotes, `**bold**`, `*italic*` and `[links](/path/)`. Use root-absolute internal links to the dedicated pages: `/jerky/` (menu), `/our-story/`, `/the-lab/`, `/dealer-locator/`, `/vip-club/`, `/contact/`, `/faq/`, `/cart.html` and `/blog/<slug>/`. Use plain `$7` style prices only as given below.

## Writing rules

700 to 1100 words, written as Aaliyah Penn, conversational and warm, no em dashes. Do not keyword stuff, and do not invent facts.

### Facts you may use

- Jerky Fixx is a family-run, small batch beef jerky and carne seca business in Albuquerque, New Mexico. Owners: Joseph Garduno and Sabrina Penn Garduno. Their daughter Aaliyah Penn is studying web design and manages the website.
- 25 flavors, heat 0 to 5 (see `FLAVORS` in `js/shop.js`). Top sellers: X-Hot Green, Hot Cheetos, Garlic Parm, Takis, Honey Teriyaki, Mango Habanero, Hot Cheeto Pickle, Lemon Pepper.
- Small bag $7, large bag $20. Pay with Cash App, Venmo, Apple Pay or cash.
- Order on the site (`/jerky/`, `/cart.html` or `/contact/`). The crew texts to confirm, the dealer drops the order at your door and sends a photo once delivered. Text or call 505-922-5683 or 505-364-0678, email jerkyfixx@gmail.com.
- Found at pop ups, festivals and ball games around Albuquerque and Rio Rancho. Won Most Exotic Flavor and Best Booth at New Mexico Jerky Fest.
- Past event: New Mexico Jerky Fest, Halloween Edition, Oct 31, 2026 at Isleta Resort and Casino. No upcoming events are announced yet; say "Stay tuned for upcoming events" and point to socials and event alerts. Never invent event dates.
- FIXX Fiends VIP Club (jerky subscription) is coming soon, waitlist at `/#vip`.
- Socials: instagram.com/jerky_fixx, facebook.com/jerky.fixx, threads.com/@jerky_fixx.

## Topic backlog

`blog/topics.md` has 30 future ideas. Pick the first `[todo]`, write the post, then mark it `[done]` with the slug.

## Weekly job

```
cd /path/to/jerky-fixx-website
# 1. write blog/posts/YYYY-MM-DD-slug.md (next unused topic in blog/topics.md)
python3 tools/build_blog.py
# 2. review, then commit and push
```

Placeholder note: the author photo is `/img/roadrunner-head.webp` until a real photo is supplied. Change `AUTHOR_IMG` in `tools/build_blog.py`.


Also keep /llms.txt (brand facts for AI answer engines) accurate if facts change; add new posts to its Pages list.


## Hero image rules

- The hero must show the post's actual subject (a grandma post shows a grandma, a road trip post shows a road trip, a gift post shows gifts). No generic flavor grids.
- Vary the format from post to post: real Jerky Fixx photos (`/img/family/`, booth and event shots), lifestyle scenes, close up product shots, illustrated graphics. Never reuse the layout of the previous two heroes (check the last two files in `img/blog/`).
- The only logo on any hero or merch is `/img/logo-stack.webp` (the site header logo). Do not use `logo-lockup.webp`.
- AI generated lifestyle images are fine as illustrations, but never caption or describe them as real customers, reviews or events.
- Make heroes with Canva (`generate-image`, 16:9). Aim for engaging, creative, scroll-stopping scenes tied to the topic: people enjoying jerky in a relevant setting, playful product moments, bold illustrated concepts. Mix photo style, illustration and graphic design across posts.
- When the scene includes merch or packaging, first import the real logo with `upload-asset-from-url` from `https://jerkyfixx.com/img/logo-stack.webp` and pass it in `imageReferences`. Zoom in and check the logo; fix stray marks or warped lettering before publishing (regenerate, or clean up with Pillow/OpenCV).
- Every hero must include Jerky Fixx branding (the logo on a shirt, bag, sign or similar). Download the full size Canva image, crop to 1200x675, save as `/img/blog/<slug>.webp` and publish it with the post automatically, no approval step. Only if the full size image can't be downloaded, publish a branded hero composed from real Jerky Fixx photos in `/img/` plus `/img/logo-stack.webp` (never a flavor circle grid) and mention it in the run report.

## Media in posts

- Inline photo: `![alt text](/img/blog/file.webp) | optional caption`
- Vertical video: `@video(/vid/blog/file.mp4, /vid/blog/poster.jpg) caption`
