// Opening hours. `hours` on a restaurant is { open: "09:00", close: "23:30" }
// in the restaurant's own time zone. Closing after midnight ("02:00") works.

function minutesOf(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function localMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour").value);
  const m = Number(parts.find((p) => p.type === "minute").value);
  return h * 60 + m;
}

export function isOpen(restaurant, date = new Date()) {
  if (!restaurant.hours) return true;
  const now = localMinutes(date, restaurant.timeZone || "UTC");
  const open = minutesOf(restaurant.hours.open);
  const close = minutesOf(restaurant.hours.close);
  if (close > open) return now >= open && now < close;
  // Crosses midnight, e.g. 18:00 -> 02:00
  return now >= open || now < close;
}
