import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sprout, Loader2, Eye, EyeOff } from "lucide-react";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import { LANGUAGES, T, readSavedLang, type LangCode } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Kisaan Mithra" },
      { name: "description", content: "Sign in or create your Kisaan Mithra farmer account to track crops, yields and history." },
    ],
  }),
  component: AuthPage,
});

// Only allow same-origin relative paths as post-auth targets.
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function t(key: keyof typeof T, lang: LangCode): string {
  const entry = T[key] as Record<string, string>;
  return entry?.[lang] ?? entry?.en ?? String(key);
}

async function ensureProfile(nameFallback: string | null, lang: LangCode) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("No active user after sign in");

  const fullName = String(
    userData.user.user_metadata?.full_name ||
      nameFallback ||
      userData.user.email?.split("@")[0] ||
      "Farmer",
  ).slice(0, 100);

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userData.user.id,
      full_name: fullName,
      language: lang,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) throw error;
}

function AuthPage() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const nextPath = safeNext(next);
  const [lang, setLang] = useState<LangCode>("te");
  useEffect(() => setLang(readSavedLang()), []);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("km_lang", lang); }, [lang]);

  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: nextPath ? `${window.location.origin}${nextPath}` : window.location.origin,
            data: { full_name: name, preferred_language: lang },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(lang === "en" ? "Account created. Please check your email, confirm your account, then sign in." : "ఖాతా సృష్టించబడింది. దయచేసి మీ ఇమెయిల్‌లో ధృవీకరించి, తర్వాత సైన్ ఇన్ చేయండి.");
          setMode("signin");
          return;
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice(lang === "en" ? "If this email has an account, a password reset link has been sent." : "ఈ ఇమెయిల్‌తో ఖాతా ఉంటే, పాస్‌వర్డ్ రీసెట్ లింక్ పంపబడింది.");
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("No active session after sign in");
      await ensureProfile(name || null, lang);
      if (nextPath) {
        window.location.href = nextPath;
        return;
      }
      await nav({ to: "/dashboard" });
    } catch (err) {
      // Do not leak raw auth errors to the UI — log only.
      console.error("auth error", err);
      const authError = err as { code?: string; message?: string };
      if (authError.code === "user_already_exists" || authError.message?.toLowerCase().includes("already registered")) {
        setMode("signin");
        setError(lang === "en" ? "This email already has an account. Sign in, or use Forgot password to reset it." : "ఈ ఇమెయిల్‌తో ఇప్పటికే ఖాతా ఉంది. సైన్ ఇన్ చేయండి లేదా పాస్‌వర్డ్ రీసెట్ చేయండి.");
      } else if (authError.code === "invalid_credentials" || authError.message?.toLowerCase().includes("invalid login")) {
        setError(lang === "en" ? "The email or password is not matching. Please use Forgot password to set a new password." : "ఇమెయిల్ లేదా పాస్‌వర్డ్ సరిపోలడం లేదు. కొత్త పాస్‌వర్డ్ పెట్టడానికి పాస్‌వర్డ్ రీసెట్ చేయండి.");
      } else {
        setError(mode === "signin"
          ? (lang === "en" ? "Could not sign in. Check your password, or reset it below." : "సైన్ ఇన్ కాలేదు. పాస్‌వర్డ్‌ను తనిఖీ చేయండి లేదా క్రింద రీసెట్ చేయండి.")
          : t("authError", lang));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md field-card p-7">
        <div className="flex items-center justify-between gap-3 mb-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold text-primary leading-none">Kisaan Mithra</div>
              <div className="text-xs text-muted-foreground mt-1">{t("authTagline", lang)}</div>
            </div>
          </Link>
          <select
            aria-label={t("authLanguage", lang)}
            value={lang}
            onChange={(e) => setLang(e.target.value as LangCode)}
            className="px-2 py-2 rounded-lg border border-border bg-card text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.native}</option>
            ))}
          </select>
        </div>

        <h1 className="text-2xl font-bold mb-1">
          {mode === "signin" ? t("authWelcomeBack", lang) : mode === "signup" ? t("authCreateAccount", lang) : (lang === "en" ? "Reset password" : "పాస్‌వర్డ్ రీసెట్")}
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          {mode === "signin" ? t("authSigninSubtitle", lang) : mode === "signup" ? t("authSignupSubtitle", lang) : (lang === "en" ? "Enter your email and we’ll send a secure reset link." : "మీ ఇమెయిల్ నమోదు చేయండి. సురక్షిత రీసెట్ లింక్ పంపుతాం.")}
        </p>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              required
              placeholder={t("authYourName", lang)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:border-primary focus:outline-none"
              maxLength={100}
            />
          )}
          <input
            type="email"
            required
            placeholder={t("authEmail", lang)}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:border-primary focus:outline-none"
            maxLength={255}
          />
          {mode !== "forgot" && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder={t("authPassword", lang)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-card focus:border-primary focus:outline-none"
                maxLength={72}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? (lang === "en" ? "Hide password" : "పాస్‌వర్డ్ దాచు") : (lang === "en" ? "Show password" : "పాస్‌వర్డ్ చూపు")}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-primary">{notice}</p>}
          <button type="submit" disabled={loading} className="big-btn w-full disabled:opacity-60">
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {mode === "signin" ? t("authSignIn", lang) : mode === "signup" ? t("authCreateBtn", lang) : (lang === "en" ? "Send reset link" : "రీసెట్ లింక్ పంపండి")}
          </button>
        </form>

        <div className="mt-4 text-center text-sm space-y-2">
          {mode === "signin" ? (
            <>
              <button onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className="text-primary font-semibold block mx-auto">
                {t("authSwitchToSignup", lang)}
              </button>
              <button onClick={() => { setMode("forgot"); setError(null); setNotice(null); }} className="text-muted-foreground font-semibold block mx-auto">
                {lang === "en" ? "Forgot password?" : "పాస్‌వర్డ్ మర్చిపోయారా?"}
              </button>
            </>
          ) : mode === "signup" ? (
            <button onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className="text-primary font-semibold">
              {t("authSwitchToSignin", lang)}
            </button>
          ) : (
            <button onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className="text-primary font-semibold">
              {lang === "en" ? "Back to sign in" : "సైన్ ఇన్‌కు తిరిగి వెళ్లండి"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
