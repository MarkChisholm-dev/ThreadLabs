import { useEffect, useState } from "react";
import { API_BASE } from "../api.js";

const DEFAULT_OCCASIONS = ["casual"];

function OutfitItem({ item }) {
  if (!item) {
    return null;
  }

  return (
    <figure className="suggestion-item">
      <img src={`${API_BASE}${item.imageUrl}`} alt={item.name} />
      <figcaption>
        <strong>{item.category}</strong>
        <span>{item.name}</span>
      </figcaption>
    </figure>
  );
}

export default function SuggestionPanel({
  suggestionState,
  onGenerate,
  onRandomOutfit,
  onFeedback,
  config,
  onAddConfigTag,
}) {
  const [occasion, setOccasion] = useState("casual");
  const [city, setCity] = useState("London");
  const [country, setCountry] = useState("United Kingdom");
  const [newOccasion, setNewOccasion] = useState("");
  const occasionOptions = config?.occasionTags || DEFAULT_OCCASIONS;

  useEffect(() => {
    if (!occasionOptions.includes(occasion)) {
      setOccasion(occasionOptions[0] || "casual");
    }
  }, [occasion, occasionOptions]);

  const { loading, weather, outfits, missingCategories, missingItemSuggestions, error } = suggestionState;

  return (
    <section className="panel">
      <h2>Generate Outfit</h2>
      <div className="row">
        <label>
          Occasion
          <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>
            {occasionOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label>
          Add Occasion Tag
          <div className="row compact-row tag-inline-add">
            <input
              value={newOccasion}
              onChange={(e) => setNewOccasion(e.target.value)}
              placeholder="Add custom occasion"
            />
            <button
              onClick={async () => {
                const normalized = String(newOccasion || "").trim();
                if (!normalized || !onAddConfigTag) {
                  return;
                }
                await onAddConfigTag("occasionTags", normalized);
                setOccasion(normalized);
                setNewOccasion("");
              }}
              type="button"
            >
              Add
            </button>
          </div>
        </label>
        <label>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label>
          Country (name or ISO code)
          <input value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
      </div>

      <div className="row action-row">
        <button
          disabled={loading}
          onClick={() => onGenerate({ occasion, city, country })}
          type="button"
        >
          {loading ? "Generating..." : "Suggest Outfit"}
        </button>
        <button
          className="secondary-btn"
          disabled={loading}
          onClick={onRandomOutfit}
          type="button"
        >
          Random Outfit
        </button>
      </div>

      {weather ? (
        <p className="meta">
          Weather in {weather.city}, {weather.country || weather.countryCode}: {weather.temperatureC} C
        </p>
      ) : null}

      {missingCategories?.length ? (
        <div className="warning-panel">
          <p className="warning">Add more items in: {missingCategories.join(", ")} to generate complete outfits.</p>
          <ul>
            {(missingItemSuggestions || []).map((row) => (
              <li key={row.category}>
                <strong>{row.category}:</strong> {row.suggestion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="suggestion-list">
        {outfits?.map((outfit, idx) => {
          const ids = [
            outfit.items.top?.id,
            outfit.items.bottom?.id,
            outfit.items.shoes?.id,
            outfit.items.accessory?.id,
          ].filter(Boolean);

          return (
            <article className="suggestion-card" key={`${ids.join("-")}-${idx}`}>
              <header>
                <h3>Look #{idx + 1}</h3>
                <span>{Number.isFinite(outfit.score) ? outfit.score.toFixed(2) : "Random"}</span>
              </header>
              <div className="suggestion-grid">
                <OutfitItem item={outfit.items.top} />
                <OutfitItem item={outfit.items.bottom} />
                <OutfitItem item={outfit.items.shoes} />
                <OutfitItem item={outfit.items.accessory} />
              </div>
              <div className="feedback-actions">
                <button onClick={() => onFeedback(ids, true)} type="button">
                  Like
                </button>
                <button onClick={() => onFeedback(ids, false)} type="button">
                  Skip
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
