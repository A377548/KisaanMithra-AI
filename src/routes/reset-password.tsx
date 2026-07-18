import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Sprout, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { readSavedLang, type LangCode } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Kisaan Mithra" },
      { name: "description", content: "Set a new password for your Kisaan Mithra farmer account." },
    ],
  }),
  component: ResetPasswordPage,
});

function copy(lang: LangCode, en: string, te: string) {
  return lang === "te" ? te : en;
}

function ResetPasswordPage() {
  const nav = useNavigate();
  const [lang, setLang] = useState<LangCode>("te");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setLang(readSavedLang());
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const params = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

    // Show recovery form if URL indicates recovery flow
    if (
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      params.get("code") ||
      hashParams.get("access_token")
    ) {
      setReady(true);
    }

    // Handle PKCE-style link (?code=...)
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("exchange code error", error);
          setError(copy(readSavedLang(), "This reset link is invalid or expired. Please request a new one.", "ఈ రీసెట్ లింక్ చెల్లదు లేదా గడువు ముగిసింది. దయచేసి కొత్తది అడగండి."));
        } else {
          setReady(true);
        }
      });
    }

    // Supabase fires PASSWORD_RECOVERY after parsing the recovery hash
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Fallback: if a session already exists (link was auto-processed), allow reset
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (password !== confirm) {
      setError(copy(lang, "Passwords do not match.", "పాస్‌వర్డ్‌లు సరిపోలడం లేదు."));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage(copy(lang, "Password updated. Taking you to your dashboard...", "పాస్‌వర్డ్ మార్చబడింది. మీ డాష్‌బోర్డ్‌కు తీసుకెళ్తున్నాం..."));
      setTimeout(() => void nav({ to: "/dashboard" }), 700);
    } catch (err) {
      console.error("password reset error", err);
      setError(copy(lang, "This reset link is invalid or expired. Please request a new one.", "ఈ రీసెట్ లింక్ చెల్లదు లేదా గడువు ముగిసింది. దయచేసి కొత్తది అడగండి."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md field-card p-7">
        <Link to="/" className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow">
            <Sprout className="w-6 h-6" />
          </div>
          <div className="text-xl font-bold text-primary leading-none">Kisaan Mithra</div>
        </Link>
        <h1 className="text-2xl font-bold mb-2">{copy(lang, "Set new password", "కొత్త పాస్‌వర్డ్ పెట్టండి")}</h1>
        {!ready ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{copy(lang, "Open this page from the password reset email link.", "పాస్‌వర్డ్ రీసెట్ ఇమెయిల్ లింక్ నుండి ఈ పేజీని తెరవండి.")}</p>
            <Link to="/auth" className="big-btn w-full">{copy(lang, "Back to sign in", "సైన్ ఇన్‌కు తిరిగి వెళ్లండి")}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={6}
                maxLength={72}
                placeholder={copy(lang, "New password", "కొత్త పాస్‌వర్డ్")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-card focus:border-primary focus:outline-none"
              />
              <button type="button" onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? copy(lang, "Hide password", "పాస్‌వర్డ్ దాచు") : copy(lang, "Show password", "పాస్‌వర్డ్ చూపు")}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                minLength={6}
                maxLength={72}
                placeholder={copy(lang, "Confirm password", "పాస్‌వర్డ్ మళ్లీ నమోదు చేయండి")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-card focus:border-primary focus:outline-none"
              />
              <button type="button" onClick={() => setShowConfirm((s) => !s)}
                aria-label={showConfirm ? copy(lang, "Hide password", "పాస్‌వర్డ్ దాచు") : copy(lang, "Show password", "పాస్‌వర్డ్ చూపు")}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-primary">{message}</p>}
            <button type="submit" disabled={loading} className="big-btn w-full disabled:opacity-60">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {copy(lang, "Update password", "పాస్‌వర్డ్ మార్చండి")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}