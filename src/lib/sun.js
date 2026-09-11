// Sunset time (for iftar) and Ramadan detection.
//
// Sunset uses the NOAA solar position algorithm - accurate to about a minute,
// which is plenty for "iftar is at 19:42". Ramadan is detected from the
// Umm al-Qura Hijri calendar built into Node's ICU, so there is nothing to
// update each year.

const rad = Math.PI / 180;

function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Returns a Date for local sunset at the given coordinates, or null in polar night/day. */
export function sunsetAt({ lat, lon }, date = new Date()) {
  const jd = julianDay(date);
  // Whole day number since J2000 - must be an integer, otherwise the transit
  // drifts with the time of day the function is called.
  const n = Math.ceil(jd - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const delta = Math.asin(Math.sin(lambda * rad) * Math.sin(23.44 * rad));

  const cosOmega =
    (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(delta)) /
    (Math.cos(lat * rad) * Math.cos(delta));
  if (cosOmega < -1 || cosOmega > 1) return null;

  const omega = Math.acos(cosOmega) / rad;
  const jSet = jTransit + omega / 360;
  return new Date((jSet - 2440587.5) * 86400000);
}

export function formatTime(date, timeZone = "Asia/Baku") {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
}

/** True during the Hijri month of Ramadan (month 9). */
export function isRamadan(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric" }).formatToParts(date);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    return month === 9;
  } catch {
    return false;
  }
}

/** Minutes until iftar (negative if already past), plus the formatted time. */
export function iftarInfo(coords, date = new Date(), timeZone) {
  const sunset = sunsetAt(coords, date);
  if (!sunset) return null;
  return {
    time: formatTime(sunset, timeZone),
    minutesUntil: Math.round((sunset.getTime() - date.getTime()) / 60000),
  };
}
