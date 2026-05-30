const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

const weatherCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function pickBestPlace(results, country) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const normalizedCountry = normalize(country);
  if (!normalizedCountry) {
    return results[0];
  }

  const exact = results.find((place) => {
    const countryName = normalize(place.country);
    const countryCode = normalize(place.country_code);
    return countryName === normalizedCountry || countryCode === normalizedCountry;
  });

  if (exact) {
    return exact;
  }

  const partial = results.find((place) => {
    const countryName = normalize(place.country);
    return countryName.includes(normalizedCountry) || normalizedCountry.includes(countryName);
  });

  return partial || results[0];
}

export async function getWeatherByLocation({ city, country }) {
  const normalizedCity = String(city || "").trim();
  const normalizedCountry = String(country || "").trim();

  if (!normalizedCity) {
    throw new Error("City is required");
  }

  const cacheKey = `${normalize(normalizedCity)}|${normalize(normalizedCountry)}`;
  const now = Date.now();
  const hit = weatherCache.get(cacheKey);
  if (hit && now - hit.timestamp < CACHE_TTL_MS) {
    return hit.data;
  }

  const geoRes = await fetch(`${GEO_URL}?name=${encodeURIComponent(normalizedCity)}&count=10`);
  if (!geoRes.ok) {
    throw new Error("Unable to geocode city");
  }
  const geoJson = await geoRes.json();
  const place = pickBestPlace(geoJson.results, normalizedCountry);
  if (!place) {
    throw new Error("City not found");
  }

  const weatherRes = await fetch(
    `${WEATHER_URL}?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code`,
  );
  if (!weatherRes.ok) {
    throw new Error("Unable to fetch weather");
  }
  const weatherJson = await weatherRes.json();
  const data = {
    city: place.name,
    country: place.country,
    countryCode: place.country_code,
    region: place.admin1,
    temperatureC: weatherJson.current?.temperature_2m,
    weatherCode: weatherJson.current?.weather_code,
  };

  weatherCache.set(cacheKey, { timestamp: now, data });
  return data;
}
