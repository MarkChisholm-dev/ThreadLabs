import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SuggestionPanel from "./SuggestionPanel.jsx";

const config = {
  occasionTags: ["casual", "office"],
};

describe("SuggestionPanel", () => {
  it("calls generate with selected inputs", () => {
    const onGenerate = vi.fn();

    render(
      <SuggestionPanel
        suggestionState={{ loading: false, weather: null, outfits: [], missingCategories: [], missingItemSuggestions: [], error: "" }}
        onGenerate={onGenerate}
        onRandomOutfit={vi.fn()}
        onFeedback={vi.fn()}
        config={config}
        onAddConfigTag={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Paris" } });
    fireEvent.change(screen.getByLabelText("Country (name or ISO code)"), { target: { value: "FR" } });
    fireEvent.change(screen.getByLabelText("Occasion"), { target: { value: "office" } });

    fireEvent.click(screen.getByRole("button", { name: "Suggest Outfit" }));

    expect(onGenerate).toHaveBeenCalledWith({ occasion: "office", city: "Paris", country: "FR" });
  });

  it("sends feedback from rendered outfit actions", () => {
    const onFeedback = vi.fn();

    render(
      <SuggestionPanel
        suggestionState={{
          loading: false,
          weather: null,
          missingCategories: [],
          missingItemSuggestions: [],
          error: "",
          outfits: [
            {
              score: 1.2,
              items: {
                top: { id: "t1", name: "Top", category: "top", imageUrl: "/uploads/t1.jpg" },
                bottom: { id: "b1", name: "Bottom", category: "bottom", imageUrl: "/uploads/b1.jpg" },
                shoes: { id: "s1", name: "Shoes", category: "shoes", imageUrl: "/uploads/s1.jpg" },
                accessory: null,
              },
            },
          ],
        }}
        onGenerate={vi.fn()}
        onRandomOutfit={vi.fn()}
        onFeedback={onFeedback}
        config={config}
        onAddConfigTag={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(onFeedback).toHaveBeenCalledWith(["t1", "b1", "s1"], true);
  });
});
