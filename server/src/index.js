import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { DEFAULT_CONFIG, mutateDb, readDb } from "./db.js";
import { getEmbeddingMetadata, getImageEmbedding } from "./embedding.js";
import { getWeatherByLocation } from "./weather.js";
import { buildSuggestions } from "./suggestions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, "..", "uploads");
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const app = express();
const PORT = Number(process.env.PORT || 4000);
const OLLAMA_ENABLED = String(process.env.OLLAMA_ENABLED || "false").toLowerCase() === "true";
const OLLAMA_BASE_URL = String(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = String(process.env.OLLAMA_MODEL || "llama3.1:8b");
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 30000);
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const corsOriginList =
  allowedOrigins.length > 0
    ? allowedOrigins
    : [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
      ];

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${uuidv4()}${ext}`);
    },
  }),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      cb(new HttpError(400, "Unsupported image type. Use jpg, jpeg, png, or webp."));
      return;
    }
    cb(null, true);
  },
});

const idParamSchema = z.object({
  id: z.string().trim().min(1),
});

const outfitItemShape = z.object({
  top: z.any().nullable().optional(),
  bottom: z.any().nullable().optional(),
  shoes: z.any().nullable().optional(),
  accessory: z.any().nullable().optional(),
});

const saveOutfitSchema = z.object({
  name: z.string().trim().optional(),
  items: outfitItemShape.optional(),
});

const plannerSchema = z.object({
  date: z.string().trim().min(1),
  outfitId: z.string().trim().min(1),
});

const wearLogSchema = z.object({
  outfitId: z.string().trim().optional(),
  date: z.string().trim().optional(),
  itemIds: z.array(z.string().trim().min(1)).optional(),
});

const recommendationSchema = z.object({
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  occasion: z.string().trim().optional(),
});

const configSchema = z.object({
  categories: z.array(z.string().trim().min(1)).optional(),
  occasionTags: z.array(z.string().trim().min(1)).optional(),
  seasonTags: z.array(z.string().trim().min(1)).optional(),
  styleTags: z.array(z.string().trim().min(1)).optional(),
});

const weatherQuerySchema = z.object({
  city: z.string().trim().min(1),
  country: z.string().trim().optional(),
});

const suggestionSchema = z.object({
  occasion: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
});

const feedbackSchema = z.object({
  outfitItemIds: z.array(z.string().trim().min(1)).min(1),
  liked: z.boolean(),
});

const assistantChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .max(12)
    .optional(),
});

function parseWithSchema(schema, input) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const pathText = first.path.length ? `${first.path.join(".")}: ` : "";
    throw new HttpError(400, `${pathText}${first.message}`);
  }
  return parsed.data;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function requestOllamaChat({ message, history = [] }) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const systemPrompt = {
      role: "system",
      content:
        "You are ThreadLabs Assistant. Provide concise, practical wardrobe and outfit advice based on user context. Format responses in clean Markdown with short sections, numbered or bulleted lists, and clear headings. Avoid long dense paragraphs.",
    };
    const messages = [systemPrompt, ...history, { role: "user", content: message }];
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
      }),
      signal: timeoutController.signal,
    });

    // Older Ollama versions may not support /api/chat yet.
    if (response.status === 404) {
      const prompt = messages
        .map((row) => `${row.role.toUpperCase()}: ${row.content}`)
        .join("\n\n");

      const fallbackRes = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
        }),
        signal: timeoutController.signal,
      });

      let fallbackPayload = null;
      try {
        fallbackPayload = await fallbackRes.json();
      } catch {
        fallbackPayload = null;
      }

      if (!fallbackRes.ok) {
        const reason = String(fallbackPayload?.error || "").toLowerCase();
        if (reason.includes("model") && reason.includes("not found")) {
          throw new HttpError(400, `Ollama model \"${OLLAMA_MODEL}\" not found. Run: ollama pull ${OLLAMA_MODEL}`);
        }
        throw new HttpError(502, fallbackPayload?.error || "Ollama request failed");
      }

      const text = String(fallbackPayload?.response || "").trim();
      if (!text) {
        throw new HttpError(502, "Ollama returned an empty response");
      }
      return text;
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const reason = String(payload?.error || "").toLowerCase();
      if (reason.includes("model") && reason.includes("not found")) {
        throw new HttpError(400, `Ollama model \"${OLLAMA_MODEL}\" not found. Run: ollama pull ${OLLAMA_MODEL}`);
      }
      throw new HttpError(502, payload?.error || "Ollama request failed");
    }

    const text = String(payload?.message?.content || "").trim();
    if (!text) {
      throw new HttpError(502, "Ollama returned an empty response");
    }
    return text;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new HttpError(504, "Ollama request timed out");
    }
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(502, "Unable to reach Ollama. Is it running?");
  } finally {
    clearTimeout(timeoutId);
  }
}

app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOriginList.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new HttpError(403, "Origin not allowed by CORS"));
    },
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use("/uploads", express.static(UPLOAD_DIR, { index: false, maxAge: "1d" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/assistant/status", (_req, res) => {
  res.json({
    enabled: OLLAMA_ENABLED,
    provider: "ollama",
    model: OLLAMA_MODEL,
  });
});

app.post(
  "/api/assistant/chat",
  asyncHandler(async (req, res) => {
    if (!OLLAMA_ENABLED) {
      throw new HttpError(503, "Assistant is disabled. Set OLLAMA_ENABLED=true to enable it.");
    }

    const payload = parseWithSchema(assistantChatSchema, req.body || {});
    const reply = await requestOllamaChat({
      message: payload.message,
      history: payload.history || [],
    });

    return res.json({
      reply,
      model: OLLAMA_MODEL,
      provider: "ollama",
    });
  }),
);

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

app.post(
  "/api/outfits/saved",
  asyncHandler(async (req, res) => {
    const payload = parseWithSchema(saveOutfitSchema, req.body || {});
    const name = String(payload.name || "").trim() || "Untitled Outfit";
    const normalized = normalizeOutfitItems(payload.items);

    const next = await mutateDb((db) => {
      const row = {
        id: uuidv4(),
        name,
        items: normalized,
        createdAt: new Date().toISOString(),
      };
      db.outfits.push(row);
      return row;
    });

    return res.status(201).json(next);
  }),
);

app.put(
  "/api/outfits/saved/:id",
  asyncHandler(async (req, res) => {
    const { id } = parseWithSchema(idParamSchema, req.params);
    const payload = parseWithSchema(saveOutfitSchema, req.body || {});

    const next = await mutateDb((db) => {
      const idx = db.outfits.findIndex((outfit) => outfit.id === id);
      if (idx === -1) {
        throw new HttpError(404, "Outfit not found");
      }

      const current = db.outfits[idx];
      const updated = {
        ...current,
        name: String(payload.name || current.name || "Untitled Outfit").trim() || "Untitled Outfit",
        items: normalizeOutfitItems(payload.items || current.items),
        updatedAt: new Date().toISOString(),
      };
      db.outfits[idx] = updated;
      return updated;
    });

    return res.json(next);
  }),
);

app.post(
  "/api/outfits/saved/:id/duplicate",
  asyncHandler(async (req, res) => {
    const { id } = parseWithSchema(idParamSchema, req.params);
    const payload = parseWithSchema(saveOutfitSchema, req.body || {});

    const next = await mutateDb((db) => {
      const found = db.outfits.find((outfit) => outfit.id === id);
      if (!found) {
        throw new HttpError(404, "Outfit not found");
      }

      const row = {
        ...found,
        id: uuidv4(),
        name: String(payload.name || `${found.name} Copy`).trim() || `${found.name} Copy`,
        items: normalizeOutfitItems(payload.items || found.items),
        createdAt: new Date().toISOString(),
        duplicatedFromId: found.id,
      };

      db.outfits.push(row);
      return row;
    });

    return res.status(201).json(next);
  }),
);

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

app.post(
  "/api/planner",
  asyncHandler(async (req, res) => {
    const payload = parseWithSchema(plannerSchema, req.body || {});
    const date = normalizeDateKey(payload.date);
    const outfitId = payload.outfitId;
    if (!date) {
      throw new HttpError(400, "date must be a valid date");
    }

    const next = await mutateDb((db) => {
      const outfit = db.outfits.find((row) => row.id === outfitId);
      if (!outfit) {
        throw new HttpError(404, "Outfit not found");
      }

      const existing = db.outfitPlans.find((plan) => plan.date === date);
      const recentOutfits = db.outfitPlans
        .filter((plan) => plan.date !== date)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 7)
        .map((plan) => plan.outfitId);

      if (recentOutfits.includes(outfitId)) {
        throw new HttpError(409, "Avoid repeats: this outfit is planned recently");
      }

      const row = {
        id: existing?.id || uuidv4(),
        date,
        outfitId,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existing) {
        db.outfitPlans = db.outfitPlans.map((plan) => (plan.id === existing.id ? row : plan));
      } else {
        db.outfitPlans.push(row);
      }

      return {
        status: existing ? 200 : 201,
        row,
      };
    });

    return res.status(next.status).json(next.row);
  }),
);

app.delete(
  "/api/planner/:id",
  asyncHandler(async (req, res) => {
    const { id } = parseWithSchema(idParamSchema, req.params);

    await mutateDb((db) => {
      const before = db.outfitPlans.length;
      db.outfitPlans = db.outfitPlans.filter((row) => row.id !== id);
      if (db.outfitPlans.length === before) {
        throw new HttpError(404, "Plan not found");
      }
    });

    return res.status(204).send();
  }),
);

app.post(
  "/api/wear-log",
  asyncHandler(async (req, res) => {
    const payload = parseWithSchema(wearLogSchema, req.body || {});
    const outfitId = String(payload.outfitId || "").trim();
    const date = normalizeDateKey(payload.date || new Date().toISOString());
    const itemIds = Array.isArray(payload.itemIds) ? payload.itemIds.filter(Boolean) : [];

    if (!date) {
      throw new HttpError(400, "date must be a valid date");
    }
    if (!outfitId && itemIds.length === 0) {
      throw new HttpError(400, "outfitId or itemIds is required");
    }

    const next = await mutateDb((db) => {
      const row = {
        id: uuidv4(),
        outfitId: outfitId || null,
        itemIds,
        date,
        createdAt: new Date().toISOString(),
      };

      db.wearLogs.push(row);
      return row;
    });

    return res.status(201).json(next);
  }),
);

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

app.post(
  "/api/recommendation/daily",
  asyncHandler(async (req, res) => {
    const payload = parseWithSchema(recommendationSchema, req.body || {});
    const db = readDb();
    const city = String(payload.city || "").trim();
    const country = String(payload.country || "").trim();
    const occasion = String(payload.occasion || "casual").trim() || "casual";

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
  }),
);

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

function buildMissingItemSuggestions(items, _config, missingCategories, occasion) {
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

app.put(
  "/api/config",
  asyncHandler(async (req, res) => {
    const payload = parseWithSchema(configSchema, req.body || {});

    const next = await mutateDb((db) => {
      const nextConfig = sanitizeConfig(payload || {});
      if (
        nextConfig.categories.length === 0 ||
        nextConfig.occasionTags.length === 0 ||
        nextConfig.seasonTags.length === 0
      ) {
        throw new HttpError(400, "Categories, occasions, and seasons need at least one option");
      }

      db.config = nextConfig;
      return {
        ...db.config,
        lockedDefaults: DEFAULT_CONFIG,
      };
    });

    return res.json(next);
  }),
);

app.post(
  "/api/items",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, "Image is required");
    }

    const name = String(req.body.name || "").trim();
    const category = String(req.body.category || "").trim();
    const seasons = parseTags(req.body.seasons);
    const occasions = parseTags(req.body.occasions);
    const styleTags = parseTags(req.body.styleTags);
    const warmthLevel = Math.max(1, Math.min(5, Number(req.body.warmthLevel || 3)));

    if (!name || !category) {
      throw new HttpError(400, "Name and category are required");
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const item = await mutateDb(async (db) => {
      if (!db.config.categories.includes(category)) {
        throw new HttpError(400, "Invalid category for current config");
      }

      const embedding = await getImageEmbedding({
        imagePath: imageUrl,
        category,
        name,
        seasons,
        occasions,
      });

      const row = {
        id: uuidv4(),
        name,
        category,
        seasons,
        occasions,
        styleTags,
        warmthLevel,
        imageUrl,
        embedding,
        embeddingMeta: getEmbeddingMetadata(),
        createdAt: new Date().toISOString(),
      };
      db.items.push(row);
      return row;
    });

    return res.status(201).json(item);
  }),
);

app.delete(
  "/api/items/:id",
  asyncHandler(async (req, res) => {
    const { id } = parseWithSchema(idParamSchema, req.params);

    const found = await mutateDb((db) => {
      const row = db.items.find((item) => item.id === id);
      if (!row) {
        throw new HttpError(404, "Item not found");
      }

      db.items = db.items.filter((item) => item.id !== id);
      return row;
    });

    if (found.imageUrl) {
      const imagePath = path.resolve(UPLOAD_DIR, path.basename(found.imageUrl));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    return res.status(204).send();
  }),
);

app.get(
  "/api/weather",
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(weatherQuerySchema, req.query || {});
    const weather = await getWeatherByLocation({ city: query.city, country: query.country || "" });
    return res.json(weather);
  }),
);

app.post(
  "/api/suggestions",
  asyncHandler(async (req, res) => {
    const payload = parseWithSchema(suggestionSchema, req.body || {});
    const db = readDb();

    let weather = null;
    if (payload.city) {
      weather = await getWeatherByLocation({
        city: String(payload.city),
        country: String(payload.country || ""),
      });
    }

    const occasion = String(payload.occasion || "").trim() || null;
    const result = buildSuggestions(db.items, {
      occasion,
      weather,
      feedback: db.feedback,
    });

    const missingItemSuggestions = buildMissingItemSuggestions(
      db.items,
      db.config,
      result.missingCategories,
      occasion,
    );

    return res.json({
      weather,
      ...result,
      missingItemSuggestions,
    });
  }),
);

app.get("/api/outfits/random", (_req, res) => {
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

app.post(
  "/api/feedback",
  asyncHandler(async (req, res) => {
    const payload = parseWithSchema(feedbackSchema, req.body || {});

    await mutateDb((db) => {
      db.feedback.push({
        id: uuidv4(),
        outfitItemIds: payload.outfitItemIds,
        liked: payload.liked,
        createdAt: new Date().toISOString(),
      });
    });

    return res.status(201).json({ ok: true });
  }),
);

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Image is too large. Maximum size is 8MB." });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  return res.status(500).json({ error: error?.message || "Internal server error" });
});

export { app };

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`threadlabs API listening on http://localhost:${PORT}`);
  });
}
