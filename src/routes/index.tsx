import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import "@fontsource/baloo-2/400.css";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import { Camera, Cloud, Droplets, Loader2, Globe, LayoutDashboard, LogIn, MapPin, Sparkles, Sprout, Volume2, Upload, Wind, ThermometerSun, X, RefreshCw } from "lucide-react";
import { CROPS, LANGUAGES, T, cropLabel, t, type LangCode } from "@/lib/i18n";
import { diagnoseDisease, getIrrigationAdvice, speak } from "@/lib/farming.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kisaan Mithra — AI farming companion in your language" },
      { name: "description", content: "AI-powered irrigation advice and instant plant disease diagnosis for Indian farmers — in Hindi, Tamil, Telugu, Marathi, Kannada, Bengali, Punjabi and more." },
      { property: "og:title", content: "Kisaan Mithra — AI for every farmer" },
      { property: "og:description", content: "Should I water today? What disease is on my plant? Get the answer in your language, with voice." },
    ],
  }),
  component: Home,
});

type Advice = Awaited<ReturnType<typeof getIrrigationAdvice>>;

function Home() {
  const [lang, setLang] = useState<LangCode>("te");
  const [crop, setCrop] = useState<string>("rice");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const adviceFn = useServerFn(getIrrigationAdvice);
  const diagnoseFn = useServerFn(diagnoseDisease);
  const speakFn = useServerFn(speak);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("km_lang") : null;
    if (saved) setLang(saved as LangCode);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("km_lang", lang);
  }, [lang]);

  function getLocation() {
    setLocError(null);
    if (!("geolocation" in navigator)) {
      setLocError(t("errorLocation", lang));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setLocError(t("errorLocation", lang)),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function fetchAdvice() {
    if (!coords) return;
    setAdviceLoading(true);
    setAdvice(null);
    try {
      const res = await adviceFn({ data: { lat: coords.lat, lon: coords.lon, crop, language: lang } });
      setAdvice(res);
    } catch (e) {
      console.error("[home] advice failed", e);
      setAdvice({ advice: t("errorGeneric", lang), weather: { tempC: 0, humidity: 0, rainNext3Days: [], rainChanceNext3Days: [], days: [] } });
    } finally {
      setAdviceLoading(false);
    }
  }

  async function processImageDataUrl(dataUrl: string, mimeType: string) {
    setImgPreview(dataUrl);
    setDiagnosis(null);
    setDiagLoading(true);
    try {
      const base64 = dataUrl.split(",")[1];
      if (!base64 || base64.length > 7_000_000) {
        setDiagnosis(t("errorImageTooLarge", lang));
        setDiagLoading(false);
        return;
      }
      const res = await diagnoseFn({ data: { imageBase64: base64, mimeType: mimeType || "image/jpeg", crop, language: lang } });
      setDiagnosis(res.diagnosis);
    } catch (err) {
      console.error("[home] diagnose failed", err);
      setDiagnosis(t("errorGeneric", lang));
    } finally {
      setDiagLoading(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => processImageDataUrl(String(reader.result), f.type || "image/jpeg");
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  const [cameraOpen, setCameraOpen] = useState(false);


  const [speaking, setSpeaking] = useState<string | null>(null);
  async function playSpeech(text: string, key: string) {
    if (!text) return;
    setSpeaking(key);
    try {
      const res = await speakFn({ data: { text, language: lang } });
      const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
      audio.onended = () => setSpeaking(null);
      await audio.play();
    } catch {
      setSpeaking(null);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="px-4 pt-6 pb-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg">
              <Sprout className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl leading-none font-bold text-primary">{t("appName", lang)}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t("tagline", lang)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AuthNav />
            <LanguagePicker lang={lang} setLang={setLang} />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-20 space-y-5">
        {/* Crop picker */}
        <section className="field-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <Sprout className="w-5 h-5 text-primary" /> {t("selectCrop", lang)}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {CROPS.map((c) => {
              const active = crop === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCrop(c.id)}
                  className={`rounded-xl p-3 text-center border-2 transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                      : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-3xl">{c.emoji}</div>
                  <div className="text-xs font-medium mt-1 leading-tight">{cropLabel(c.id, lang)}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Irrigation */}
        <section className="field-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <Droplets className="w-5 h-5 text-sky" /> {t("irrigationTitle", lang)}
          </h2>

          {!coords ? (
            <div className="space-y-3">
              <button onClick={getLocation} className="big-btn w-full">
                <MapPin className="w-5 h-5" /> {t("useLocation", lang)}
              </button>
              {locError && <p className="text-sm text-destructive">{locError}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {coords.lat.toFixed(3)}, {coords.lon.toFixed(3)}
              </div>
              <button onClick={fetchAdvice} disabled={adviceLoading} className="big-btn w-full disabled:opacity-60">
                {adviceLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
                {adviceLoading ? t("loading", lang) : t("getAdvice", lang)}
              </button>
            </div>
          )}

          {advice && (
            <div className="mt-4 space-y-3">
              {advice.weather && (
                <div className="grid grid-cols-3 gap-2">
                  <Stat icon={<ThermometerSun className="w-4 h-4" />} label="°C" value={`${Math.round(advice.weather.tempC)}`} />
                  <Stat icon={<Wind className="w-4 h-4" />} label="%" value={`${Math.round(advice.weather.humidity)}`} />
                  <Stat icon={<Droplets className="w-4 h-4 text-sky" />} label="mm/3d" value={advice.weather.rainNext3Days.reduce((a,b)=>a+b,0).toFixed(1)} />
                </div>
              )}

              <div className="rounded-xl bg-secondary/60 border border-border p-4 whitespace-pre-wrap text-[15px] leading-relaxed">
                {advice.advice}
              </div>
              <button
                onClick={() => playSpeech(advice.advice, "adv")}
                disabled={speaking === "adv"}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground font-medium hover:opacity-90 disabled:opacity-60"
              >
                {speaking === "adv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                {t("listen", lang)}
              </button>
            </div>
          )}
        </section>

        {/* Disease diagnosis */}
        <section className="field-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <Sparkles className="w-5 h-5 text-accent" /> {t("diseaseTitle", lang)}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">{t("uploadPhoto", lang)}</p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />

          {imgPreview ? (
            <div className="rounded-xl overflow-hidden border border-border mb-3">
              <img src={imgPreview} alt="plant" className="w-full max-h-72 object-cover" />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setCameraOpen(true)} className="big-btn">
              <Camera className="w-5 h-5" /> {lang === "en" ? "Camera" : t("diagnose", lang).split(" ")[0]}
            </button>
            <button onClick={() => fileRef.current?.click()} className="big-btn" style={{ background: "var(--accent)", color: "var(--accent-foreground)", boxShadow: "0 6px 0 -2px oklch(0.7 0.16 75), 0 10px 20px -8px oklch(0.7 0.15 75 / 0.4)" }}>
              <Upload className="w-5 h-5" /> {lang === "en" ? "Gallery" : "📁"}
            </button>
          </div>

          {cameraOpen && (
            <CameraCapture
              lang={lang}
              onClose={() => setCameraOpen(false)}
              onCapture={(dataUrl) => { setCameraOpen(false); processImageDataUrl(dataUrl, "image/jpeg"); }}
              onFallback={() => { setCameraOpen(false); fileRef.current?.click(); }}
            />
          )}


          {diagLoading && (
            <div className="mt-4 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> {t("loading", lang)}
            </div>
          )}

          {diagnosis && (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-secondary/60 border border-border p-4 whitespace-pre-wrap text-[15px] leading-relaxed">
                {diagnosis}
              </div>
              <button
                onClick={() => playSpeech(diagnosis, "dx")}
                disabled={speaking === "dx"}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground font-medium hover:opacity-90 disabled:opacity-60"
              >
                {speaking === "dx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                {t("listen", lang)}
              </button>
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-muted-foreground pt-4">
          {T.appName[lang]} · Powered by Lovable AI
        </footer>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">{icon}{label}</div>
      <div className="text-xl font-bold text-foreground mt-1">{value}</div>
    </div>
  );
}

function LanguagePicker({ lang, setLang }: { lang: LangCode; setLang: (l: LangCode) => void }) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang)!;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:border-primary/50 transition"
      >
        <Globe className="w-4 h-4 text-primary" />
        <span className="font-semibold">{current.native}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-52 field-card p-2 z-20 max-h-80 overflow-auto">
            <div className="px-2 py-1 text-xs text-muted-foreground">{T.chooseLang[lang]}</div>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between ${
                  l.code === lang ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                <span className="font-medium">{l.native}</span>
                <span className="text-xs opacity-70">{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AuthNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => mounted && setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  if (signedIn === null) return null;
  return signedIn ? (
    <Link to="/dashboard" className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1 shadow">
      <LayoutDashboard className="w-4 h-4" /> Dashboard
    </Link>
  ) : (
    <Link to="/auth" className="px-3 py-2 rounded-xl border border-border text-sm font-semibold flex items-center gap-1 hover:bg-secondary">
      <LogIn className="w-4 h-4" /> Sign in
    </Link>
  );
}

function CameraCapture({
  lang,
  onClose,
  onCapture,
  onFallback,
}: {
  lang: LangCode;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  onFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("no-camera");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        console.error("[camera] getUserMedia failed", e);
        setError("denied");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onCapture(dataUrl);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-3 text-white">
        <button onClick={onClose} className="p-2 rounded-full bg-white/10"><X className="w-5 h-5" /></button>
        <div className="text-sm opacity-80">{t("uploadPhoto", lang)}</div>
        <div className="w-9" />
      </div>
      <div className="flex-1 grid place-items-center overflow-hidden">
        {error ? (
          <div className="text-white text-center p-6 space-y-3 max-w-sm">
            <p>{lang === "en" ? "Camera not available. Please allow camera access, or pick a photo from your gallery." : "Camera unavailable. Use gallery instead."}</p>
            <button onClick={onFallback} className="px-4 py-2 rounded-xl bg-white text-black font-semibold inline-flex items-center gap-2">
              <Upload className="w-4 h-4" /> {lang === "en" ? "Open Gallery" : "📁"}
            </button>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted className="max-h-full max-w-full" />
        )}
      </div>
      {!error && (
        <div className="p-5 flex items-center justify-center gap-6">
          <button onClick={capture} disabled={!ready} className="w-16 h-16 rounded-full bg-white grid place-items-center shadow-lg disabled:opacity-50">
            <Camera className="w-7 h-7 text-black" />
          </button>
          <button onClick={onFallback} className="px-3 py-2 rounded-xl bg-white/10 text-white text-sm inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> {lang === "en" ? "Use gallery" : "📁"}
          </button>
        </div>
      )}
    </div>
  );
}

