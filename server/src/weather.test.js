import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWeatherByLocation } from "./weather.js";

describe("weather", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires a city", async () => {
    await expect(getWeatherByLocation({ city: "" })).rejects.toThrow("City is required");
  });

  it("returns weather and uses cache", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              name: "London",
              country: "United Kingdom",
              country_code: "GB",
              admin1: "England",
              latitude: 51.5,
              longitude: -0.12,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {
            temperature_2m: 19.5,
            weather_code: 3,
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const first = await getWeatherByLocation({ city: "London", country: "GB" });
    const second = await getWeatherByLocation({ city: "London", country: "GB" });

    expect(first.city).toBe("London");
    expect(first.temperatureC).toBe(19.5);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when geocode fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    await expect(getWeatherByLocation({ city: "Nowhere" })).rejects.toThrow("Unable to geocode city");
  });
});
