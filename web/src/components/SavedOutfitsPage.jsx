import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE, duplicateSavedOutfit, getItems, getSavedOutfits, updateSavedOutfit } from "../api.js";

function Slot({ label, item }) {
  return (
    <article className="saved-slot">
      <h4>{label}</h4>
      {item ? (
        <>
          <img src={`${API_BASE}${item.imageUrl}`} alt={item.name} />
          <p>{item.name}</p>
        </>
      ) : (
        <p className="meta">None</p>
      )}
    </article>
  );
}

export default function SavedOutfitsPage() {
  const [rows, setRows] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [swapIds, setSwapIds] = useState({ top: "", bottom: "", shoes: "", accessory: "" });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [data, items] = await Promise.all([getSavedOutfits(), getItems()]);
        setRows(data || []);
        setAllItems(items || []);
      } catch (err) {
        setError(err.message || "Unable to load outfits");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Saved Outfits</p>
        <h1>Outfit Library</h1>
        <p>Outfits built from Graph Lab are stored here.</p>
        <div className="graph-top-actions">
          <Link className="secondary-btn link-btn" to="/">
            Back Home
          </Link>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="meta">Loading outfits...</p> : null}

      <section className="saved-outfit-list">
        {rows.map((outfit) => (
          <article className="saved-outfit-card" key={outfit.id}>
            <div className="saved-outfit-head">
              <h3>{outfit.name}</h3>
              <span>{new Date(outfit.createdAt).toLocaleString()}</span>
            </div>
            <div className="saved-outfit-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setEditId(outfit.id);
                  setEditName(outfit.name);
                  setSwapIds({
                    top: outfit.items?.top?.id || "",
                    bottom: outfit.items?.bottom?.id || "",
                    shoes: outfit.items?.shoes?.id || "",
                    accessory: outfit.items?.accessory?.id || "",
                  });
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={async () => {
                  await duplicateSavedOutfit(outfit.id, {
                    name: `${outfit.name} Copy`,
                  });
                  const data = await getSavedOutfits();
                  setRows(data || []);
                }}
              >
                Duplicate
              </button>
            </div>

            {editId === outfit.id ? (
              <div className="saved-edit-box">
                <label>
                  Outfit Name
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </label>
                <div className="saved-edit-grid">
                  {[
                    ["top", "Top"],
                    ["bottom", "Bottom"],
                    ["shoes", "Shoes"],
                    ["accessory", "Accessory"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <select
                        value={swapIds[key] || ""}
                        onChange={(e) => setSwapIds((prev) => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="">None</option>
                        {allItems
                          .filter((item) => item.category === key)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="saved-outfit-actions">
                  <button
                    type="button"
                    onClick={async () => {
                      const byId = new Map(allItems.map((item) => [item.id, item]));
                      await updateSavedOutfit(outfit.id, {
                        name: editName,
                        items: {
                          top: swapIds.top ? byId.get(swapIds.top) || null : null,
                          bottom: swapIds.bottom ? byId.get(swapIds.bottom) || null : null,
                          shoes: swapIds.shoes ? byId.get(swapIds.shoes) || null : null,
                          accessory: swapIds.accessory ? byId.get(swapIds.accessory) || null : null,
                        },
                      });
                      const data = await getSavedOutfits();
                      setRows(data || []);
                      setEditId("");
                    }}
                  >
                    Save Edit
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => setEditId("")}>Cancel</button>
                </div>
              </div>
            ) : null}

            <div className="saved-slot-grid">
              <Slot label="Top" item={outfit.items?.top} />
              <Slot label="Bottom" item={outfit.items?.bottom} />
              <Slot label="Shoes" item={outfit.items?.shoes} />
              <Slot label="Accessory" item={outfit.items?.accessory} />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
