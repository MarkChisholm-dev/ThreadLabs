import { useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  getAnalytics,
  getDailyRecommendation,
  getOutfitPlans,
  getSavedOutfits,
  logOutfitWear,
  removeOutfitPlan,
  saveOutfitPlan,
} from "../api.js";

function formatDate(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString();
}

function OutfitPreview({ outfit }) {
  if (!outfit?.items) {
    return null;
  }

  const slots = [
    ["Top", outfit.items.top],
    ["Bottom", outfit.items.bottom],
    ["Shoes", outfit.items.shoes],
    ["Accessory", outfit.items.accessory],
  ];

  return (
    <div className="planner-preview">
      {slots.map(([label, item]) => (
        <article className="planner-preview-slot" key={`${outfit.id || outfit.name}-${label}`}>
          <span>{label}</span>
          {item?.imageUrl ? (
            <img src={`${API_BASE}${item.imageUrl}`} alt={item.name || label} />
          ) : (
            <div className="planner-preview-empty">None</div>
          )}
          <p>{item?.name || "None"}</p>
        </article>
      ))}
    </div>
  );
}

export default function PlannerInsightsPanel() {
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [plans, setPlans] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [daily, setDaily] = useState(null);
  const [status, setStatus] = useState("");

  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedOutfitId, setSelectedOutfitId] = useState("");
  const [city, setCity] = useState("London");
  const [country, setCountry] = useState("United Kingdom");

  const nextWeekPlans = useMemo(
    () => [...plans].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 10),
    [plans],
  );
  const selectedOutfit = useMemo(
    () => savedOutfits.find((row) => row.id === selectedOutfitId) || null,
    [savedOutfits, selectedOutfitId],
  );

  async function refreshAll() {
    const [outfitsRows, plansRows, analyticsRows] = await Promise.all([
      getSavedOutfits(),
      getOutfitPlans(),
      getAnalytics(),
    ]);

    setSavedOutfits(outfitsRows || []);
    setPlans(plansRows || []);
    setAnalytics(analyticsRows || null);

    if (!selectedOutfitId && outfitsRows?.[0]?.id) {
      setSelectedOutfitId(outfitsRows[0].id);
    }
  }

  useEffect(() => {
    refreshAll().catch((err) => {
      setStatus(err.message || "Unable to load planner insights");
    });
  }, []);

  return (
    <section className="panel planner-panel">
      <div className="panel-head">
        <div>
          <h2>Outfit Planner and Closet Insights</h2>
          <p className="meta">Plan outfits by date, avoid repeats, and monitor wear patterns.</p>
        </div>
      </div>

      {status ? <p className="error">{status}</p> : null}

      <div className="planner-layout">
        <article className="planner-card">
          <h3>Calendar Planner</h3>
          <label>
            Date
            <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
          </label>
          <label>
            Outfit
            <select value={selectedOutfitId} onChange={(e) => setSelectedOutfitId(e.target.value)}>
              <option value="">Select saved outfit</option>
              {savedOutfits.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          {selectedOutfit ? <OutfitPreview outfit={selectedOutfit} /> : null}
          <button
            type="button"
            onClick={async () => {
              setStatus("");
              try {
                await saveOutfitPlan({ date: planDate, outfitId: selectedOutfitId });
                await refreshAll();
                setStatus("Outfit planned");
              } catch (err) {
                setStatus(err.message || "Unable to save plan");
              }
            }}
          >
            Save To Calendar
          </button>
          <div className="planner-list">
            {nextWeekPlans.map((plan) => (
              <div className="planner-row" key={plan.id}>
                <div>
                  <strong>{formatDate(plan.date)}</strong>
                  <p className="meta">{plan.outfit?.name || "Outfit removed"}</p>
                  <OutfitPreview outfit={plan.outfit} />
                </div>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={async () => {
                    await removeOutfitPlan(plan.id);
                    await refreshAll();
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="planner-card">
          <h3>Weather-Aware Today</h3>
          <div className="row">
            <label>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label>
              Country
              <input value={country} onChange={(e) => setCountry(e.target.value)} />
            </label>
          </div>
          <button
            type="button"
            onClick={async () => {
              setStatus("");
              try {
                const data = await getDailyRecommendation({ city, country, occasion: "casual" });
                setDaily(data);
              } catch (err) {
                setStatus(err.message || "Unable to fetch daily recommendation");
              }
            }}
          >
            What Should I Wear Today?
          </button>
          {daily?.weather ? (
            <p className="meta">
              Weather: {daily.weather.city}, {daily.weather.country || daily.weather.countryCode} - {daily.weather.temperatureC} C
            </p>
          ) : null}
          {daily?.outfit ? (
            <div className="daily-box">
              <strong>{daily.outfit.items?.top?.name || "Top"} + {daily.outfit.items?.bottom?.name || "Bottom"}</strong>
              <p className="meta">Recently avoided items: {daily.avoidedRecentlyUsedItems || 0}</p>
              <button
                type="button"
                className="secondary-btn"
                onClick={async () => {
                  await logOutfitWear({
                    outfitId: daily.outfit.id || null,
                    itemIds: [
                      daily.outfit.items?.top?.id,
                      daily.outfit.items?.bottom?.id,
                      daily.outfit.items?.shoes?.id,
                      daily.outfit.items?.accessory?.id,
                    ].filter(Boolean),
                  });
                  await refreshAll();
                }}
              >
                Mark As Worn
              </button>
            </div>
          ) : null}
          {daily?.missingItemSuggestions?.length ? (
            <ul>
              {daily.missingItemSuggestions.map((row) => (
                <li key={row.category}>{row.suggestion}</li>
              ))}
            </ul>
          ) : null}
        </article>
      </div>

      <article className="planner-card analytics-card">
        <h3>Wear History and Closet Analytics</h3>
        <div className="analytics-grid">
          <div>
            <h4>Most Worn</h4>
            <ul>
              {(analytics?.mostWorn || []).slice(0, 5).map((row) => (
                <li key={row.item.id}>{row.item.name} ({row.wears})</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Never Worn</h4>
            <ul>
              {(analytics?.neverWorn || []).slice(0, 5).map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Cost Per Wear</h4>
            <ul>
              {(analytics?.costPerWear || []).slice(0, 5).map((row) => (
                <li key={row.item.id}>
                  {row.item.name}: {row.value == null ? "Not worn yet" : `$${row.value}`}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Category Gaps</h4>
            <ul>
              {(analytics?.categoryGaps || []).map((row) => (
                <li key={row.category}>{row.category}: {row.count} items</li>
              ))}
            </ul>
          </div>
        </div>
      </article>
    </section>
  );
}
