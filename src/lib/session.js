// Guest identity and signed table tokens.
//
// Guest ID: a random cookie set by middleware on first visit. It lets every
// device at a table order under its own identity (split the bill) and keys
// the server-side chat history - without any login.
//
// Table tokens: the QR code carries an HMAC of `${slug}:${table}` so nobody
// can type `?table=12` in the address bar and send food to another table. In
// development, plain `?table=N` still works so the flow is easy to test.

import { createHmac, timingSafeEqual } from "node:crypto";

export const GUEST_COOKIE = "se_guest";

export function guestIdFrom(req) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${GUEST_COOKIE}=([A-Za-z0-9_-]{8,64})`));
  return m ? m[1] : "anon";
}

function secret() {
  const s = process.env.TABLE_TOKEN_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    // Loud, because printed QR codes can't be reissued cheaply.
    console.error("TABLE_TOKEN_SECRET is not set - table tokens are using an insecure default");
  }
  return "dev-only-secret-change-me";
}

export function tableToken(slug, table) {
  const sig = createHmac("sha256", secret()).update(`${slug}:${table}`).digest("base64url").slice(0, 16);
  return `${table}.${sig}`;
}

/** Returns the table number if the token is valid, otherwise null. */
export function verifyTableToken(slug, token) {
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const table = token.slice(0, dot);
  const expected = tableToken(slug, table);
  if (expected.length !== token.length) return null;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token)) ? table : null;
  } catch {
    return null;
  }
}

export const allowPlainTableParam = () =>
  process.env.NODE_ENV !== "production" || process.env.ALLOW_PLAIN_TABLE === "1";
