import { useState } from "react";
import { getRandomOutfit, getSuggestions, saveFeedback } from "../api.js";

const INITIAL_SUGGESTION_STATE = {
  loading: false,
  weather: null,
  outfits: [],
  missingCategories: [],
  missingItemSuggestions: [],
  error: "",
};

export function useSuggestions() {
  const [suggestionState, setSuggestionState] = useState(INITIAL_SUGGESTION_STATE);

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
        error: err.message || "Unable to generate suggestions",
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
        error: err.message || "Unable to generate random outfit",
      }));
    }
  }

  async function handleFeedback(outfitItemIds, liked) {
    try {
      await saveFeedback({ outfitItemIds, liked });
    } catch {
      // Feedback errors are non-blocking for user flow.
    }
  }

  return {
    suggestionState,
    handleGenerate,
    handleRandomOutfit,
    handleFeedback,
  };
}
