import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertAdmin, isAdminUser } from "./admin.server";

// ---------- Role helpers ----------
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { admin: await isAdminUser(context) };
  });

// ---------- Farmers (all profiles) ----------
export const listFarmers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, village, state, language, phone, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load farmers");
    return data ?? [];
  });

// ---------- Admin crops ----------
const CropInput = z.object({
  crop_id: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/i),
  en_name: z.string().trim().min(1).max(60),
  emoji: z.string().trim().max(8).optional().nullable(),
  names: z.record(z.string(), z.string().max(80)).optional().nullable(),
});

export const listAdminCrops = createServerFn({ method: "GET" })
  .handler(async () => {
    // public read: crops list should be visible to farmers too
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY!;
    const sb = createClient(url, key);
    const { data, error } = await sb
      .from("admin_crops")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return [];
    return data ?? [];
  });

export const addAdminCrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CropInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("admin_crops").insert({
      crop_id: data.crop_id,
      name_en: data.en_name,
      emoji: data.emoji ?? "🌱",
      names: (data.names ?? {}) as any,
      created_by: context.userId,
    });
    if (error) throw new Error("Could not add crop");
    return { ok: true };
  });

export const deleteAdminCrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("admin_crops").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete crop");
    return { ok: true };
  });

// ---------- Diagnosis feedback ----------
const FeedbackInput = z.object({
  diagnosis_id: z.string().uuid(),
  helpful: z.boolean(),
  comment: z.string().trim().max(500).optional().nullable(),
});

export const submitDiagnosisFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FeedbackInput.parse(d))
  .handler(async ({ context, data }) => {
    // Defense in depth: verify the caller owns the referenced diagnosis
    const { data: diag, error: diagErr } = await context.supabase
      .from("diagnosis_history")
      .select("id, user_id")
      .eq("id", data.diagnosis_id)
      .maybeSingle();
    if (diagErr || !diag || diag.user_id !== context.userId) {
      throw new Error("FORBIDDEN");
    }
    const { error } = await context.supabase.from("diagnosis_feedback").insert({
      diagnosis_id: data.diagnosis_id,
      user_id: context.userId,
      helpful: data.helpful,
      comment: data.comment ?? null,
    });
    if (error) throw new Error("Could not save feedback");
    return { ok: true };
  });

export const listDiagnosisFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("diagnosis_feedback")
      .select("id, helpful, comment, created_at, diagnosis_id, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load feedback");
    return data ?? [];
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [farmers, diag, fb] = await Promise.all([
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("diagnosis_history").select("id", { count: "exact", head: true }),
      context.supabase.from("diagnosis_feedback").select("id", { count: "exact", head: true }),
    ]);
    return {
      farmers: farmers.count ?? 0,
      diagnoses: diag.count ?? 0,
      feedback: fb.count ?? 0,
    };
  });
