import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("api", () => {
  let app;
  let tempDir;

  beforeEach(async () => {
    vi.resetModules();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dressup-api-"));
    process.env.DB_PATH = path.join(tempDir, "data", "db.json");
    process.env.UPLOAD_DIR = path.join(tempDir, "uploads");
    process.env.OLLAMA_ENABLED = "false";

    ({ app } = await import("./index.js"));
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    delete process.env.UPLOAD_DIR;
    delete process.env.OLLAMA_ENABLED;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns health status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("exposes assistant status and disabled behavior by default", async () => {
    const status = await request(app).get("/api/assistant/status");
    expect(status.status).toBe(200);
    expect(status.body.enabled).toBe(false);

    const ask = await request(app)
      .post("/api/assistant/chat")
      .send({ message: "hello" });
    expect(ask.status).toBe(503);
  });

  it("creates and deletes item with image upload", async () => {
    const createRes = await request(app)
      .post("/api/items")
      .field("name", "Blue Shirt")
      .field("category", "top")
      .field("seasons", "spring")
      .field("occasions", "casual")
      .attach("image", Buffer.from("img"), "shirt.jpg");

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe("Blue Shirt");

    const listRes = await request(app).get("/api/items");
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);

    const imagePath = path.join(process.env.UPLOAD_DIR, path.basename(createRes.body.imageUrl));
    expect(fs.existsSync(imagePath)).toBe(true);

    const deleteRes = await request(app).delete(`/api/items/${createRes.body.id}`);
    expect(deleteRes.status).toBe(204);
    expect(fs.existsSync(imagePath)).toBe(false);
  });

  it("validates config payload", async () => {
    const merged = await request(app).put("/api/config").send({ categories: [] });
    expect(merged.status).toBe(200);
    expect(merged.body.categories).toContain("top");

    const good = await request(app).put("/api/config").send({
      categories: ["top", "bottom", "shoes", "accessory"],
      occasionTags: ["casual", "office"],
      seasonTags: ["spring", "summer"],
      styleTags: ["minimal"],
    });
    expect(good.status).toBe(200);
    expect(good.body.occasionTags).toContain("casual");
  });

  it("returns missing categories for suggestions", async () => {
    await request(app)
      .post("/api/items")
      .field("name", "Only Top")
      .field("category", "top")
      .field("seasons", "spring")
      .field("occasions", "casual")
      .attach("image", Buffer.from("img"), "only-top.jpg");

    const suggestionRes = await request(app)
      .post("/api/suggestions")
      .send({ occasion: "casual" });

    expect(suggestionRes.status).toBe(200);
    expect(suggestionRes.body.outfits).toEqual([]);
    expect(suggestionRes.body.missingCategories).toEqual(["bottom", "shoes"]);
  });

  it("rejects unsupported upload mime type", async () => {
    const res = await request(app)
      .post("/api/items")
      .field("name", "Bad Upload")
      .field("category", "top")
      .attach("image", Buffer.from("text"), "notes.txt");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported image type/i);
  });

  it("supports planner and feedback flows", async () => {
    const top = await request(app)
      .post("/api/items")
      .field("name", "Top")
      .field("category", "top")
      .field("occasions", "casual")
      .attach("image", Buffer.from("img"), "top.jpg");
    const bottom = await request(app)
      .post("/api/items")
      .field("name", "Bottom")
      .field("category", "bottom")
      .field("occasions", "casual")
      .attach("image", Buffer.from("img"), "bottom.jpg");
    const shoes = await request(app)
      .post("/api/items")
      .field("name", "Shoes")
      .field("category", "shoes")
      .field("occasions", "casual")
      .attach("image", Buffer.from("img"), "shoes.jpg");

    const saveOutfit = await request(app)
      .post("/api/outfits/saved")
      .send({
        name: "Casual Fit",
        items: {
          top: top.body,
          bottom: bottom.body,
          shoes: shoes.body,
          accessory: null,
        },
      });
    expect(saveOutfit.status).toBe(201);

    const plan = await request(app)
      .post("/api/planner")
      .send({ date: "2026-06-21", outfitId: saveOutfit.body.id });
    expect(plan.status).toBe(201);

    const plannerRows = await request(app).get("/api/planner");
    expect(plannerRows.status).toBe(200);
    expect(plannerRows.body[0].outfitId).toBe(saveOutfit.body.id);

    const feedback = await request(app)
      .post("/api/feedback")
      .send({ outfitItemIds: [top.body.id, bottom.body.id, shoes.body.id], liked: true });
    expect(feedback.status).toBe(201);
  });
});
