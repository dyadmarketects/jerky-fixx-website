# Fixx Studio setup (one time, about 20 minutes)

Fixx Studio lives at **https://jerkyfixx.com/studio/** (not linked anywhere, hidden from Google).
Aaliyah asks for changes in plain English or uses the editors. Each change becomes a pull request on a `studio/...` branch,
Claude builds it on her Claude plan, Cloudflare makes a private preview link, and Vince gets an email to review.
Vince approves everything, picks only some files, edits text, asks Claude for tweaks, or declines, right in the studio.

## 1. Give Aaliyah access to the repo
GitHub > dyadmarketects/jerky-fixx-website > Settings > Collaborators > Add people > her GitHub username > Write.
(She makes a free account at github.com first.)

## 2. Her Claude, her bill
Pick ONE, both are hers, never yours:
- **Claude Pro or Max plan:** she installs Claude Code on her computer, runs `claude setup-token`, and sends you the token privately.
  Add it at Settings > Secrets and variables > Actions > New repository secret, name `CLAUDE_CODE_OAUTH_TOKEN`.
- **Pay as you go:** she makes a key at platform.claude.com with her own credits. Secret name `ANTHROPIC_API_KEY`.
If both exist, delete the one you don't want. Swapping plans later is just replacing the secret.

## 3. Sign in with GitHub (Cloudflare Worker)
1. GitHub > Settings > Developer settings > OAuth Apps > New OAuth App
   - Name: Fixx Studio. Homepage: https://jerkyfixx.com/studio/
   - Callback URL: https://studio-auth.jerkyfixx.com/callback
   - Copy the Client ID, then Generate a new client secret and copy it.
2. Cloudflare dashboard > Workers & Pages > Create > Worker > name it `jerky-fixx-studio-auth` > Deploy > Edit code.
   Paste everything from `tools/studio-auth-worker.js`, Deploy.
3. Worker > Settings > Variables and secrets: `GITHUB_CLIENT_ID` (text), `GITHUB_CLIENT_SECRET` (secret), `ALLOWED_ORIGIN` = `https://jerkyfixx.com`.
4. Worker > Settings > Domains & Routes > Add > Custom domain > `studio-auth.jerkyfixx.com`.

Until this is done you can still sign in with "Use an access token instead" (a fine grained GitHub token with Contents, Pull requests and Issues read/write on this repo).

## 4. Preview links (Cloudflare Pages)
Cloudflare > Workers & Pages > Create > Pages > Connect to Git > pick `jerky-fixx-website`.
Project name `jerky-fixx`, production branch `main`, framework None, build command empty, output directory `/`.
Under Settings > Builds & deployments, keep preview deployments on for all non production branches.
Every `studio/...` branch then gets https://<branch>.jerky-fixx.pages.dev. The live site stays on GitHub Pages.
Heads up: forms on a preview are real, so don't submit test orders there.

## 5. Emails
GitHub emails you when you're asked to review and when there are new comments. Make sure
github.com/settings/notifications > Email is on for "Pull request reviews" and "Participating".

## How it works under the hood
- `.github/workflows/studio.yml` runs Claude (via `anthropics/claude-code-action`) when a branch adds a file in `studio-requests/`,
  or when someone with write access comments `@claude ...` on the pull request. Then it rebuilds the site and posts the preview link.
- `STUDIO.md` tells Claude the house rules (style, voice, never invent facts, never touch the order form backend).
- `data/flavors.json` is the one place for flavors and prices. `tools/sync_flavors.py` writes it into the menu, cart and order form.
- Admins are listed in `CFG.admins` at the top of `studio/app.js`.
