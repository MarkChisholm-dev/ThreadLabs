export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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
  return fetch(`${API_BASE}/api/items`).then(handle);
}

export function getConfig() {
  return fetch(`${API_BASE}/api/config`).then(handle);
}

export function updateConfig(payload) {
  return fetch(`${API_BASE}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function createItem(formData) {
  return fetch(`${API_BASE}/api/items`, {
    method: "POST",
    body: formData,
  }).then(handle);
}

export function deleteItem(id) {
  return fetch(`${API_BASE}/api/items/${id}`, {
    method: "DELETE",
  }).then(handle);
}

export function getSuggestions(payload) {
  return fetch(`${API_BASE}/api/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function getRandomOutfit() {
  return fetch(`${API_BASE}/api/outfits/random`).then(handle);
}

export function getSavedOutfits() {
  return fetch(`${API_BASE}/api/outfits/saved`).then(handle);
}

export function updateSavedOutfit(id, payload) {
  return fetch(`${API_BASE}/api/outfits/saved/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function duplicateSavedOutfit(id, payload = {}) {
  return fetch(`${API_BASE}/api/outfits/saved/${id}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function getOutfitPlans() {
  return fetch(`${API_BASE}/api/planner`).then(handle);
}

export function saveOutfitPlan(payload) {
  return fetch(`${API_BASE}/api/planner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function removeOutfitPlan(id) {
  return fetch(`${API_BASE}/api/planner/${id}`, {
    method: "DELETE",
  }).then(handle);
}

export function getAnalytics() {
  return fetch(`${API_BASE}/api/analytics`).then(handle);
}

export function logOutfitWear(payload) {
  return fetch(`${API_BASE}/api/wear-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function getDailyRecommendation(payload) {
  return fetch(`${API_BASE}/api/recommendation/daily`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function saveOutfit(payload) {
  return fetch(`${API_BASE}/api/outfits/saved`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function saveFeedback(payload) {
  return fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}
