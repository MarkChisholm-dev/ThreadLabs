import { useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import SettingsPanel from "./components/SettingsPanel.jsx";
import UploadForm from "./components/UploadForm.jsx";
import WardrobeGrid from "./components/WardrobeGrid.jsx";
import SuggestionPanel from "./components/SuggestionPanel.jsx";
import GraphLabPage from "./components/GraphLabPage.jsx";
import SavedOutfitsPage from "./components/SavedOutfitsPage.jsx";
import DiagnosticsPanel from "./components/DiagnosticsPanel.jsx";
import PlannerInsightsPanel from "./components/PlannerInsightsPanel.jsx";
import AssistantPanel from "./components/AssistantPanel.jsx";
import { useConfig } from "./hooks/useConfig.js";
import { useSuggestions } from "./hooks/useSuggestions.js";
import { useWardrobe } from "./hooks/useWardrobe.js";

export default function App() {
  const [error, setError] = useState("");
  const { items, uploading, loadingItems, handleCreate, handleDelete } = useWardrobe(setError);
  const { config, savingConfig, handleSaveConfig, handleAddConfigTag } = useConfig(setError);
  const { suggestionState, handleGenerate, handleRandomOutfit, handleFeedback } = useSuggestions();

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
      <AssistantPanel />
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
