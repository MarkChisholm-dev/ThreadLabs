import { cosineSimilarity } from "./embedding.js";

const BASE_REQUIRED = ["top", "bottom", "shoes"];
const MAX_PER_CATEGORY = 60;
const MAX_COMBINATIONS = 12000;

function byCategory(items, category) {
  return items.filter((item) => item.category === category);
}

function matchesOccasion(item, occasion) {
  if (!occasion) {
    return true;
  }
  if (!item.occasions?.length) {
    return true;
  }
  return item.occasions.includes(occasion);
}

function weatherPenalty(item, temperatureC) {
  if (typeof temperatureC !== "number") {
    return 0;
  }
  const warmth = Number(item.warmthLevel ?? 3);

  if (temperatureC <= 10 && warmth <= 2) {
    return -0.35;
  }
  if (temperatureC >= 26 && warmth >= 4) {
    return -0.35;
  }
  return 0;
}

function compatibilityScore(items, similarity = cosineSimilarity) {
  const pairs = [
    [items.top, items.bottom],
    [items.top, items.shoes],
    [items.bottom, items.shoes],
  ];

  let score = 0;
  for (const [a, b] of pairs) {
    score += similarity(a, b);
  }

  if (items.accessory) {
    score +=
      similarity(items.accessory, items.top) * 0.4 +
      similarity(items.accessory, items.bottom) * 0.3;
  }

  return score;
}

function limitedCandidates(list, max) {
  if (!Array.isArray(list)) {
    return [];
  }
  if (list.length <= max) {
    return list;
  }
  return list.slice(0, max);
}

export function buildSuggestions(
  items,
  {
    occasion,
    weather,
    feedback = [],
    limit = 5,
    avoidItemIds = [],
    constraints = {},
  },
) {
  const excluded = new Set(Array.isArray(avoidItemIds) ? avoidItemIds : []);
  const pairCache = new Map();

  function pairSimilarity(a, b) {
    if (!a || !b) {
      return 0;
    }
    const left = String(a.id || "");
    const right = String(b.id || "");
    const key = left < right ? `${left}|${right}` : `${right}|${left}`;
    if (pairCache.has(key)) {
      return pairCache.get(key);
    }
    const value = cosineSimilarity(a.embedding, b.embedding);
    pairCache.set(key, value);
    return value;
  }

  const topItems = limitedCandidates(
    byCategory(items, "top").filter((i) => matchesOccasion(i, occasion)),
    MAX_PER_CATEGORY,
  );
  const bottomItems = limitedCandidates(
    byCategory(items, "bottom").filter((i) => matchesOccasion(i, occasion)),
    MAX_PER_CATEGORY,
  );
  const shoeItems = limitedCandidates(
    byCategory(items, "shoes").filter((i) => matchesOccasion(i, occasion)),
    MAX_PER_CATEGORY,
  );
  const accessoryItems = limitedCandidates(
    byCategory(items, "accessory").filter((i) => matchesOccasion(i, occasion)),
    MAX_PER_CATEGORY,
  );

  if (topItems.length === 0 || bottomItems.length === 0 || shoeItems.length === 0) {
    return {
      missingCategories: BASE_REQUIRED.filter(
        (category) => byCategory(items, category).length === 0,
      ),
      outfits: [],
    };
  }

  const outfits = [];
  let evaluated = 0;

  function feedbackBoost(selectedItems, feedbackRows) {
    if (!Array.isArray(feedbackRows) || feedbackRows.length === 0) {
      return 0;
    }

    const selectedIds = new Set(
      [selectedItems.top, selectedItems.bottom, selectedItems.shoes, selectedItems.accessory]
        .filter(Boolean)
        .map((item) => item.id),
    );

    let boost = 0;
    for (const row of feedbackRows) {
      if (!Array.isArray(row.outfitItemIds) || row.outfitItemIds.length === 0) {
        continue;
      }
      const overlap = row.outfitItemIds.filter((id) => selectedIds.has(id)).length;
      if (overlap === 0) {
        continue;
      }
      const strength = overlap / 4;
      boost += row.liked ? 0.35 * strength : -0.35 * strength;
    }
    return boost;
  }
  for (const top of topItems) {
    for (const bottom of bottomItems) {
      for (const shoes of shoeItems) {
        evaluated += 1;
        if (evaluated > MAX_COMBINATIONS) {
          break;
        }

        const base = { top, bottom, shoes };
        let bestAccessory = null;
        let bestAccessoryScore = -Infinity;

        for (const accessory of accessoryItems) {
          const accScore = pairSimilarity(accessory, top) + pairSimilarity(accessory, bottom);
          if (accScore > bestAccessoryScore) {
            bestAccessoryScore = accScore;
            bestAccessory = accessory;
          }
        }

        const selected = {
          ...base,
          accessory: bestAccessory,
        };

        const usedIds = [selected.top, selected.bottom, selected.shoes, selected.accessory]
          .filter(Boolean)
          .map((item) => item.id);

        if (constraints.noRepeat && usedIds.some((id) => excluded.has(id))) {
          continue;
        }

        const avgWarmth = [selected.top, selected.bottom, selected.shoes, selected.accessory]
          .filter(Boolean)
          .reduce((sum, item) => sum + Number(item.warmthLevel ?? 3), 0) /
          [selected.top, selected.bottom, selected.shoes, selected.accessory].filter(Boolean).length;

        if (typeof constraints.minWarmth === "number" && avgWarmth < constraints.minWarmth) {
          continue;
        }
        if (typeof constraints.maxWarmth === "number" && avgWarmth > constraints.maxWarmth) {
          continue;
        }

        if (
          constraints.formality &&
          constraints.formality !== "any" &&
          ![selected.top, selected.bottom, selected.shoes].every(
            (item) => !item?.occasions?.length || item.occasions.includes(constraints.formality),
          )
        ) {
          continue;
        }

        const weatherAdjustments = [top, bottom, shoes, bestAccessory]
          .filter(Boolean)
          .reduce((sum, item) => sum + weatherPenalty(item, weather?.temperatureC), 0);

        const score = compatibilityScore(selected, pairSimilarity) + weatherAdjustments + feedbackBoost(selected, feedback);
        const lowConfidence = score < 0.4;

        outfits.push({
          score,
          items: selected,
          diagnostics: {
            avgWarmth: Number.isFinite(avgWarmth) ? Number(avgWarmth.toFixed(2)) : null,
            lowConfidence,
          },
        });
      }
      if (evaluated > MAX_COMBINATIONS) {
        break;
      }
    }
    if (evaluated > MAX_COMBINATIONS) {
      break;
    }
  }

  outfits.sort((a, b) => b.score - a.score);
  return {
    missingCategories: [],
    outfits: outfits.slice(0, limit),
  };
}
