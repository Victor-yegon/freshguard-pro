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

type ReverseGeocodeResponse = {
  results?: Array<{
    name?: string;
    admin1?: string;
    country?: string;
  }>;
};

type NominatimReverseResponse = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

export type WeatherSnapshot = {
  latitude: number;
  longitude: number;
  timezone: string;
  locationName: string | null;
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
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.searchParams.set("latitude", String(data.latitude));
    weatherUrl.searchParams.set("longitude", String(data.longitude));
    weatherUrl.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    );
    weatherUrl.searchParams.set("timezone", "auto");

    const [weatherResponse, geoResponse, nominatimResponse] = await Promise.all([
      safeFetch(weatherUrl.toString(), {
        headers: {
          Accept: "application/json",
        },
      }),
      safeFetch(
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${data.latitude}&longitude=${data.longitude}&count=1&language=en`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      ),
      safeFetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${data.latitude}&lon=${data.longitude}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "FoodSafeMonitor/1.0",
          },
        },
      ),
    ]);

    if (!weatherResponse || !weatherResponse.ok) {
      throw new Error(
        `Open-Meteo request failed with status ${weatherResponse?.status ?? "unknown"}.`,
      );
    }

    const payload = (await weatherResponse.json()) as OpenMeteoResponse;
    const geoPayload = geoResponse?.ok ? ((await geoResponse.json()) as ReverseGeocodeResponse) : {};
    const nominatimPayload = nominatimResponse?.ok
      ? ((await nominatimResponse.json()) as NominatimReverseResponse)
      : {};
    const current = payload.current ?? {};
    const firstLocation = geoPayload.results?.[0];
    const nominatimAddress = nominatimPayload.address;
    const openMeteoName = firstLocation
      ? [firstLocation.name, firstLocation.admin1, firstLocation.country].filter(Boolean).join(", ")
      : null;
    const nominatimName = nominatimAddress
      ? [
          nominatimAddress.city ?? nominatimAddress.town ?? nominatimAddress.village,
          nominatimAddress.suburb ?? nominatimAddress.county ?? nominatimAddress.state,
          nominatimAddress.country,
        ]
          .filter(Boolean)
          .join(", ")
      : null;
    const timezoneFallback = payload.timezone
      ? payload.timezone.split("/").pop()?.replace(/_/g, " ") ?? null
      : null;
    const locationName = openMeteoName || nominatimName || timezoneFallback || null;

    return {
      latitude: payload.latitude,
      longitude: payload.longitude,
      timezone: payload.timezone,
      locationName,
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

async function safeFetch(input: string, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    return null;
  }
}
