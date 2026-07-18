import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- Profile ----------
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load profile");
    return data;
  });

const ProfileInput = z.object({
  full_name: z.string().trim().max(100).optional().nullable(),
  village: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  language: z.string().max(5).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error("Could not save profile");
    return { ok: true };
  });

// ---------- Fields ----------
export const listFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("fields")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load fields");
    return data ?? [];
  });

const FieldInput = z.object({
  name: z.string().trim().min(1).max(100),
  crop: z.string().trim().max(50).optional().nullable(),
  area_acres: z.number().nonnegative().max(100000).optional().nullable(),
  soil_type: z.string().trim().max(50).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

export const addField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FieldInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("fields")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error("Could not add field");
    return { ok: true };
  });

export const deleteField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("fields")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not delete field");
    return { ok: true };
  });

// ---------- Yields ----------
export const listYields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("crop_yields")
      .select("*")
      .eq("user_id", context.userId)
      .order("harvest_date", { ascending: false, nullsFirst: false });
    if (error) throw new Error("Could not load yields");
    return data ?? [];
  });

const YieldInput = z.object({
  crop: z.string().trim().min(1).max(50),
  season: z.string().trim().max(30).optional().nullable(),
  sowing_date: z.string().optional().nullable(),
  harvest_date: z.string().optional().nullable(),
  area_acres: z.number().nonnegative().max(100000).optional().nullable(),
  yield_kg: z.number().nonnegative().max(1e8).optional().nullable(),
  income_inr: z.number().nonnegative().max(1e10).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  field_id: z.string().uuid().optional().nullable(),
});

export const addYield = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => YieldInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("crop_yields")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error("Could not save yield record");
    return { ok: true };
  });

export const deleteYield = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("crop_yields")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not delete record");
    return { ok: true };
  });

// ---------- Rating ----------
export const getMyRating = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("app_ratings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

const RatingInput = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().nullable(),
});

export const saveRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RatingInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("app_ratings")
      .upsert({
        user_id: context.userId,
        stars: data.stars,
        comment: data.comment ?? null,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error("Could not save rating");
    return { ok: true };
  });

// ---------- History ----------
export const listAdviceHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("advice_history")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const listDiagnosisHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("diagnosis_history")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const saveAdviceHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      crop: z.string().max(50),
      language: z.string().max(5),
      advice: z.string().max(4000),
      verdict: z.string().max(100).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await context.supabase.from("advice_history").insert({ ...data, user_id: context.userId });
    return { ok: true };
  });

export const saveDiagnosisHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      crop: z.string().max(50),
      language: z.string().max(5),
      diagnosis: z.string().max(4000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await context.supabase.from("diagnosis_history").insert({ ...data, user_id: context.userId });
    return { ok: true };
  });
