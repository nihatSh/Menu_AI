// Weather lookup for the "weather aware" recommendations.
// Open-Meteo is free and needs no API key. Cached in memory for 15 minutes so
// a busy restaurant does not hammer it, and it fails soft: if the network is
// down the app simply loses the weather steer instead of breaking.

const CACHE_MS = 15 * 60 * 1000;

function cache() {
  if (!globalThis.__weatherCache) globalThis.__weatherCache = new Map();
  return globalThis.__weatherCache;
}

const WMO = {
  0: "clear sky", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "freezing fog", 51: "light drizzle", 53: "drizzle",
  55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 80: "rain showers",
  81: "rain showers", 82: "heavy showers", 95: "thunderstorm",
};

export async function getWeather({ lat, lon }) {
  const key = `${lat},${lon}`;
  const hit = cache().get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`weather ${res.status}`);
    const json = await res.json();

    const tempC = Math.round(json.current.temperature_2m);
    const code = json.current.weather_code;
    const value = {
      tempC,
      code,
      description: WMO[code] || "unsettled",
      isCold: tempC <= 14,
      isHot: tempC >= 26,
      isWet: [51, 53, 55, 61, 63, 65, 80, 81, 82, 95].includes(code),
    };
    cache().set(key, { at: Date.now(), value });
    return value;
  } catch {
    return null; // fail soft - no weather steer
  }
}
