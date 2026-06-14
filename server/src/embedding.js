import crypto from "node:crypto";

const VECTOR_SIZE = 24;

function embeddingProvider() {
  const explicit = String(process.env.EMBEDDING_PROVIDER || "").trim().toLowerCase();
  if (explicit === "deterministic" || explicit === "hash") {
    return "deterministic";
  }
  if (explicit === "external" || explicit === "hosted") {
    return "external";
  }
  return process.env.HF_API_TOKEN ? "external" : "deterministic";
}

function hashToFloats(input, count) {
  const digest = crypto.createHash("sha256").update(input).digest();
  const values = [];
  for (let i = 0; i < count; i += 1) {
    const byte = digest[i % digest.length];
    values.push((byte / 255) * 2 - 1);
  }
  return values;
}

function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

export async function getImageEmbedding({ imagePath, category, name, seasons, occasions }) {
  const provider = embeddingProvider();

  // Placeholder for hosted image embedding. In MVP we use deterministic vectors unless API wiring is added.
  if (provider === "external") {
    const hostedSeed = `${imagePath}:${category}:${name}:${seasons.join("|")}:${occasions.join("|")}`;
    return normalize(hashToFloats(`hosted:${hostedSeed}`, VECTOR_SIZE));
  }

  const seed = `${imagePath}:${category}:${name}:${seasons.join("|")}:${occasions.join("|")}`;
  return normalize(hashToFloats(seed, VECTOR_SIZE));
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}

export function getEmbeddingMetadata() {
  const provider = embeddingProvider();
  return {
    provider,
    model: provider === "external" ? (process.env.EMBEDDING_MODEL || "hf-hosted-placeholder") : "deterministic-hash-v1",
    version: "1",
  };
}
