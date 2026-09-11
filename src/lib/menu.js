// Menu filtering and the offline recommender.
//
// Two jobs live here:
//  1. hardFilter() - safety rules. Allergies, diet and fasting are NEVER
//     suggestions; a dish that fails these can't reach the guest at all, and
//     the AI is only ever shown the filtered list.
//  2. scoreDishes() - the fallback recommender used when no GEMINI_API_KEY
//     is set, so the whole product can be demoed offline.

export const HUNGER_LABELS = [
  "Just a snack",
  "Light",
  "Normal",
  "Hungry",
  "Very hungry",
];

// Rough kcal a guest is aiming at, by hunger level 1..5.
export const HUNGER_KCAL = { 1: 250, 2: 420, 3: 650, 4: 900, 5: 1200 };

export function localized(field, lang) {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field[lang] || field.en || Object.values(field)[0] || "";
}

/**
 * Removes every dish the guest must not be offered.
 * Returns { safe, removed } so the UI can honestly say what was hidden.
 */
export function hardFilter(menu, profile = {}, soldOut = []) {
  const allergens = profile.allergens || [];
  const diets = profile.diets || [];
  const removed = [];

  const safe = menu.filter((d) => {
    if (soldOut.includes(d.id) || d.available === false) {
      removed.push({ id: d.id, why: "sold out" });
      return false;
    }
    const clash = (d.allergens || []).find((a) => allergens.includes(a));
    if (clash) {
      removed.push({ id: d.id, why: `contains ${clash}` });
      return false;
    }
    for (const diet of diets) {
      if (!(d.diet || []).includes(diet)) {
        removed.push({ id: d.id, why: `not ${diet}` });
        return false;
      }
    }
    // Lent: no meat, no dairy, no eggs - vegan only.
    if (profile.fasting === "lent" && !(d.diet || []).includes("vegan")) {
      removed.push({ id: d.id, why: "not vegan (Lent)" });
      return false;
    }
    if (profile.kidsMode && (!d.kidFriendly || (d.spice || 0) > 0)) {
      removed.push({ id: d.id, why: "not suitable for children" });
      return false;
    }
    return true;
  });

  return { safe, removed };
}

const MOOD_TAGS = [
  { words: ["tired", "yorgun", "sleepy", "exhaust", "устал"], tags: ["comfort", "warm", "hearty"] },
  { words: ["sad", "bad day", "stress", "upset", "kədər"], tags: ["comfort", "sweet", "warm"] },
  { words: ["celebrat", "birthday", "happy", "bayram"], tags: ["celebration", "shareable"] },
  { words: ["light", "yüngül", "small", "not hungry", "лёгк"], tags: ["light", "fresh"] },
  { words: ["gym", "train", "workout", "idman", "protein", "трениров"], tags: ["protein", "post-workout"] },
  { words: ["hurry", "fast", "quick", "tez", "быстро"], tags: ["quick"] },
  { words: ["cold", "freez", "soyuq", "холодно"], tags: ["warm", "comfort"] },
  { words: ["hot", "isti", "жарко"], tags: ["cold", "fresh"] },
  { words: ["breakfast", "səhər", "завтрак", "morning"], tags: ["breakfast", "light"] },
  { words: ["sweet", "dessert", "şirin", "сладк"], tags: ["sweet"] },
];

function moodTags(text = "") {
  const t = text.toLowerCase();
  const tags = new Set();
  for (const m of MOOD_TAGS) {
    if (m.words.some((w) => t.includes(w))) m.tags.forEach((x) => tags.add(x));
  }
  return [...tags];
}

/**
 * Offline scoring. Used when there is no API key, and also as the tie-breaker
 * ordering for the menu list ("recommended for you right now").
 */
export function scoreDishes(menu, ctx = {}) {
  const {
    text = "",
    hunger = 3,
    weather, // { tempC, isCold, isHot, rain }
    partOfDay, // morning | afternoon | evening | night
    goal, // { kcalLeft, proteinLeft }
    kitchen, // { level }
    justTrained = false,
    budget, // number
  } = ctx;

  const wanted = new Set(moodTags(text));
  if (justTrained) ["protein", "post-workout"].forEach((t) => wanted.add(t));
  if (partOfDay === "morning") wanted.add("breakfast");
  if (partOfDay === "night") wanted.add("light");
  if (weather?.isCold) ["warm", "comfort"].forEach((t) => wanted.add(t));
  if (weather?.isHot) ["cold", "fresh", "light"].forEach((t) => wanted.add(t));
  if (kitchen?.level === "slammed") wanted.add("quick");

  const targetKcal = HUNGER_KCAL[hunger] || 650;

  return menu
    .map((d) => {
      let score = 0;
      const tags = d.tags || [];

      for (const t of tags) if (wanted.has(t)) score += 10;

      // Portion size vs how hungry they are.
      const kcalGap = Math.abs((d.kcal || 0) - targetKcal);
      score += Math.max(0, 14 - kcalGap / 45);

      // Temperature vs weather.
      if (weather?.isCold && d.temp === "hot") score += 6;
      if (weather?.isHot && d.temp === "cold") score += 6;

      // Fitness goals.
      if (goal?.proteinLeft > 0) score += Math.min(14, ((d.protein || 0) / goal.proteinLeft) * 14);
      if (goal?.kcalLeft > 0) {
        if ((d.kcal || 0) <= goal.kcalLeft) score += 8;
        else score -= 12; // blows the budget
      }

      // Speed when the kitchen is drowning.
      if (kitchen?.level !== "calm") score += Math.max(0, 8 - (d.prepMinutes || 10) / 3);

      if (budget && d.price > budget) score -= 20;

      return { dish: d, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function partOfDayFor(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return "morning";
  if (h < 17) return "afternoon";
  if (h < 22) return "evening";
  return "night";
}

// Water target for athletes, litres. Simple, defensible rule of thumb.
export function waterTarget(weightKg, trainedToday) {
  if (!weightKg) return null;
  const base = (weightKg * 0.033).toFixed(1);
  const withTraining = (weightKg * 0.033 + (trainedToday ? 0.7 : 0)).toFixed(1);
  return { base: Number(base), total: Number(withTraining) };
}

export function cartTotals(items) {
  return items.reduce(
    (acc, i) => ({
      price: acc.price + i.price * i.qty,
      kcal: acc.kcal + (i.kcal || 0) * i.qty,
      protein: acc.protein + (i.protein || 0) * i.qty,
      count: acc.count + i.qty,
    }),
    { price: 0, kcal: 0, protein: 0, count: 0 }
  );
}
