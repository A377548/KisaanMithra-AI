import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getIrrigationAdvice } from "@/lib/farming.functions";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const LangSchema = z.enum(["en", "hi", "mr", "ta", "te", "kn", "bn", "pa"]);

export default defineTool({
  name: "get_irrigation_advice",
  title: "Get irrigation advice",
  description:
    "Get AI-generated irrigation advice (whether to water today, when rain is expected, how much) for a farm. Provide either a saved field_id, or crop + lat + lon directly. Reply language defaults to the farmer's saved profile language.",
  inputSchema: {
    field_id: z
      .string()
      .uuid()
      .optional()
      .describe("UUID of a saved field from list_fields. Overrides crop/lat/lon if given."),
    crop: z.string().min(1).max(50).optional().describe("Crop name, e.g. 'tomato', 'wheat'."),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    language: LangSchema.optional().describe("Response language code."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);

    let crop = input.crop;
    let lat = input.lat;
    let lon = input.lon;

    if (input.field_id) {
      const { data, error } = await sb
        .from("fields")
        .select("crop,lat,lng")
        .eq("id", input.field_id)
        .eq("user_id", ctx.getUserId())
        .maybeSingle();
      if (error || !data) {
        return { content: [{ type: "text", text: "Field not found" }], isError: true };
      }
      crop = data.crop;
      lat = Number(data.lat);
      lon = Number(data.lng);
    }

    if (!crop || lat === undefined || lon === undefined) {
      return {
        content: [
          { type: "text", text: "Provide field_id, or all of crop, lat, and lon." },
        ],
        isError: true,
      };
    }

    let language = input.language;
    if (!language) {
      const { data: profile } = await sb
        .from("profiles")
        .select("language")
        .eq("id", ctx.getUserId())
        .maybeSingle();
      language = (profile?.language as typeof language) ?? "en";
    }

    const result = await getIrrigationAdvice({ data: { crop, lat, lon, language } });

    // Persist to advice history so it shows up in the farmer's dashboard.
    await sb.from("advice_history").insert({
      user_id: ctx.getUserId(),
      crop,
      language,
      advice: result.advice,
      verdict: null,
    });

    return {
      content: [{ type: "text", text: result.advice }],
      structuredContent: { advice: result.advice, weather: result.weather },
    };
  },
});
