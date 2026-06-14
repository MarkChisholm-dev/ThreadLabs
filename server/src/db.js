import fs from "node:fs";
import path from "node:path";

let writeQueue = Promise.resolve();

function getDbPath() {
  if (process.env.DB_PATH) {
    return path.resolve(process.env.DB_PATH);
  }
  return path.resolve(process.cwd(), "data", "db.json");
}

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
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(
      dbPath,
      JSON.stringify(normalizeDb({}), null, 2),
      "utf-8",
    );
  }
}

function writeDbAtomic(dbPath, data) {
  const tmpPath = `${dbPath}.tmp`;
  fs.writeFileSync(tmpPath, data, "utf-8");
  fs.renameSync(tmpPath, dbPath);
}

export function readDb() {
  ensureDbFile();
  const dbPath = getDbPath();
  const raw = fs.readFileSync(dbPath, "utf-8");
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const db = normalizeDb(parsed);
  return db;
}

export function writeDb(nextDb) {
  ensureDbFile();
  const dbPath = getDbPath();
  writeDbAtomic(dbPath, JSON.stringify(normalizeDb(nextDb), null, 2));
}

export async function mutateDb(mutator) {
  const runMutation = async () => {
    const current = readDb();
    const before = JSON.stringify(current);
    const result = await mutator(current);
    const normalized = normalizeDb(current);
    const after = JSON.stringify(normalized);

    if (before !== after) {
      writeDb(normalized);
    }

    return result;
  };

  writeQueue = writeQueue.then(runMutation, runMutation);
  return writeQueue;
}
