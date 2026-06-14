import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE, getAssistantStatus, getItems, removeOutfitPlan } from "./api.js";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses API_BASE for requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "1" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await getItems();

    expect(rows).toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/items`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns null for 204 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );

    const res = await removeOutfitPlan("abc");
    expect(res).toBeNull();
  });

  it("surfaces API error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Bad request payload" }),
      }),
    );

    await expect(getItems()).rejects.toThrow("Bad request payload");
  });

  it("loads assistant status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ enabled: true, model: "llama3.1:8b" }),
      }),
    );

    const data = await getAssistantStatus();
    expect(data.enabled).toBe(true);
    expect(data.model).toBe("llama3.1:8b");
  });
});
