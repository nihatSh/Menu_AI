/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  darkMode: "class", // set on <html> by ThemeScript, seeded from prefers-color-scheme
  theme: {
    extend: {
      colors: {
        // Every surface colour is a CSS variable so one token set drives both
        // themes. Values live in globals.css.
        //
        // The base is deliberately COOL-neutral. The previous palette was the
        // warm cream + brass + espresso family that taste-skill bans as the
        // default reach for hospitality briefs - see DESIGN_AUDIT.md.
        paper: "rgb(var(--paper) / <alpha-value>)", // page background
        raised: "rgb(var(--raised) / <alpha-value>)", // cards, sheets
        sunken: "rgb(var(--sunken) / <alpha-value>)", // wells, inputs
        ink: "rgb(var(--ink) / <alpha-value>)", // primary text
        muted: "rgb(var(--muted) / <alpha-value>)", // secondary text
        faint: "rgb(var(--faint) / <alpha-value>)", // tertiary text
        line: "rgb(var(--line) / <alpha-value>)", // hairlines

        // The single saturated colour on the page. Injected per restaurant
        // from restaurant.theme.accent, so one system serves every tenant.
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-ink": "rgb(var(--accent-ink) / <alpha-value>)", // text ON accent
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)", // tinted well

        // Semantic, used only where they carry real meaning.
        warn: "rgb(var(--warn) / <alpha-value>)",
        "warn-soft": "rgb(var(--warn-soft) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        "danger-soft": "rgb(var(--danger-soft) / <alpha-value>)",
        good: "rgb(var(--good) / <alpha-value>)",
        "good-soft": "rgb(var(--good-soft) / <alpha-value>)",
      },

      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },

      // One documented shape scale, applied consistently (taste-skill 4.4).
      borderRadius: {
        chip: "4px", // badges, tags
        control: "10px", // buttons, inputs, segmented controls
        card: "16px", // dish cards, panels
        sheet: "28px", // bottom sheets
      },

      fontSize: {
        // Display sizes carry negative tracking; small labels carry positive.
        display: ["1.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        title: ["1.125rem", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "600" }],
        label: ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.06em", fontWeight: "600" }],
      },

      boxShadow: {
        // Tinted to the surface hue, never pure black (taste-skill 4.4).
        card: "0 1px 2px rgb(var(--shadow) / 0.04), 0 2px 8px rgb(var(--shadow) / 0.04)",
        lift: "0 2px 4px rgb(var(--shadow) / 0.06), 0 12px 28px rgb(var(--shadow) / 0.10)",
        sheet: "0 -8px 40px rgb(var(--shadow) / 0.16)",
        bar: "0 -1px 0 rgb(var(--line) / 1), 0 -12px 32px rgb(var(--shadow) / 0.08)",
      },

      transitionTimingFunction: {
        // One easing curve for the whole app.
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },

      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        caret: {
          "0%, 45%": { opacity: "1" },
          "50%, 95%": { opacity: "0.15" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },

      animation: {
        "rise-in": "rise-in .42s cubic-bezier(0.16,1,0.3,1) both",
        "sheet-up": "sheet-up .34s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in .2s ease-out both",
        caret: "caret 1.1s steps(1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },

      zIndex: {
        // Documented scale instead of arbitrary z-50 (taste-skill 6.F).
        bar: "30",
        nav: "40",
        overlay: "50",
        sheet: "60",
        toast: "70",
      },
    },
  },
  plugins: [],
};
