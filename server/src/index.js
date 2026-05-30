import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";

import { DEFAULT_CONFIG, readDb, writeDb } from "./db.js";
import { getImageEmbedding } from "./embedding.js";
import { getWeatherByLocation } from "./weather.js";
import { buildSuggestions } from "./suggestions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 4000);
const upload = multer({
  storage: multer.diskStorage({
    destination: path.resolve(__dirname, "..", "uploads"),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}-${uuidv4()}${ext}`);
    },
  }),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/items", (_req, res) => {
  const db = readDb();
  res.json(db.items);
});

app.get("/api/outfits/saved", (_req, res) => {
  const db = readDb();
  const outfits = [...(db.outfits || [])].sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
  res.json(outfits);
});

app.post("/api/outfits/saved", (req, res) => {
  const payload = req.body || {};
  const name = String(payload.name || "").trim() || "Untitled Outfit";
  const normalized = normalizeOutfitItems(payload.items);

  const db = readDb();
  const next = {
    id: uuidv4(),
    name,
    items: normalized,
    createdAt: new Date().toISOString(),
  };

  db.outfits.push(next);
  writeDb(db);

  return res.status(201).json(next);
});

app.put("/api/outfits/saved/:id", (req, res) => {
  const db = readDb();
  const idx = db.outfits.findIndex((outfit) => outfit.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Outfit not found" });
  }

  const payload = req.body || {};
  const current = db.outfits[idx];
  const next = {
    ...current,
    name: String(payload.name || current.name || "Untitled Outfit").trim() || "Untitled Outfit",
    items: normalizeOutfitItems(payload.items || current.items),
    updatedAt: new Date().toISOString(),
  };

  db.outfits[idx] = next;
  writeDb(db);
  return res.json(next);
});

app.post("/api/outfits/saved/:id/duplicate", (req, res) => {
  const db = readDb();
  const found = db.outfits.find((outfit) => outfit.id === req.params.id);
  if (!found) {
    return res.status(404).json({ error: "Outfit not found" });
  }

  const payload = req.body || {};
  const next = {
    ...found,
    id: uuidv4(),
    name: String(payload.name || `${found.name} Copy`).trim() || `${found.name} Copy`,
    items: normalizeOutfitItems(payload.items || found.items),
    createdAt: new Date().toISOString(),
    duplicatedFromId: found.id,
  };

  db.outfits.push(next);
  writeDb(db);
  return res.status(201).json(next);
});

app.get("/api/planner", (_req, res) => {
  const db = readDb();
  const outfitsById = new Map((db.outfits || []).map((outfit) => [outfit.id, outfit]));
  const rows = (db.outfitPlans || [])
    .map((plan) => ({
      ...plan,
      outfit: outfitsById.get(plan.outfitId) || null,
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return res.json(rows);
});

app.post("/api/planner", (req, res) => {
  const db = readDb();
  const date = normalizeDateKey(req.body?.date);
  const outfitId = String(req.body?.outfitId || "").trim();
  if (!date || !outfitId) {
    return res.status(400).json({ error: "date and outfitId are required" });
  }

  const outfit = db.outfits.find((row) => row.id === outfitId);
  if (!outfit) {
    return res.status(404).json({ error: "Outfit not found" });
  }

  const existing = db.outfitPlans.find((plan) => plan.date === date);
  const recentOutfits = db.outfitPlans
    .filter((plan) => plan.date !== date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 7)
    .map((plan) => plan.outfitId);

  if (recentOutfits.includes(outfitId)) {
    return res.status(409).json({ error: "Avoid repeats: this outfit is planned recently" });
  }

  const next = {
    id: existing?.id || uuidv4(),
    date,
    outfitId,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    db.outfitPlans = db.outfitPlans.map((plan) => (plan.id === existing.id ? next : plan));
  } else {
    db.outfitPlans.push(next);
  }

  writeDb(db);
  return res.status(existing ? 200 : 201).json(next);
});

app.delete("/api/planner/:id", (req, res) => {
  const db = readDb();
  const before = db.outfitPlans.length;
  db.outfitPlans = db.outfitPlans.filter((row) => row.id !== req.params.id);
  if (db.outfitPlans.length === before) {
    return res.status(404).json({ error: "Plan not found" });
  }
  writeDb(db);
  return res.status(204).send();
});

app.post("/api/wear-log", (req, res) => {
  const db = readDb();
  const outfitId = String(req.body?.outfitId || "").trim();
  const date = normalizeDateKey(req.body?.date || new Date().toISOString());
  const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.filter(Boolean) : [];

  if (!outfitId && itemIds.length === 0) {
    return res.status(400).json({ error: "outfitId or itemIds is required" });
  }

  const next = {
    id: uuidv4(),
    outfitId: outfitId || null,
    itemIds,
    date,
    createdAt: new Date().toISOString(),
  };

  db.wearLogs.push(next);
  writeDb(db);
  return res.status(201).json(next);
});

app.get("/api/analytics", (_req, res) => {
  const db = readDb();
  const itemWearCount = new Map();
  const outfitById = new Map((db.outfits || []).map((outfit) => [outfit.id, outfit]));

  for (const row of db.wearLogs || []) {
    if (row.outfitId && outfitById.has(row.outfitId)) {
      for (const id of getOutfitItemIds(outfitById.get(row.outfitId))) {
        itemWearCount.set(id, (itemWearCount.get(id) || 0) + 1);
      }
    }
    if (Array.isArray(row.itemIds)) {
      for (const id of row.itemIds) {
        itemWearCount.set(id, (itemWearCount.get(id) || 0) + 1);
      }
    }
  }

  const mostWorn = [...db.items]
    .map((item) => ({
      item,
      wears: itemWearCount.get(item.id) || 0,
    }))
    .sort((a, b) => b.wears - a.wears)
    .slice(0, 8);

  const neverWorn = db.items.filter((item) => (itemWearCount.get(item.id) || 0) === 0).slice(0, 12);

  const costPerWear = db.items
    .filter((item) => Number.isFinite(Number(item.cost)))
    .map((item) => {
      const wears = itemWearCount.get(item.id) || 0;
      const cost = Number(item.cost);
      return {
        item,
        wears,
        value: wears > 0 ? Number((cost / wears).toFixed(2)) : null,
      };
    })
    .sort((a, b) => {
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      return b.value - a.value;
    })
    .slice(0, 8);

  const categories = db.config?.categories || DEFAULT_CONFIG.categories;
  const categoryGaps = categories
    .map((category) => ({
      category,
      count: db.items.filter((item) => item.category === category).length,
    }))
    .filter((row) => row.count <= 1)
    .map((row) => ({
      ...row,
      urgency: row.count === 0 ? "high" : "medium",
    }));

  return res.json({
    mostWorn,
    neverWorn,
    costPerWear,
    categoryGaps,
    totalWearEvents: db.wearLogs.length,
  });
});

app.post("/api/recommendation/daily", async (req, res) => {
  try {
    const db = readDb();
    const city = String(req.body?.city || "").trim();
    const country = String(req.body?.country || "").trim();
    const occasion = String(req.body?.occasion || "casual").trim() || "casual";

    let weather = null;
    if (city) {
      weather = await getWeatherByLocation({ city, country });
    }

    const recentItemIds = getRecentUsedItemIds(db, 7);
    const result = buildSuggestions(db.items, {
      occasion,
      weather,
      feedback: db.feedback,
      limit: 1,
      avoidItemIds: recentItemIds,
      constraints: {
        noRepeat: true,
      },
    });

    const missingItemSuggestions = buildMissingItemSuggestions(
      db.items,
      db.config,
      result.missingCategories,
      occasion,
    );

    return res.json({
      weather,
      outfit: result.outfits[0] || null,
      missingCategories: result.missingCategories,
      missingItemSuggestions,
      avoidedRecentlyUsedItems: recentItemIds.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Daily recommendation failed" });
  }
});

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueStrings(list) {
  return Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function sanitizeConfig(config) {
  return {
    categories: uniqueStrings([...(DEFAULT_CONFIG.categories || []), ...(config?.categories || [])]),
    occasionTags: uniqueStrings([...(DEFAULT_CONFIG.occasionTags || []), ...(config?.occasionTags || [])]),
    seasonTags: uniqueStrings([...(DEFAULT_CONFIG.seasonTags || []), ...(config?.seasonTags || [])]),
    styleTags: uniqueStrings([...(DEFAULT_CONFIG.styleTags || []), ...(config?.styleTags || [])]),
  };
}

function normalizeOutfitItems(items) {
  const value = items || {};
  return {
    top: value.top || null,
    bottom: value.bottom || null,
    shoes: value.shoes || null,
    accessory: value.accessory || null,
  };
}

function normalizeDateKey(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function getOutfitItemIds(outfit) {
  return [outfit?.items?.top, outfit?.items?.bottom, outfit?.items?.shoes, outfit?.items?.accessory]
    .filter(Boolean)
    .map((item) => item.id)
    .filter(Boolean);
}

function buildMissingItemSuggestions(items, config, missingCategories, occasion) {
  const nextMissing = Array.isArray(missingCategories) ? missingCategories : [];

  return nextMissing.map((category) => {
    const count = items.filter((item) => item.category === category).length;
    const occasionCount = items.filter(
      (item) => item.category === category && (!occasion || !item.occasions?.length || item.occasions.includes(occasion)),
    ).length;

    const adviceByCategory = {
      shoes: "Need neutral sneakers or clean low-profile shoes",
      top: "Add a versatile neutral top that layers easily",
      bottom: "Add a go-to bottom in a flexible color",
      accessory: "Add one simple accessory for finishing looks",
    };

    return {
      category,
      inventoryCount: count,
      occasionMatches: occasionCount,
      suggestion: adviceByCategory[category] || `Add more ${category} options`,
      urgency: count === 0 ? "high" : "medium",
      reason: count === 0 ? "No items in this category" : "Low variety for current wardrobe",
    };
  });
}

function getRecentUsedItemIds(db, days = 7) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const outfitById = new Map((db.outfits || []).map((outfit) => [outfit.id, outfit]));
  const used = new Set();

  for (const row of db.wearLogs || []) {
    const ts = new Date(row.date || row.createdAt || 0).getTime();
    if (!Number.isFinite(ts) || ts < since) {
      continue;
    }

    if (row.outfitId && outfitById.has(row.outfitId)) {
      getOutfitItemIds(outfitById.get(row.outfitId)).forEach((id) => used.add(id));
    }

    if (Array.isArray(row.itemIds)) {
      row.itemIds.forEach((id) => used.add(id));
    }
  }

  return Array.from(used);
}

app.get("/api/config", (_req, res) => {
  const db = readDb();
  res.json({
    ...db.config,
    lockedDefaults: DEFAULT_CONFIG,
  });
});

app.put("/api/config", (req, res) => {
  const db = readDb();
  const nextConfig = sanitizeConfig(req.body || {});

  if (
    nextConfig.categories.length === 0 ||
    nextConfig.occasionTags.length === 0 ||
    nextConfig.seasonTags.length === 0
  ) {
    return res.status(400).json({ error: "Categories, occasions, and seasons need at least one option" });
  }

  db.config = nextConfig;
  writeDb(db);
  return res.json({
    ...db.config,
    lockedDefaults: DEFAULT_CONFIG,
  });
});

app.post("/api/items", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image is required" });
    }

    const name = String(req.body.name || "").trim();
    const category = String(req.body.category || "").trim();
    const seasons = parseTags(req.body.seasons);
    const occasions = parseTags(req.body.occasions);
    const styleTags = parseTags(req.body.styleTags);
    const warmthLevel = Number(req.body.warmthLevel || 3);

    if (!name || !category) {
      return res.status(400).json({ error: "Name and category are required" });
    }

    const db = readDb();
    if (!db.config.categories.includes(category)) {
      return res.status(400).json({ error: "Invalid category for current config" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const embedding = await getImageEmbedding({
      imagePath: imageUrl,
      category,
      name,
      seasons,
      occasions,
    });

    const item = {
      id: uuidv4(),
      name,
      category,
      seasons,
      occasions,
      styleTags,
      warmthLevel,
      imageUrl,
      embedding,
      createdAt: new Date().toISOString(),
    };
    db.items.push(item);
    writeDb(db);

    return res.status(201).json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create item" });
  }
});

app.delete("/api/items/:id", (req, res) => {
  const db = readDb();
  const found = db.items.find((item) => item.id === req.params.id);
  if (!found) {
    return res.status(404).json({ error: "Item not found" });
  }

  db.items = db.items.filter((item) => item.id !== req.params.id);
  writeDb(db);

  if (found.imageUrl) {
    const imagePath = path.resolve(__dirname, "..", found.imageUrl.replace(/^\//, ""));
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  return res.status(204).send();
});

app.get("/api/weather", async (req, res) => {
  try {
    const city = String(req.query.city || "").trim();
    const country = String(req.query.country || "").trim();
    const weather = await getWeatherByLocation({ city, country });
    return res.json(weather);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Weather lookup failed" });
  }
});

app.post("/api/suggestions", async (req, res) => {
  try {
    const { occasion, city, country } = req.body || {};
    const db = readDb();

    let weather = null;
    if (city) {
      weather = await getWeatherByLocation({
        city: String(city),
        country: String(country || ""),
      });
    }

    const result = buildSuggestions(db.items, {
      occasion: String(occasion || "").trim() || null,
      weather,
      feedback: db.feedback,
    });

    const missingItemSuggestions = buildMissingItemSuggestions(
      db.items,
      db.config,
      result.missingCategories,
      String(occasion || "").trim() || null,
    );

    return res.json({
      weather,
      ...result,
      missingItemSuggestions,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Suggestion generation failed" });
  }
});

app.get("/api/outfits/random", (req, res) => {
  const db = readDb();
  const items = db.items || [];

  if (items.length === 0) {
    return res.json({
      outfits: [],
      missingCategories: ["top", "bottom", "shoes"],
      weather: null,
    });
  }

  const top = pickRandom(items.filter((item) => item.category === "top"));
  const bottom = pickRandom(items.filter((item) => item.category === "bottom"));
  const shoes = pickRandom(items.filter((item) => item.category === "shoes"));
  const accessory = pickRandom(items.filter((item) => item.category === "accessory"));

  const missingCategories = [];
  if (!top) missingCategories.push("top");
  if (!bottom) missingCategories.push("bottom");
  if (!shoes) missingCategories.push("shoes");

  const fallbackPool = items.filter(Boolean);
  const fallback = () => pickRandom(fallbackPool);

  const randomOutfit = {
    score: 0,
    items: {
      top: top || fallback(),
      bottom: bottom || fallback(),
      shoes: shoes || fallback(),
      accessory: accessory || null,
    },
  };

  return res.json({
    outfits: [randomOutfit],
    missingCategories,
    weather: null,
  });
});

app.post("/api/feedback", (req, res) => {
  const { outfitItemIds, liked } = req.body || {};
  if (!Array.isArray(outfitItemIds) || typeof liked !== "boolean") {
    return res.status(400).json({ error: "outfitItemIds and liked are required" });
  }

  const db = readDb();
  db.feedback.push({
    id: uuidv4(),
    outfitItemIds,
    liked,
    createdAt: new Date().toISOString(),
  });
  writeDb(db);

  return res.status(201).json({ ok: true });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`threadlabs API listening on http://localhost:${PORT}`);
});
