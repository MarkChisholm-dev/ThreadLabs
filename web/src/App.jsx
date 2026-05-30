import { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import {
  createItem,
  deleteItem,
  getConfig,
  getItems,
  getRandomOutfit,
  getSuggestions,
  saveFeedback,
  updateConfig,
} from "./api.js";
import SettingsPanel from "./components/SettingsPanel.jsx";
import UploadForm from "./components/UploadForm.jsx";
import WardrobeGrid from "./components/WardrobeGrid.jsx";
import SuggestionPanel from "./components/SuggestionPanel.jsx";
import GraphLabPage from "./components/GraphLabPage.jsx";
import SavedOutfitsPage from "./components/SavedOutfitsPage.jsx";
import DiagnosticsPanel from "./components/DiagnosticsPanel.jsx";
import PlannerInsightsPanel from "./components/PlannerInsightsPanel.jsx";

export default function App() {
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [config, setConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState("");
  const [suggestionState, setSuggestionState] = useState({
    loading: false,
    weather: null,
    outfits: [],
    missingCategories: [],
    missingItemSuggestions: [],
    error: "",
  });

  async function refreshItems() {
    setLoadingItems(true);
    try {
      const rows = await getItems();
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingItems(false);
    }
  }

  async function refreshConfig() {
    try {
      const nextConfig = await getConfig();
      setConfig(nextConfig);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refreshItems();
    refreshConfig();
  }, []);

  async function handleCreate(formData) {
    setUploading(true);
    setError("");
    try {
      await createItem(formData);
      await refreshItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    setError("");
    try {
      await deleteItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerate(payload) {
    setSuggestionState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await getSuggestions(payload);
      setSuggestionState({
        loading: false,
        weather: data.weather,
        outfits: data.outfits || [],
        missingCategories: data.missingCategories || [],
        missingItemSuggestions: data.missingItemSuggestions || [],
        error: "",
      });
    } catch (err) {
      setSuggestionState((prev) => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  }

  async function handleRandomOutfit() {
    setSuggestionState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await getRandomOutfit();
      setSuggestionState({
        loading: false,
        weather: data.weather || null,
        outfits: data.outfits || [],
        missingCategories: data.missingCategories || [],
        missingItemSuggestions: [],
        error: "",
      });
    } catch (err) {
      setSuggestionState((prev) => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  }

  async function handleFeedback(outfitItemIds, liked) {
    try {
      await saveFeedback({ outfitItemIds, liked });
    } catch {
      // Keep silent for MVP.
    }
  }

  async function handleSaveConfig(nextConfig) {
    setSavingConfig(true);
    setError("");
    try {
      const saved = await updateConfig(nextConfig);
      setConfig(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleAddConfigTag(kind, value) {
    const normalized = String(value || "").trim();
    if (!normalized || !config) {
      return;
    }

    const current = Array.isArray(config[kind]) ? config[kind] : [];
    if (current.includes(normalized)) {
      return;
    }

    await handleSaveConfig({
      ...config,
      [kind]: [...current, normalized],
    });
  }

  const homePage = (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">threadlabs</p>
        <h1>Build looks from your real wardrobe photos</h1>
        <p>
          Upload tops, bottoms, shoes, and accessories. threadlabs suggests complete outfits
          using visual compatibility plus weather and occasion context.
        </p>
        <div className="graph-top-actions">
          <Link className="secondary-btn link-btn" to="/graph-lab">
            Open Outfit Builder
          </Link>
          <Link className="secondary-btn link-btn" to="/saved-outfits">
            View Saved Outfits
          </Link>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <SettingsPanel config={config} saving={savingConfig} onSave={handleSaveConfig} />

      <section className="layout">
        <UploadForm
          loading={uploading}
          onCreate={handleCreate}
          config={config}
          onAddConfigTag={handleAddConfigTag}
        />
        <SuggestionPanel
          suggestionState={suggestionState}
          onGenerate={handleGenerate}
          onRandomOutfit={handleRandomOutfit}
          onFeedback={handleFeedback}
          config={config}
          onAddConfigTag={handleAddConfigTag}
        />
      </section>

      {loadingItems ? (
        <p className="meta">Loading wardrobe...</p>
      ) : (
        <WardrobeGrid items={items} onDelete={handleDelete} />
      )}

      <DiagnosticsPanel />
      <PlannerInsightsPanel />
    </main>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={homePage} />
        <Route path="/graph-lab" element={<GraphLabPage />} />
        <Route path="/saved-outfits" element={<SavedOutfitsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
