"use client";

// The guest profile lives in the browser, not on our server.
//
// This is what makes "remember me everywhere" work: one profile, shared across
// every restaurant on the platform, so the second QR a guest scans already
// knows their allergies. It also carries the day's calorie and protein running
// total, which is the cross-visit goal tracking.

const KEY = "scan-eat-profile";

export const EMPTY_PROFILE = {
  name: "",
  lang: "en",
  allergens: [],
  diets: [],
  fasting: "none", // none | ramadan | lent
  kidsMode: false,
  // fitness
  weightKg: "",
  kcalTarget: "",
  proteinTarget: "",
  // running totals, reset each calendar day
  day: "",
  kcalEaten: 0,
  proteinEaten: 0,
  // cross-restaurant history
  favourites: [], // dish ids the guest rated up
  visited: [], // restaurant slugs
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function loadProfile() {
  if (typeof window === "undefined") return { ...EMPTY_PROFILE, day: today() };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_PROFILE, day: today() };
    const parsed = { ...EMPTY_PROFILE, ...JSON.parse(raw) };
    // A new day wipes the running totals but keeps the targets and allergies.
    if (parsed.day !== today()) {
      parsed.day = today();
      parsed.kcalEaten = 0;
      parsed.proteinEaten = 0;
    }
    return parsed;
  } catch {
    return { ...EMPTY_PROFILE, day: today() };
  }
}

export function saveProfile(profile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...profile, day: profile.day || today() }));
  } catch {
    /* private browsing, quota - the app still works, it just forgets */
  }
}

export function addEatenToProfile(profile, { kcal, protein }) {
  return {
    ...profile,
    day: today(),
    kcalEaten: Math.round((Number(profile.kcalEaten) || 0) + kcal),
    proteinEaten: Math.round((Number(profile.proteinEaten) || 0) + protein),
  };
}

export function rememberFavourite(profile, dishId) {
  if (profile.favourites.includes(dishId)) return profile;
  return { ...profile, favourites: [...profile.favourites, dishId].slice(-30) };
}

/** The heart on a dish card - has to turn off again, unlike rememberFavourite. */
export function toggleFavourite(profile, dishId) {
  const on = profile.favourites.includes(dishId);
  return {
    ...profile,
    favourites: on
      ? profile.favourites.filter((id) => id !== dishId)
      : [...profile.favourites, dishId].slice(-30),
  };
}

export function rememberVisit(profile, slug) {
  if (profile.visited.includes(slug)) return profile;
  return { ...profile, visited: [...profile.visited, slug] };
}

export function hasGoals(profile) {
  return Boolean(Number(profile.kcalTarget) || Number(profile.proteinTarget));
}
