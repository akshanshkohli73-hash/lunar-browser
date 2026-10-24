import { z } from "zod";
import {
  weatherRequestSchema,
  type WeatherRequest,
  type WeatherReading,
} from "../../shared/dashboard";
import { readResponseText } from "./response-text";
const reading = z.object({
  current: z.object({
    temperature_2m: z.number().min(-150).max(180),
    weather_code: z.number().int().min(0).max(99),
    time: z.string().min(10).max(40),
  }),
});
/** Fixed provider, no arbitrary URL/key bridge; only explicit per-request consent. */
export async function fetchWeather(
  input: WeatherRequest,
  transport: typeof fetch,
): Promise<WeatherReading> {
  const request = weatherRequestSchema.parse(input);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(request.latitude),
    longitude: String(request.longitude),
    current: "temperature_2m,weather_code",
    temperature_unit: request.units,
    timezone: "auto",
  }).toString();
  const response = await transport(url.href, {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok)
    throw new Error(
      `Weather is unavailable (HTTP ${response.status}). No location was inferred automatically.`,
    );
  const data = reading.safeParse(
    JSON.parse(await readResponseText(response, 32768)),
  );
  if (!data.success)
    throw new Error("The weather provider returned an unsupported response.");
  return {
    temperature: data.data.current.temperature_2m,
    code: data.data.current.weather_code,
    observedAt: data.data.current.time,
    units: request.units,
  };
}
