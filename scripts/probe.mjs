#!/usr/bin/env node
// Evaluates an expression in the page and prints the result. Used to check
// computed styles and contrast ratios rather than guessing from a screenshot.
//
//   node scripts/probe.mjs <url> "<js expression returning a value>"

import { spawn } from "node:child_process";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=" + path.join(process.env.TEMP || "/tmp", "probe-profile"),
    "about:blank",
  ],
  { stdio: "ignore" }
);

try {
  let version;
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) {
        version = await r.json();
        break;
      }
    } catch {}
  }
  if (!version) throw new Error("Chrome did not start");

  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
  });
  const send = (method, params = {}) => {
    const i = ++id;
    ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((resolve, reject) => pending.set(i, { resolve, reject }));
  };

  const [url, expr] = process.argv.slice(2);
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url });
  await sleep(3000);

  const { result, exceptionDetails } = await send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    console.error("error:", exceptionDetails.text, exceptionDetails.exception?.description || "");
    process.exitCode = 1;
  } else {
    console.log(typeof result.value === "string" ? result.value : JSON.stringify(result.value, null, 1));
  }
} finally {
  child.kill();
}
