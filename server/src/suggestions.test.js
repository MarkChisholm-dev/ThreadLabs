import { describe, expect, it } from "vitest";
import { buildSuggestions } from "./suggestions.js";

function item(id, category, overrides = {}) {
  return {
    id,
    category,
    name: `${category}-${id}`,
    embedding: [1, 0, 0],
    occasions: ["casual"],
    warmthLevel: 3,
    ...overrides,
  };
}

describe("buildSuggestions", () => {
  it("returns missing required categories", () => {
    const result = buildSuggestions([item("top-1", "top")], { occasion: "casual" });
    expect(result.outfits).toEqual([]);
    expect(result.missingCategories).toEqual(["bottom", "shoes"]);
  });

  it("respects noRepeat constraint", () => {
    const items = [
      item("top-1", "top"),
      item("bottom-1", "bottom"),
      item("shoes-1", "shoes"),
      item("accessory-1", "accessory"),
    ];

    const result = buildSuggestions(items, {
      occasion: "casual",
      constraints: { noRepeat: true },
      avoidItemIds: ["top-1"],
    });

    expect(result.outfits).toEqual([]);
  });

  it("filters by formality and warmth constraints", () => {
    const items = [
      item("top-casual", "top", { warmthLevel: 5, occasions: ["casual"] }),
      item("top-office", "top", { warmthLevel: 2, occasions: ["office"] }),
      item("bottom-office", "bottom", { warmthLevel: 2, occasions: ["office"] }),
      item("shoes-office", "shoes", { warmthLevel: 2, occasions: ["office"] }),
    ];

    const none = buildSuggestions(items, {
      occasion: "office",
      constraints: { formality: "office", maxWarmth: 1.5 },
    });
    expect(none.outfits).toHaveLength(0);

    const some = buildSuggestions(items, {
      occasion: "office",
      constraints: { formality: "office", minWarmth: 1.5, maxWarmth: 3 },
    });
    expect(some.outfits.length).toBeGreaterThan(0);
    expect(some.missingCategories).toEqual([]);
  });
});
