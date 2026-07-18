import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Cloud, Droplets, Loader2, MapPin, RefreshCw, Sparkles, Upload, Volume2, Wheat, X } from "lucide-react";
import { listFields } from "@/lib/dashboard.functions";
import { saveAdviceHistory, saveDiagnosisHistory } from "@/lib/dashboard.functions";
import { diagnoseDisease, getIrrigationAdvice, speak } from "@/lib/farming.functions";
import { CROPS, T, type LangCode } from "@/lib/i18n";

function tt(key: keyof typeof T, lang: LangCode): string {
  const e = T[key] as Record<string, string>;
  return e?.[lang] ?? e?.en ?? String(key);
}
function cropName(id: string, lang: LangCode) {
  const c = CROPS.find((x) => x.id === id);
  if (!c) return id;
  return `${c.emoji} ${c.names[lang] ?? c.en}`;
}

export function AdviseTab({ lang }: { lang: LangCode }) {
  const listFn = useServerFn(listFields);
  const qc = useQueryClient();
  const { data: fields = [], isLoading } = useQuery({ queryKey: ["fields"], queryFn: () => listFn() });

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin" />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{tt("irrigationTitle", lang)} & {tt("diseaseTitle", lang)}</h1>

      {fields.length === 0 ? (
        <div className="space-y-4">
          <div className="field-card p-6 text-center text-muted-foreground">
            {tt("noRecordsYet", lang)}
          </div>
          <QuickAdviceCard
            lang={lang}
            onHistorySaved={() => {
              qc.invalidateQueries({ queryKey: ["adv_hist"] });
              qc.invalidateQueries({ queryKey: ["dx_hist"] });
            }}
          />
        </div>
      ) : (
        <div className="grid gap-4">
          {(fields as any[]).map((f) => (
            <FieldAdviceCard
              key={f.id}
              lang={lang}
              field={f}
              onHistorySaved={() => {
                qc.invalidateQueries({ queryKey: ["adv_hist"] });
                qc.invalidateQueries({ queryKey: ["dx_hist"] });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAdviceCard({
  lang,
  onHistorySaved,
}: {
  lang: LangCode;
  onHistorySaved: () => void;
}) {
  const adviceFn = useServerFn(getIrrigationAdvice);
  const diagnoseFn = useServerFn(diagnoseDisease);
  const speakFn = useServerFn(speak);
  const saveAdvFn = useServerFn(saveAdviceHistory);
  const saveDxFn = useServerFn(saveDiagnosisHistory);

  const [crop, setCrop] = useState("rice");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);

  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const canAdvise = lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(latNum) && Number.isFinite(lngNum);

  function useGPS() {
    setMsg(null);
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setMsg(tt("errorLocation", lang));
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude.toFixed(6)));
        setLng(String(pos.coords.longitude.toFixed(6)));
        setGpsBusy(false);
      },
      () => {
        setGpsBusy(false);
        setMsg(tt("errorLocation", lang));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function fetchAdvice() {
    if (!canAdvise) {
      setMsg(tt("errorLocation", lang));
      return;
    }
    setMsg(null);
    setAdviceLoading(true);
    setAdvice(null);
    try {
      const res = await adviceFn({
        data: { lat: latNum, lon: lngNum, crop, language: lang },
      });
      setAdvice(res.advice);
      try {
        await saveAdvFn({ data: { crop, language: lang, advice: res.advice } });
        onHistorySaved();
      } catch {
        // optional history save
      }
    } catch {
      setAdvice(tt("errorGeneric", lang));
    } finally {
      setAdviceLoading(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => void processImageDataUrl(String(reader.result), f.type || "image/jpeg");
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  async function processImageDataUrl(dataUrl: string, mimeType: string) {
    setImgPreview(dataUrl);
    const base64 = dataUrl.split(",")[1];
    if (!base64 || base64.length > 7_000_000) {
      setDiagnosis(tt("errorImageTooLarge", lang));
      return;
    }
    setDiagLoading(true);
    setDiagnosis(null);
    try {
      const res = await diagnoseFn({
        data: { imageBase64: base64, mimeType: mimeType || "image/jpeg", crop, language: lang },
      });
      setDiagnosis(res.diagnosis);
      try {
        await saveDxFn({ data: { crop, language: lang, diagnosis: res.diagnosis } });
        onHistorySaved();
      } catch {
        // optional history save
      }
    } catch {
      setDiagnosis(tt("errorGeneric", lang));
    } finally {
      setDiagLoading(false);
    }
  }

  async function play(text: string, key: string) {
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
    <div className="field-card p-5 space-y-4">
      <div>
        <div className="font-semibold">{lang === "en" ? "Quick advice (without saved field)" : tt("irrigationTitle", lang)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {lang === "en" ? "Use this now, or add a field in My Fields for saved, crop-wise advice." : tt("myFields", lang)}
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-2">
        <select
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
        >
          {CROPS.map((c) => (
            <option key={c.id} value={c.id}>{`${c.emoji} ${c.names[lang] ?? c.en}`}</option>
          ))}
        </select>
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Latitude"
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
        />
        <input
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="Longitude"
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
        />
        <button
          type="button"
          onClick={useGPS}
          disabled={gpsBusy}
          className="px-3 py-2 rounded-lg border border-border text-sm flex items-center justify-center gap-1 disabled:opacity-60"
        >
          {gpsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} GPS
        </button>
      </div>

      <button
        onClick={fetchAdvice}
        disabled={adviceLoading || !canAdvise}
        className="big-btn w-full disabled:opacity-60"
      >
        {adviceLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
        <Droplets className="w-4 h-4" /> {tt("getAdvice", lang)}
      </button>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
      {advice && (
        <div className="space-y-2">
          <div className="rounded-xl bg-secondary/60 border border-border p-4 whitespace-pre-wrap text-[15px]">{advice}</div>
          <button
            onClick={() => play(advice, "quick-adv")}
            disabled={speaking === "quick-adv"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium disabled:opacity-60"
          >
            {speaking === "quick-adv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            {tt("listen", lang)}
          </button>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> {tt("diseaseTitle", lang)}</div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setCameraOpen(true)} className="big-btn">
            <Camera className="w-5 h-5" /> {tt("diagnose", lang)}
          </button>
          <button onClick={() => fileRef.current?.click()} className="big-btn" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
            <Upload className="w-5 h-5" /> 📁
          </button>
        </div>
        {cameraOpen && (
          <CameraCapture
            lang={lang}
            onClose={() => setCameraOpen(false)}
            onCapture={(dataUrl) => {
              setCameraOpen(false);
              void processImageDataUrl(dataUrl, "image/jpeg");
            }}
            onFallback={() => {
              setCameraOpen(false);
              fileRef.current?.click();
            }}
          />
        )}
        {imgPreview && (
          <div className="rounded-xl overflow-hidden border border-border">
            <img src={imgPreview} alt="plant" className="w-full max-h-60 object-cover" />
          </div>
        )}
        {diagLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {tt("loading", lang)}
          </div>
        )}
        {diagnosis && (
          <div className="space-y-2">
            <div className="rounded-xl bg-secondary/60 border border-border p-4 whitespace-pre-wrap text-[15px]">{diagnosis}</div>
            <button
              onClick={() => play(diagnosis, "quick-dx")}
              disabled={speaking === "quick-dx"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium disabled:opacity-60"
            >
              {speaking === "quick-dx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
              {tt("listen", lang)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldAdviceCard({
  lang, field, onHistorySaved,
}: {
  lang: LangCode;
  field: { id: string; name: string; crop: string | null; lat: number | null; lng: number | null };
  onHistorySaved: () => void;
}) {
  const adviceFn = useServerFn(getIrrigationAdvice);
  const diagnoseFn = useServerFn(diagnoseDisease);
  const speakFn = useServerFn(speak);
  const saveAdvFn = useServerFn(saveAdviceHistory);
  const saveDxFn = useServerFn(saveDiagnosisHistory);

  const crop = field.crop || "rice";
  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canAdvise = field.lat != null && field.lng != null;

  async function fetchAdvice() {
    if (!canAdvise) {
      setMsg(tt("errorLocation", lang));
      return;
    }
    setMsg(null);
    setAdviceLoading(true);
    setAdvice(null);
    try {
      const res = await adviceFn({
        data: { lat: Number(field.lat), lon: Number(field.lng), crop, language: lang },
      });
      setAdvice(res.advice);
      try {
        await saveAdvFn({ data: { crop, language: lang, advice: res.advice } });
        onHistorySaved();
      } catch { /* history save optional */ }
    } catch {
      setAdvice(tt("errorGeneric", lang));
    } finally {
      setAdviceLoading(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => void processImageDataUrl(String(reader.result), f.type || "image/jpeg");
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  async function processImageDataUrl(dataUrl: string, mimeType: string) {
    setImgPreview(dataUrl);
    const base64 = dataUrl.split(",")[1];
    if (!base64 || base64.length > 7_000_000) {
      setDiagnosis(tt("errorImageTooLarge", lang));
      return;
    }
    setDiagLoading(true);
    setDiagnosis(null);
    try {
      const res = await diagnoseFn({
        data: { imageBase64: base64, mimeType: mimeType || "image/jpeg", crop, language: lang },
      });
      setDiagnosis(res.diagnosis);
      try {
        await saveDxFn({ data: { crop, language: lang, diagnosis: res.diagnosis } });
        onHistorySaved();
      } catch { /* optional */ }
    } catch {
      setDiagnosis(tt("errorGeneric", lang));
    } finally {
      setDiagLoading(false);
    }
  }

  async function play(text: string, key: string) {
    if (!text) return;
    setSpeaking(key);
    try {
      const res = await speakFn({ data: { text, language: lang } });
      const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
      audio.onended = () => setSpeaking(null);
      await audio.play();
    } catch { setSpeaking(null); }
  }

  return (
    <div className="field-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-lg">{field.name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
            <Wheat className="w-3 h-3" /> {cropName(crop, lang)}
            {canAdvise && (
              <><MapPin className="w-3 h-3 ml-2" /> {Number(field.lat).toFixed(3)}, {Number(field.lng).toFixed(3)}</>
            )}
          </div>
        </div>
      </div>

      {/* Irrigation */}
      <div className="space-y-2">
        <button
          onClick={fetchAdvice}
          disabled={adviceLoading || !canAdvise}
          className="big-btn w-full disabled:opacity-60"
          title={!canAdvise ? tt("errorLocation", lang) : ""}
        >
          {adviceLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
          <Droplets className="w-4 h-4" /> {tt("getAdvice", lang)}
        </button>
        {!canAdvise && (
          <p className="text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 inline" /> {tt("useLocation", lang)} — {tt("myFields", lang)}
          </p>
        )}
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        {advice && (
          <div className="space-y-2">
            <div className="rounded-xl bg-secondary/60 border border-border p-4 whitespace-pre-wrap text-[15px]">{advice}</div>
            <button
              onClick={() => play(advice, "adv")}
              disabled={speaking === "adv"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium disabled:opacity-60"
            >
              {speaking === "adv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
              {tt("listen", lang)}
            </button>
          </div>
        )}
      </div>

      {/* Disease */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> {tt("diseaseTitle", lang)}</div>
        <p className="text-xs text-muted-foreground">{tt("uploadPhoto", lang)}</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setCameraOpen(true)} className="big-btn">
            <Camera className="w-5 h-5" /> {tt("diagnose", lang)}
          </button>
          <button onClick={() => fileRef.current?.click()} className="big-btn" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
            <Upload className="w-5 h-5" /> 📁
          </button>
        </div>
        {cameraOpen && (
          <CameraCapture
            lang={lang}
            onClose={() => setCameraOpen(false)}
            onCapture={(dataUrl) => {
              setCameraOpen(false);
              void processImageDataUrl(dataUrl, "image/jpeg");
            }}
            onFallback={() => {
              setCameraOpen(false);
              fileRef.current?.click();
            }}
          />
        )}
        {imgPreview && (
          <div className="rounded-xl overflow-hidden border border-border">
            <img src={imgPreview} alt="plant" className="w-full max-h-60 object-cover" />
          </div>
        )}
        {diagLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {tt("loading", lang)}
          </div>
        )}
        {diagnosis && (
          <div className="space-y-2">
            <div className="rounded-xl bg-secondary/60 border border-border p-4 whitespace-pre-wrap text-[15px]">{diagnosis}</div>
            <button
              onClick={() => play(diagnosis, "dx")}
              disabled={speaking === "dx"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium disabled:opacity-60"
            >
              {speaking === "dx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
              {tt("listen", lang)}
            </button>
          </div>
        )}
      </div>
    </div>
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
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (err) {
        console.error("[camera] getUserMedia failed", err);
        setError("denied");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-3 text-white">
        <button onClick={onClose} className="p-2 rounded-full bg-white/10" aria-label="Close camera"><X className="w-5 h-5" /></button>
        <div className="text-sm opacity-80">{tt("uploadPhoto", lang)}</div>
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
          <button onClick={capture} disabled={!ready} className="w-16 h-16 rounded-full bg-white grid place-items-center shadow-lg disabled:opacity-50" aria-label="Capture photo">
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
