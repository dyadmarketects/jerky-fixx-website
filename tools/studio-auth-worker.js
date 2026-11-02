/* Fixx Studio sign in: a tiny Cloudflare Worker that does the GitHub OAuth handshake for jerkyfixx.com/studio.
   It never stores tokens. Setup steps are in STUDIO-SETUP.md.
   Worker settings > Variables and secrets:
     GITHUB_CLIENT_ID      (text)    from your GitHub OAuth App
     GITHUB_CLIENT_SECRET  (secret)  from your GitHub OAuth App
     ALLOWED_ORIGIN        (text)    https://jerkyfixx.com
*/
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = env.ALLOWED_ORIGIN || "https://jerkyfixx.com";
    if (url.pathname === "/auth") {
      const state = crypto.randomUUID();
      const gh = new URL("https://github.com/login/oauth/authorize");
      gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      gh.searchParams.set("scope", "repo read:user");
      gh.searchParams.set("redirect_uri", url.origin + "/callback");
      gh.searchParams.set("state", state);
      return new Response(null, { status: 302, headers: { Location: gh.toString(), "Set-Cookie": `fixx_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600` } });
    }
    if (url.pathname === "/callback") {
      const cookie = (req.headers.get("Cookie") || "").match(/fixx_state=([^;]+)/);
      let payload;
      if (!cookie || cookie[1] !== url.searchParams.get("state")) payload = { type: "fixx-auth", error: "Sign in timed out. Try again." };
      else {
        const r = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get("code") })
        });
        const j = await r.json();
        payload = j.access_token ? { type: "fixx-auth", token: j.access_token } : { type: "fixx-auth", error: j.error_description || "GitHub didn't sign you in." };
      }
      const html = `<!doctype html><meta charset="utf-8"><title>Fixx Studio</title><body style="background:#0D0D0D;color:#FDEFFD;font:16px system-ui;display:grid;place-items:center;height:100vh">
<p>Signing you in…</p><script>(function(){var p=${JSON.stringify(payload)};if(window.opener){window.opener.postMessage(p,${JSON.stringify(origin)});window.close();}else{document.body.innerHTML="<p>"+(p.error||"Signed in. You can close this tab.")+"</p>";}})();</script>`;
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": "fixx_state=; Path=/; Max-Age=0" } });
    }
    return new Response("Fixx Studio sign in", { status: 200 });
  }
};
