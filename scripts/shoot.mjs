#!/usr/bin/env node
// Screenshots the app at a real phone viewport using the DevTools Protocol.
//
// Chrome's --window-size does not set the *layout* viewport in headless mode,
// so --screenshot at 390px just crops an 800px render. Emulation.setDeviceMetricsOverride
// is the only way to get a truthful mobile screenshot.
//
//   node scripts/shoot.mjs <name> <url> [--dark] [--w=390] [--h=844] [--full]
//   node scripts/shoot.mjs --batch shots.json

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = process.env.SHOT_DIR || "shots";
const PORT = 9222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--force-color-profile=srgb",
      "--hide-scrollbars",
      "--user-data-dir=" + path.join(process.env.TEMP || "/tmp", "shoot-profile"),
      "about:blank",
    ],
    { stdio: "ignore", detached: false }
  );

  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
  }
  throw new Error("Chrome did not start");
}

/** Minimal CDP client over the built-in WebSocket. */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function connect() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return { cdp: new CDP(ws), targetId: target.id };
}

async function shoot(cdp, { name, url, width = 390, height = 844, dark = false, full = false, wait = 2600, click, actions }) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: width,
    screenHeight: height,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }],
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await cdp.send("Page.navigate", { url });
  await sleep(wait);

  // The theme is stored per-origin; clear it so prefers-color-scheme decides.
  await cdp.send("Runtime.evaluate", {
    expression: `try{localStorage.removeItem('scan-eat-theme')}catch(e){}`,
  });

  // A flow is a list of steps, so a screenshot can capture a state that only
  // exists after real interaction (basket filled, detail sheet open) rather
  // than only first paint.
  const steps = actions || (click ? [{ click }] : []);
  for (const step of steps) {
    if (step.wait) {
      await sleep(step.wait);
      continue;
    }
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: `(function(){
        const sel = ${JSON.stringify(step.selector || "button,[role=button],a")};
        const text = ${JSON.stringify(step.click || "")};
        const nth = ${Number(step.nth || 0)};
        let els = [...document.querySelectorAll(sel)];
        if (text) els = els.filter(e => (e.getAttribute('aria-label') || e.textContent || '').trim().toLowerCase().includes(text.toLowerCase()));
        const el = els[nth];
        if (el) { el.click(); return 'clicked: ' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0,40); }
        return 'NOT FOUND: ' + text;
      })()`,
      returnByValue: true,
    });
    if (String(result.value).startsWith("NOT FOUND")) console.log(`    ! ${name}: ${result.value}`);
    await sleep(step.settle || 800);
  }

  // Report anything wider than the viewport - the check that matters on a phone.
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `(function(){
      const vw = document.documentElement.clientWidth;
      const over = [];
      // An element inside a deliberately scrollable rail (the category strip)
      // is allowed to sit outside the viewport - that is what the rail is for.
      const inScroller = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === 'auto' || ov === 'scroll') return true;
        }
        return false;
      };
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
          over.push((el.tagName.toLowerCase()) + '.' + (el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0,3).join('.') : '') + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
        }
      }
      return JSON.stringify({ vw, scrollW: document.documentElement.scrollWidth, over: over.slice(0, 6) });
    })()`,
    returnByValue: true,
  });
  const diag = JSON.parse(result.value);

  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: full,
    ...(full
      ? {}
      : {}),
  });
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(shot.data, "base64"));

  const bad = diag.scrollW > diag.vw + 1 || diag.over.length > 0;
  console.log(
    `${bad ? "✗" : "✓"} ${name.padEnd(22)} ${diag.vw}px viewport, scrollWidth ${diag.scrollW}` +
      (diag.over.length ? `\n    overflowing: ${diag.over.join("\n                 ")}` : "")
  );
  return !bad;
}

const args = process.argv.slice(2);
const chrome = await launch();
let ok = true;
try {
  const { cdp } = await connect();
  if (args[0] === "--batch") {
    const jobs = JSON.parse(readFileSync(args[1], "utf8"));
    for (const job of jobs) ok = (await shoot(cdp, job)) && ok;
  } else {
    const [name, url] = args;
    const flag = (k, d) => {
      const a = args.find((x) => x.startsWith(`--${k}=`));
      return a ? Number(a.split("=")[1]) : d;
    };
    ok = await shoot(cdp, {
      name,
      url,
      dark: args.includes("--dark"),
      full: args.includes("--full"),
      width: flag("w", 390),
      height: flag("h", 844),
    });
  }
} finally {
  chrome.kill();
}
process.exit(ok ? 0 : 1);
