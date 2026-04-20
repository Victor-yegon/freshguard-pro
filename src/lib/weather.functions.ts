import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const WeatherInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: {
    time: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
};

export type WeatherSnapshot = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature_2m: number | null;
    relative_humidity_2m: number | null;
    wind_speed_10m: number | null;
    weather_code: number | null;
  };
};

export const getWeatherForLocation = createServerFn({ method: "POST" })
  .inputValidator(WeatherInputSchema)
  .handler(async ({ data }) => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(data.latitude));
    url.searchParams.set("longitude", String(data.longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    );
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as OpenMeteoResponse;
    const current = payload.current ?? {};

    return {
      latitude: payload.latitude,
      longitude: payload.longitude,
      timezone: payload.timezone,
      current: {
        time: current.time ?? new Date().toISOString(),
        temperature_2m:
          typeof current.temperature_2m === "number" ? current.temperature_2m : null,
        relative_humidity_2m:
          typeof current.relative_humidity_2m === "number" ? current.relative_humidity_2m : null,
        wind_speed_10m: typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null,
        weather_code: typeof current.weather_code === "number" ? current.weather_code : null,
      },
    } satisfies WeatherSnapshot;
  });
