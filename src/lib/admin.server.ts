export async function isAdminUser(ctx: { supabase: any; userId: string }): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function assertAdmin(ctx: { supabase: any; userId: string }) {
  if (!(await isAdminUser(ctx))) throw new Error("FORBIDDEN");
}