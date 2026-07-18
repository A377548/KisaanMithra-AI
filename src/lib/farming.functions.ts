import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { LANG_NAME_FOR_AI, type LangCode } from "./i18n";

const LangSchema = z.enum(["en", "hi", "mr", "ta", "te", "kn", "bn", "pa"]);

function requireKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    console.error("[farming] Missing LOVABLE_API_KEY environment variable");
    throw new Error("Service temporarily unavailable");
  }
  return key;
}

const IrrigationInput = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  crop: z.string().trim().min(1).max(50),
  language: LangSchema,
});

export const getIrrigationAdvice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IrrigationInput.parse(d))
  .handler(async ({ data }) => {
    const { lat, lon, language } = data;
    // Sanitize free-text crop before injecting into the AI prompt:
    // strip newlines, backticks, and control chars to mitigate prompt injection.
    const crop = data.crop.replace(/[\r\n`]+/g, " ").replace(/[^\p{L}\p{N}\s/&+.,-]/gu, "").slice(0, 50);

    // Open-Meteo: free, no key. Current + 3-day forecast.
    // Try multiple mirrors; free tier rate-limits shared serverless IPs aggressively.
    const qs = `latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=3`;
    const hosts = [
      "https://api.open-meteo.com/v1/forecast",
      "https://api.open-meteo.com/v1/forecast",
      "https://api.open-meteo.com/v1/forecast",
    ];
    let wxRes: Response | null = null;
    for (let attempt = 0; attempt < hosts.length; attempt++) {
      try {
        wxRes = await fetch(`${hosts[attempt]}?${qs}`, {
          headers: { "User-Agent": "KisaanMithra/1.0 (farming advisor)" },
        });
      } catch (e) {
        console.error("[farming] Weather fetch network error", e);
        wxRes = null;
      }
      if (wxRes && wxRes.ok) break;
      if (wxRes && wxRes.status !== 429 && wxRes.status < 500) break;
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600 * (attempt + 1)));
    }

    type Wx = {
      current: { temperature_2m: number; relative_humidity_2m: number; precipitation: number; wind_speed_10m: number };
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        precipitation_probability_max: number[];
      };
    };

    let wx: Wx | null = null;
    if (wxRes && wxRes.ok) {
      wx = (await wxRes.json()) as Wx;
    } else {
      console.error("[farming] Weather fetch failed, proceeding without weather", wxRes?.status);
    }

    const cur = wx?.current;
    const d = wx?.daily;
    const weatherSummary = wx && cur && d
      ? `Current: ${cur.temperature_2m}°C, humidity ${cur.relative_humidity_2m}%, ` +
        `precipitation now ${cur.precipitation}mm, wind ${cur.wind_speed_10m} km/h.\n` +
        d.time
          .map(
            (day, i) =>
              `${day}: ${d.temperature_2m_min[i]}–${d.temperature_2m_max[i]}°C, rain ${d.precipitation_sum[i]}mm (chance ${d.precipitation_probability_max[i]}%)`
          )
          .join("\n")
      : `Weather data is temporarily unavailable. Give general seasonal irrigation guidance for ${crop} at this location, and gently mention that live weather could not be fetched right now so the farmer should also check the sky.`;


    const gateway = createLovableAiGatewayProvider(requireKey());
    const langName = LANG_NAME_FOR_AI[language as LangCode];

    const prompt = `You are an experienced agricultural advisor speaking directly to a smallholder farmer.

CROP: ${crop}
LOCATION: lat ${lat.toFixed(3)}, lon ${lon.toFixed(3)}
WEATHER DATA (next 3 days):
${weatherSummary}

Based on this, decide whether the farmer should irrigate TODAY. Consider expected rainfall in the next 48 hours, temperature, humidity, and the typical water needs of ${crop}.

Reply ENTIRELY in ${langName}. Use simple words a village farmer would understand. Do NOT mix English words. Structure your answer as plain text with these sections (translate the section names too):

1. A clear ONE-LINE verdict: WATER TODAY or DO NOT WATER (rain coming) or LIGHT WATERING ONLY.
2. WHY (2-3 short sentences explaining based on weather).
3. WHEN (best time of day to water, or when rain is expected).
4. HOW MUCH (rough guidance for ${crop}).

Keep total response under 150 words. Be warm and respectful.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });

    return {
      advice: text,
      weather: cur && d
        ? {
            tempC: cur.temperature_2m,
            humidity: cur.relative_humidity_2m,
            rainNext3Days: d.precipitation_sum,
            rainChanceNext3Days: d.precipitation_probability_max,
            days: d.time,
          }
        : null,
    };

  });

const DiseaseInput = z.object({
  // ~7 MB base64 ≈ ~5 MB decoded image; prevents oversized-payload abuse
  imageBase64: z.string().min(20).max(7_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  crop: z.string().trim().min(1).max(50),
  language: LangSchema,
});

export const diagnoseDisease = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DiseaseInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = createLovableAiGatewayProvider(requireKey());
    const langName = LANG_NAME_FOR_AI[data.language as LangCode];
    // Sanitize free-text crop before injecting into the AI prompt.
    const crop = data.crop.replace(/[\r\n`]+/g, " ").replace(/[^\p{L}\p{N}\s/&+.,-]/gu, "").slice(0, 50);

    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:${data.mimeType};base64,${data.imageBase64}`;

    const systemPrompt = `You are a plant pathologist helping a smallholder farmer. The farmer's crop is: ${crop}.

Look at the attached photo of the plant carefully. Identify any disease, pest damage, nutrient deficiency, or stress visible. If the plant looks healthy, say so clearly.

Reply ENTIRELY in ${langName} using simple words. Do NOT mix English (except brand names of pesticides which you may write in English in brackets). Structure as plain text with these sections (translate the section names):

1. DIAGNOSIS — name of the disease/problem in 1 line.
2. SYMPTOMS YOU SHOW — what you see in the photo (2-3 lines).
3. CAUSE — why it happened (1-2 lines).
4. TREATMENT — exact steps. Mention specific chemicals/medicines with dosage (e.g. "Mancozeb 75% WP, 2 grams per liter water, spray every 7 days"). Prefer affordable, locally available options. Also mention an organic alternative (neem oil etc).
5. PREVENTION — 2 short tips.

Keep total under 200 words. Be warm and respectful. If image is unclear or not a plant, ask the farmer to take a clearer photo of an affected leaf in daylight.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            { type: "image", image: dataUrl },
          ],
        },
      ],
    });

    return { diagnosis: text };
  });

const TtsInput = z.object({
  text: z.string().min(1).max(4000),
  language: LangSchema,
});

export const speak = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TtsInput.parse(d))
  .handler(async ({ data }) => {
    const key = requireKey();
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: data.text,
        voice: "alloy",
        response_format: "mp3",
        instructions: `Speak warmly and clearly in ${LANG_NAME_FOR_AI[data.language as LangCode]}, like a kind village elder advising a farmer. Speak at a slightly slower pace for clarity.`,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[farming] TTS failed", res.status, t);
      throw new Error("Service temporarily unavailable");
    }
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return { audioBase64: base64, mimeType: "audio/mpeg" };
  });
