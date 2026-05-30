import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), "data", "db.json");
export const DEFAULT_CONFIG = {
  categories: ["top", "bottom", "shoes", "accessory"],
  occasionTags: ["casual", "office", "date-night", "formal", "athleisure"],
  seasonTags: ["spring", "summer", "fall", "winter"],
  styleTags: ["minimal", "streetwear", "classic", "sporty"],
};

function uniqueStrings(list) {
  return Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function withRequiredDefaults(list, defaults) {
  return uniqueStrings([...(Array.isArray(defaults) ? defaults : []), ...(Array.isArray(list) ? list : [])]);
}

function normalizeDb(db) {
  const next = db || {};
  next.items = Array.isArray(next.items) ? next.items : [];
  next.outfits = Array.isArray(next.outfits) ? next.outfits : [];
  next.outfitPlans = Array.isArray(next.outfitPlans) ? next.outfitPlans : [];
  next.wearLogs = Array.isArray(next.wearLogs) ? next.wearLogs : [];
  next.feedback = Array.isArray(next.feedback) ? next.feedback : [];

  const incomingConfig = next.config || {};
  next.config = {
    categories: withRequiredDefaults(incomingConfig.categories, DEFAULT_CONFIG.categories),
    occasionTags: withRequiredDefaults(incomingConfig.occasionTags, DEFAULT_CONFIG.occasionTags),
    seasonTags: withRequiredDefaults(incomingConfig.seasonTags, DEFAULT_CONFIG.seasonTags),
    styleTags: withRequiredDefaults(incomingConfig.styleTags, DEFAULT_CONFIG.styleTags),
  };

  return next;
}

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(normalizeDb({}), null, 2),
      "utf-8",
    );
  }
}

export function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  const db = normalizeDb(JSON.parse(raw));
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  return db;
}

export function writeDb(nextDb) {
  ensureDbFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(nextDb, null, 2), "utf-8");
}
