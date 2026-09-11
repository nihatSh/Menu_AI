import { NextResponse } from "next/server";

const GUEST_COOKIE = "se_guest";

// Gives every device a stable anonymous ID on its first visit. Used to key
// chat history and to split the bill per person without a login.
export function middleware(req) {
  if (req.cookies.get(GUEST_COOKIE)) return NextResponse.next();

  const res = NextResponse.next();
  res.cookies.set(GUEST_COOKIE, crypto.randomUUID().replace(/-/g, "").slice(0, 24), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days, matches the data-retention policy
  });
  return res;
}

export const config = {
  matcher: ["/r/:path*", "/api/:path*"],
};
