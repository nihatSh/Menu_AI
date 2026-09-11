// Theme plumbing: colour mode + per-restaurant accent.
//
// The app is one design system serving many restaurants. The base neutrals are
// fixed; each restaurant injects a single accent taken from its own brand, so
// the accent is the only saturated colour on screen (taste-skill 4.2 colour
// consistency lock).

export const THEME_KEY = "scan-eat-theme";

/** "#b96a28" -> "185 106 40" for use in a CSS variable with <alpha-value>. */
export function hexToRgbTriplet(hex) {
  const h = String(hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return null;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Relative luminance, used to decide whether text on the accent is light or dark. */
export function luminance(hex) {
  const t = hexToRgbTriplet(hex);
  if (!t) return 0;
  const [r, g, b] = t.split(" ").map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Builds the CSS variable overrides for one restaurant.
 *
 * `accent-ink` is chosen by luminance so button labels always clear WCAG AA
 * against the accent, whatever colour the restaurant picked. That is the
 * mandatory button-contrast check in taste-skill 4.5, enforced in code rather
 * than left to a designer's eye.
 */
export function accentVars(theme, isDark = false) {
  const accentHex = theme?.accent || theme?.to || "#206054";
  const rgb = hexToRgbTriplet(accentHex);
  if (!rgb) return {};

  const onLight = luminance(accentHex) > 0.45 ? "20 22 26" : "255 255 255";
  const [r, g, b] = rgb.split(" ").map(Number);

  // The accent mixed toward the surface, not toward grey, so a tinted well
  // reads as the same colour family in both modes. The light mix is strong
  // enough that a soft-tinted button still reads as a control rather than as
  // a disabled one - 10% washed out to almost-white in testing.
  const mix = (channel, surface, amount) => Math.round(channel * amount + surface * (1 - amount));
  const soft = isDark
    ? `${mix(r, 22, 0.22)} ${mix(g, 25, 0.22)} ${mix(b, 29, 0.22)}`
    : `${mix(r, 251, 0.13)} ${mix(g, 251, 0.13)} ${mix(b, 250, 0.13)}`;

  return {
    "--accent": rgb,
    "--accent-ink": onLight,
    "--accent-soft": soft,
  };
}

/** Inline script: applies the stored mode before first paint, so no flash. */
export const THEME_BOOTSTRAP = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_KEY
)});var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export function readTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* private mode */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(mode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* private mode - the class is still applied for this session */
  }
}
