import { describe, expect, it } from "vitest";
import { cosineSimilarity, getEmbeddingMetadata, getImageEmbedding } from "./embedding.js";

describe("embedding", () => {
  it("returns deterministic normalized vectors", async () => {
    const payload = {
      imagePath: "/uploads/a.jpg",
      category: "top",
      name: "Oxford Shirt",
      seasons: ["spring"],
      occasions: ["casual"],
    };

    const a = await getImageEmbedding(payload);
    const b = await getImageEmbedding(payload);

    expect(a).toHaveLength(24);
    expect(b).toEqual(a);

    const magnitude = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1, 8);
  });

  it("computes cosine similarity and handles invalid vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
    expect(cosineSimilarity(null, [1, 2])).toBe(0);
  });

  it("returns embedding provider metadata", () => {
    const meta = getEmbeddingMetadata();
    expect(meta.version).toBe("1");
    expect(["deterministic", "external"]).toContain(meta.provider);
    expect(typeof meta.model).toBe("string");
  });
});
