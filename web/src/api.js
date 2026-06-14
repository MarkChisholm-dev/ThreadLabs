export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 10000);
const RETRY_ATTEMPTS = Number(import.meta.env.VITE_API_RETRIES || 2);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(error, method, attempt, maxRetries) {
  if (attempt >= maxRetries) {
    return false;
  }
  if (method && method.toUpperCase() !== "GET") {
    return false;
  }
  return error?.name !== "AbortError";
}

function mergeAbortSignals(signals) {
  const active = (signals || []).filter(Boolean);
  if (active.length === 0) {
    return undefined;
  }
  if (active.length === 1) {
    return active[0];
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  active.forEach((signal) => {
    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener("abort", abort, { once: true });
    }
  });
  return controller.signal;
}

async function request(path, options = {}) {
  const { signal: userSignal, timeoutMs = REQUEST_TIMEOUT_MS, retries = RETRY_ATTEMPTS, ...rest } = options;
  const method = String(rest.method || "GET").toUpperCase();

  for (let attempt = 0; ; attempt += 1) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      const signal = mergeAbortSignals([userSignal, timeoutController.signal]);
      const res = await fetch(`${API_BASE}${path}`, { ...rest, method, signal });
      return await handle(res);
    } catch (error) {
      if (!shouldRetry(error, method, attempt, retries)) {
        if (error?.name === "AbortError") {
          throw new Error("Request timed out. Please try again.");
        }
        throw error;
      }
      await sleep(200 * (attempt + 1));
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

async function handle(res) {
  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
}

export function getItems() {
  return request("/api/items");
}

export function getConfig() {
  return request("/api/config");
}

export function updateConfig(payload) {
  return request("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export function createItem(formData) {
  return request("/api/items", {
    method: "POST",
    body: formData,
    retries: 0,
  });
}

export function deleteItem(id) {
  return request(`/api/items/${id}`, {
    method: "DELETE",
    retries: 0,
  });
}

export function getSuggestions(payload) {
  return request("/api/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export function getRandomOutfit() {
  return request("/api/outfits/random");
}

export function getSavedOutfits() {
  return request("/api/outfits/saved");
}

export function updateSavedOutfit(id, payload) {
  return request(`/api/outfits/saved/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export function duplicateSavedOutfit(id, payload = {}) {
  return request(`/api/outfits/saved/${id}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export function getOutfitPlans() {
  return request("/api/planner");
}

export function saveOutfitPlan(payload) {
  return request("/api/planner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export function removeOutfitPlan(id) {
  return request(`/api/planner/${id}`, {
    method: "DELETE",
    retries: 0,
  });
}

export function getAnalytics() {
  return request("/api/analytics");
}

export function logOutfitWear(payload) {
  return request("/api/wear-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export function getDailyRecommendation(payload) {
  return request("/api/recommendation/daily", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export function saveOutfit(payload) {
  return request("/api/outfits/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export function saveFeedback(payload) {
  return request("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export function getAssistantStatus() {
  return request("/api/assistant/status");
}

export function askAssistant(payload) {
  return request("/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    retries: 0,
    timeoutMs: Number(import.meta.env.VITE_ASSISTANT_TIMEOUT_MS || 45000),
  });
}
