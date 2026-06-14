import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readDb, writeDb } from "./db.js";

describe("db", () => {
  let tempDir;
  let dbPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dressup-db-"));
    dbPath = path.join(tempDir, "data", "db.json");
    process.env.DB_PATH = dbPath;
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates normalized db when missing", () => {
    const db = readDb();
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(Array.isArray(db.items)).toBe(true);
    expect(Array.isArray(db.feedback)).toBe(true);
    expect(db.config.categories).toContain("top");
  });

  it("writes and reads persisted data", () => {
    const next = {
      items: [{ id: "1", name: "Shirt", category: "top" }],
      outfits: [],
      outfitPlans: [],
      wearLogs: [],
      feedback: [],
      config: {
        categories: ["top", "bottom", "shoes", "accessory"],
        occasionTags: ["casual"],
        seasonTags: ["summer"],
        styleTags: ["minimal"],
      },
    };

    writeDb(next);
    const db = readDb();
    expect(db.items).toHaveLength(1);
    expect(db.items[0].name).toBe("Shirt");
  });
});
