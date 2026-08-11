export const dynamic = "force-dynamic";

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Career Ops Browser Handoff Test</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 16px system-ui, sans-serif; color: #191713; background: #f5f0e8; }
    main { width: min(620px, calc(100vw - 40px)); padding: 34px; border: 1px solid #d7cec0; border-radius: 20px; background: white; box-shadow: 0 20px 60px #4b3a2318; }
    h1 { margin: 0 0 8px; font: 34px Georgia, serif; }
    p { color: #6d655a; line-height: 1.5; }
    label { display: grid; gap: 7px; margin: 18px 0; font-weight: 650; }
    input, textarea { width: 100%; border: 1px solid #cfc5b6; border-radius: 10px; padding: 12px; font: inherit; }
    textarea { min-height: 110px; resize: vertical; }
    button { border: 0; border-radius: 999px; padding: 11px 18px; color: white; background: #d85b31; font-weight: 700; cursor: pointer; }
    .pill { display: inline-block; border-radius: 999px; padding: 5px 9px; color: #9a431f; background: #fff0e9; font-size: 12px; font-weight: 700; }
    #application, #complete { display: none; }
  </style>
</head>
<body>
  <main>
    <span class="pill">Local test fixture</span>
    <section id="login">
      <h1>Sign in handoff</h1>
      <p>This fake login verifies that browser control can move from the agent to you without putting credentials in chat.</p>
      <label>Email <input id="login-email" type="email" autocomplete="username" /></label>
      <label>Password <input id="login-password" type="password" autocomplete="current-password" /></label>
      <button id="sign-in" type="button">Sign in</button>
    </section>
    <form id="application">
      <h1>Application form</h1>
      <p>The agent may fill these fields. Only you can press the final submit button.</p>
      <label>Full name <input name="full-name" autocomplete="name" required /></label>
      <label>Email <input name="email" type="email" autocomplete="email" required /></label>
      <label>Why this role? <textarea name="why-role" required></textarea></label>
      <label><span><input name="confirm" type="checkbox" required style="width:auto" /> I confirm these answers are accurate</span></label>
      <button type="submit">Submit application</button>
    </form>
    <section id="complete"><h1>Submitted by the user</h1><p>The handoff test completed successfully.</p></section>
  </main>
  <script>
    document.getElementById('sign-in').addEventListener('click', () => {
      document.getElementById('login').style.display = 'none';
      document.getElementById('application').style.display = 'block';
    });
    document.getElementById('application').addEventListener('submit', (event) => {
      event.preventDefault();
      document.getElementById('application').style.display = 'none';
      document.getElementById('complete').style.display = 'block';
      document.title = 'Handoff Test Complete';
    });
  </script>
</body>
</html>`;

export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.CAREER_OPS_BROWSER_TEST !== "1") {
    return new Response("Not found", { status: 404 });
  }
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
