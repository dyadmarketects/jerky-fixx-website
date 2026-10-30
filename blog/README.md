# Jerky Fixx blog

Static blog for https://jerkyfixx.com/blog/, built by a Python 3 standard library script. Nothing to install.

## Add a post

1. Drop a Markdown file in `blog/posts/` named `YYYY-MM-DD-slug.md`.
2. Run `python3 tools/build_blog.py` from the repo root.
3. Check the validation report at the end (it exits non-zero on any problem), then commit `blog/`, `blog.css`, `sitemap.xml` and anything else that changed.

The script is idempotent. It regenerates `blog/index.html`, `blog/<slug>/index.html`, `blog/aaliyah-garduno/index.html`, `blog/feed.xml` and the blog entries in `sitemap.xml`. Existing non-blog sitemap entries are left alone. The header, footer, cookie banner and scripts are copied from `cart.html` at build time, so after changing the nav or footer in `cart.html`, re-run the build (and the legal page build).

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
| hero | no | Root-absolute image path that exists in the repo. Defaults to the family booth photo. |
| hero_alt | yes | Descriptive alt text for the hero image. |
| excerpt | yes | Short summary for cards and RSS. |

## Markdown supported

`##` and `###` headings (no `#`, the title is the h1), paragraphs, `-` lists, `1.` lists, `>` quotes, `**bold**`, `*italic*` and `[links](/path/)`. Use root-absolute internal links such as `/#menu`, `/#dealer`, `/cart.html` and `/blog/<slug>/`. Use plain `$7` style prices only as given below.

## Writing rules

700 to 1100 words, written as Aaliyah Garduno, conversational and warm, no em dashes. Do not keyword stuff, and do not invent facts.

### Facts you may use

- Jerky Fixx is a family-run, small batch beef jerky and carne seca business in Albuquerque, New Mexico. Owners: Joseph Garduno and Sabrina Penn Garduno. Their daughter Aaliyah Garduno is studying web design and manages the website.
- 25 flavors, heat 0 to 5 (see `FLAVORS` in `js/shop.js`). Top sellers: X-Hot Green, Hot Cheetos, Garlic Parm, Takis, Honey Teriyaki, Mango Habanero, Hot Cheeto Pickle, Lemon Pepper.
- Small bag $7, large bag $20. Pay with Cash App, Venmo, Apple Pay or cash.
- Order on the site (`/cart.html` or `/#contact`). The crew texts to confirm, the dealer drops the order at your door and sends a photo once delivered. Text or call 505-922-5683 or 505-364-0678, email jerkyfixx@gmail.com.
- Found at pop ups, festivals and ball games around Albuquerque and Rio Rancho. Won Most Exotic Flavor and Best Booth at New Mexico Jerky Fest.
- Next stop: New Mexico Jerky Fest, Halloween Edition, Saturday October 31, 2026 at Isleta Resort & Casino.
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
