import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sprout, LogOut, Loader2, Plus, Trash2, Star, Wheat, MapPin,
  Layers, History, User as UserIcon, BarChart3, MessageSquare, ShieldCheck, Droplets,
} from "lucide-react";
import { AdviseTab } from "@/components/AdviseTab";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";

import {
  getMyProfile, updateMyProfile,
  listFields, addField, deleteField,
  listYields, addYield, deleteYield,
  getMyRating, saveRating,
  listAdviceHistory, listDiagnosisHistory,
} from "@/lib/dashboard.functions";
import { amIAdmin } from "@/lib/admin.functions";
import { CROPS, LANGUAGES, T, readSavedLang, type LangCode } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Kisaan Mithra" }] }),
  component: Dashboard,
});

type Tab = "overview" | "advise" | "yields" | "fields" | "history" | "profile" | "rate";

function tt(key: keyof typeof T, lang: LangCode): string {
  const e = T[key] as Record<string, string>;
  return e?.[lang] ?? e?.en ?? String(key);
}

function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [lang, setLang] = useState<LangCode>("te");
  useEffect(() => setLang(readSavedLang()), []);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("km_lang", lang); }, [lang]);

  const nav = useNavigate();
  const adminFn = useServerFn(amIAdmin);
  const { data: role } = useQuery({ queryKey: ["amIAdmin"], queryFn: () => adminFn() });
  const isAdmin = !!role?.admin;

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <Sprout className="w-5 h-5" />
            </div>
            <span className="font-bold text-primary">Kisaan Mithra</span>
          </Link>
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as LangCode)}
              className="text-sm rounded-lg border border-border bg-card px-2 py-1"
              aria-label={tt("language", lang)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.native}</option>
              ))}
            </select>
            {isAdmin && (
              <Link to="/admin" className="text-sm flex items-center gap-1 text-primary hover:opacity-80 font-medium">
                <ShieldCheck className="w-4 h-4" /> {tt("adminPanel", lang)}
              </Link>
            )}
            <button onClick={signOut} className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" /> {tt("signOut", lang)}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
          <TabBtn t="overview" cur={tab} set={setTab} icon={<BarChart3 className="w-4 h-4" />}>{tt("overview", lang)}</TabBtn>
          <TabBtn t="advise" cur={tab} set={setTab} icon={<Droplets className="w-4 h-4" />}>{tt("irrigationTitle", lang)}</TabBtn>
          <TabBtn t="yields" cur={tab} set={setTab} icon={<Wheat className="w-4 h-4" />}>{tt("cropYields", lang)}</TabBtn>
          <TabBtn t="fields" cur={tab} set={setTab} icon={<Layers className="w-4 h-4" />}>{tt("myFields", lang)}</TabBtn>
          <TabBtn t="history" cur={tab} set={setTab} icon={<History className="w-4 h-4" />}>{tt("aiHistory", lang)}</TabBtn>
          <TabBtn t="profile" cur={tab} set={setTab} icon={<UserIcon className="w-4 h-4" />}>{tt("profile", lang)}</TabBtn>
          <TabBtn t="rate" cur={tab} set={setTab} icon={<Star className="w-4 h-4" />}>{tt("rateApp", lang)}</TabBtn>
        </nav>

        <main className="min-w-0">
          {tab === "overview" && <Overview lang={lang} />}
          {tab === "advise" && <AdviseTab lang={lang} />}
          {tab === "yields" && <YieldsTab lang={lang} />}
          {tab === "fields" && <FieldsTab lang={lang} />}
          {tab === "history" && <HistoryTab lang={lang} />}
          {tab === "profile" && <ProfileTab lang={lang} />}
          {tab === "rate" && <RateTab lang={lang} />}
        </main>
      </div>
    </div>
  );
}

function TabBtn({
  t, cur, set, children, icon,
}: { t: Tab; cur: Tab; set: (t: Tab) => void; children: React.ReactNode; icon: React.ReactNode }) {
  const active = t === cur;
  return (
    <button
      onClick={() => set(t)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
        active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-secondary"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------- Overview ----------
function Overview({ lang }: { lang: LangCode }) {
  const yieldsFn = useServerFn(listYields);
  const fieldsFn = useServerFn(listFields);
  const { data: yields = [] } = useQuery({ queryKey: ["yields"], queryFn: () => yieldsFn() });
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: () => fieldsFn() });

  const totalKg = yields.reduce((a: number, y: any) => a + Number(y.yield_kg ?? 0), 0);
  const totalIncome = yields.reduce((a: number, y: any) => a + Number(y.income_inr ?? 0), 0);

  const byCrop: Record<string, { crop: string; kg: number; income: number }> = {};
  for (const y of yields as any[]) {
    const k = y.crop;
    if (!byCrop[k]) byCrop[k] = { crop: k, kg: 0, income: 0 };
    byCrop[k].kg += Number(y.yield_kg ?? 0);
    byCrop[k].income += Number(y.income_inr ?? 0);
  }
  const chartData = Object.values(byCrop);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{tt("dashboard", lang)}</h1>
      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard label={tt("fields", lang)} value={String(fields.length)} icon={<Layers className="w-5 h-5" />} />
        <StatCard label={tt("totalHarvest", lang)} value={`${totalKg.toFixed(0)} kg`} icon={<Wheat className="w-5 h-5" />} />
        <StatCard label={tt("totalIncome", lang)} value={`₹ ${totalIncome.toFixed(0)}`} icon={<BarChart3 className="w-5 h-5" />} />
      </div>

      <div className="field-card p-5">
        <h2 className="font-semibold mb-3">{tt("yieldByCrop", lang)}</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tt("noRecordsYet", lang)}</p>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="crop" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="kg" name="kg" fill="hsl(var(--primary, 142 60% 35%))" />
                <Bar yAxisId="right" dataKey="income" name="₹" fill="hsl(var(--accent, 38 92% 50%))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="field-card p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-secondary grid place-items-center text-primary">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

// ---------- Yields ----------
function YieldsTab({ lang }: { lang: LangCode }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listYields);
  const addFn = useServerFn(addYield);
  const delFn = useServerFn(deleteYield);
  const { data: items = [], isLoading } = useQuery({ queryKey: ["yields"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    crop: "rice", season: "Kharif", sowing_date: "", harvest_date: "",
    area_acres: "", yield_kg: "", income_inr: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addFn({
        data: {
          crop: form.crop,
          season: form.season || null,
          sowing_date: form.sowing_date || null,
          harvest_date: form.harvest_date || null,
          area_acres: form.area_acres ? Number(form.area_acres) : null,
          yield_kg: form.yield_kg ? Number(form.yield_kg) : null,
          income_inr: form.income_inr ? Number(form.income_inr) : null,
          notes: form.notes || null,
        },
      });
      setOpen(false);
      setForm({ crop: "rice", season: "Kharif", sowing_date: "", harvest_date: "", area_acres: "", yield_kg: "", income_inr: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["yields"] });
    } finally { setSaving(false); }
  }

  const chart = [...(items as any[])]
    .filter((y) => y.harvest_date)
    .sort((a, b) => a.harvest_date.localeCompare(b.harvest_date))
    .map((y) => ({ date: y.harvest_date, kg: Number(y.yield_kg ?? 0), income: Number(y.income_inr ?? 0), crop: y.crop }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tt("cropYields", lang)}</h1>
        <button onClick={() => setOpen((o) => !o)} className="big-btn">
          <Plus className="w-4 h-4" /> {open ? tt("cancel", lang) : tt("add", lang)}
        </button>
      </div>

      {open && (
        <form onSubmit={save} className="field-card p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Select label={tt("crop", lang)} value={form.crop} onChange={(v) => setForm({ ...form, crop: v })}
              options={CROPS.map((c) => ({ value: c.id, label: `${c.emoji} ${c.names[lang] ?? c.en}` }))} />
            <Select label="Season" value={form.season} onChange={(v) => setForm({ ...form, season: v })}
              options={["Kharif", "Rabi", "Zaid", "Summer"].map((s) => ({ value: s, label: s }))} />
            <Field label="Sowing date" type="date" value={form.sowing_date} onChange={(v) => setForm({ ...form, sowing_date: v })} />
            <Field label="Harvest date" type="date" value={form.harvest_date} onChange={(v) => setForm({ ...form, harvest_date: v })} />
            <Field label="Area (acres)" type="number" value={form.area_acres} onChange={(v) => setForm({ ...form, area_acres: v })} />
            <Field label="Yield (kg)" type="number" value={form.yield_kg} onChange={(v) => setForm({ ...form, yield_kg: v })} />
            <Field label="Income (₹)" type="number" value={form.income_inr} onChange={(v) => setForm({ ...form, income_inr: v })} />
          </div>
          <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <button type="submit" disabled={saving} className="big-btn">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {tt("save", lang)}
          </button>
        </form>
      )}

      {chart.length > 1 && (
        <div className="field-card p-5">
          <h2 className="font-semibold mb-3">{tt("yieldByCrop", lang)}</h2>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="kg" name="kg" fill="hsl(var(--primary, 142 60% 35%))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="field-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{tt("noRecordsYet", lang)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left">
                <Th>{tt("crop", lang)}</Th><Th>Season</Th><Th>{tt("date", lang)}</Th><Th>Area</Th><Th>kg</Th><Th>₹</Th><Th>{" "}</Th>
              </tr>
            </thead>
            <tbody>
              {(items as any[]).map((y) => (
                <tr key={y.id} className="border-t border-border">
                  <Td className="font-medium">{y.crop}</Td>
                  <Td>{y.season ?? "—"}</Td>
                  <Td>{y.harvest_date ?? "—"}</Td>
                  <Td>{y.area_acres ?? "—"}</Td>
                  <Td>{y.yield_kg ?? "—"}</Td>
                  <Td>{y.income_inr ?? "—"}</Td>
                  <Td>
                    <button
                      onClick={async () => { await delFn({ data: { id: y.id } }); qc.invalidateQueries({ queryKey: ["yields"] }); }}
                      className="text-destructive hover:opacity-70"
                      aria-label={tt("delete", lang)}
                    ><Trash2 className="w-4 h-4" /></button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- Fields ----------
function FieldsTab({ lang }: { lang: LangCode }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listFields);
  const addFn = useServerFn(addField);
  const delFn = useServerFn(deleteField);
  const { data: items = [], isLoading } = useQuery({ queryKey: ["fields"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", crop: "rice", area_acres: "", soil_type: "Loamy", lat: "", lng: "" });
  const [saving, setSaving] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  function useGPS() {
    setGpsError(null);
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsError("GPS not available on this device.");
      return;
    }
    if (!window.isSecureContext) {
      setGpsError("GPS needs HTTPS. Open the published site to use location.");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: String(pos.coords.latitude.toFixed(6)),
          lng: String(pos.coords.longitude.toFixed(6)),
        }));
        setGpsBusy(false);
      },
      (err) => {
        setGpsBusy(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it in your browser settings."
            : err.code === err.POSITION_UNAVAILABLE
            ? "Location unavailable. Move to an open area and try again."
            : "Could not get location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addFn({
        data: {
          name: form.name,
          crop: form.crop || null,
          area_acres: form.area_acres ? Number(form.area_acres) : null,
          soil_type: form.soil_type || null,
          lat: form.lat ? Number(form.lat) : null,
          lng: form.lng ? Number(form.lng) : null,
        },
      });
      setOpen(false);
      setForm({ name: "", crop: "rice", area_acres: "", soil_type: "Loamy", lat: "", lng: "" });
      qc.invalidateQueries({ queryKey: ["fields"] });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tt("myFields", lang)}</h1>
        <button onClick={() => setOpen((o) => !o)} className="big-btn">
          <Plus className="w-4 h-4" /> {open ? tt("cancel", lang) : tt("add", lang)}
        </button>
      </div>

      {open && (
        <form onSubmit={save} className="field-card p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Field name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Select label={tt("crop", lang)} value={form.crop} onChange={(v) => setForm({ ...form, crop: v })}
              options={CROPS.map((c) => ({ value: c.id, label: `${c.emoji} ${c.names[lang] ?? c.en}` }))} />
            <Field label="Area (acres)" type="number" value={form.area_acres} onChange={(v) => setForm({ ...form, area_acres: v })} />
            <Select label="Soil type" value={form.soil_type} onChange={(v) => setForm({ ...form, soil_type: v })}
              options={["Loamy", "Sandy", "Clay", "Silty", "Black", "Red", "Alluvial"].map((s) => ({ value: s, label: s }))} />
            <Field label="Latitude" value={form.lat} onChange={(v) => setForm({ ...form, lat: v })} />
            <Field label="Longitude" value={form.lng} onChange={(v) => setForm({ ...form, lng: v })} />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={useGPS} disabled={gpsBusy} className="px-4 py-2 rounded-xl border border-border text-sm flex items-center gap-1 disabled:opacity-60">
              {gpsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} GPS
            </button>
            <button type="submit" disabled={saving} className="big-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {tt("save", lang)}
            </button>
            {gpsError && <span className="text-xs text-destructive">{gpsError}</span>}
          </div>
        </form>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">{tt("noRecordsYet", lang)}</p>
        ) : (
          (items as any[]).map((f) => (
            <div key={f.id} className="field-card p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{f.crop ?? "—"} · {f.area_acres ?? "—"} ac · {f.soil_type ?? "—"}</div>
                  {f.lat && <div className="text-xs text-muted-foreground mt-1"><MapPin className="w-3 h-3 inline" /> {Number(f.lat).toFixed(3)}, {Number(f.lng).toFixed(3)}</div>}
                </div>
                <button onClick={async () => { await delFn({ data: { id: f.id } }); qc.invalidateQueries({ queryKey: ["fields"] }); }} className="text-destructive" aria-label={tt("delete", lang)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------- History ----------
function HistoryTab({ lang }: { lang: LangCode }) {
  const advFn = useServerFn(listAdviceHistory);
  const dxFn = useServerFn(listDiagnosisHistory);
  const { data: adv = [] } = useQuery({ queryKey: ["adv_hist"], queryFn: () => advFn() });
  const { data: dx = [] } = useQuery({ queryKey: ["dx_hist"], queryFn: () => dxFn() });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{tt("aiHistory", lang)}</h1>
      <Section title={tt("irrigationTitle", lang)}>
        {adv.length === 0 ? <Empty>{tt("noRecordsYet", lang)}</Empty> :
          (adv as any[]).map((a) => (
            <div key={a.id} className="field-card p-4">
              <div className="text-xs text-muted-foreground mb-1">{new Date(a.created_at).toLocaleString()} · {a.crop} · {a.language}</div>
              <div className="text-sm whitespace-pre-wrap">{a.advice}</div>
            </div>
          ))}
      </Section>
      <Section title={tt("diseaseTitle", lang)}>
        {dx.length === 0 ? <Empty>{tt("noRecordsYet", lang)}</Empty> :
          (dx as any[]).map((d) => (
            <div key={d.id} className="field-card p-4">
              <div className="text-xs text-muted-foreground mb-1">{new Date(d.created_at).toLocaleString()} · {d.crop} · {d.language}</div>
              <div className="text-sm whitespace-pre-wrap">{d.diagnosis}</div>
            </div>
          ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-3"><h2 className="font-semibold">{title}</h2>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground field-card p-4">{children}</p>;
}

// ---------- Profile ----------
function ProfileTab({ lang }: { lang: LangCode }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyProfile);
  const setFn = useServerFn(updateMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => getFn() });
  const [form, setForm] = useState({ full_name: "", village: "", state: "", language: "te", phone: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (data && form.full_name === "" && data.full_name) {
    setForm({
      full_name: data.full_name ?? "", village: data.village ?? "", state: data.state ?? "",
      language: data.language ?? "te", phone: data.phone ?? "",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await setFn({ data: form });
      setMsg("✓");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      setMsg(tt("errorGeneric", lang));
    } finally { setSaving(false); }
  }

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin" />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{tt("profile", lang)}</h1>
      <form onSubmit={save} className="field-card p-5 space-y-3 max-w-xl">
        <Field label={tt("farmer", lang)} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={tt("village", lang)} value={form.village} onChange={(v) => setForm({ ...form, village: v })} />
          <Field label={tt("state", lang)} value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Select label={tt("language", lang)} value={form.language} onChange={(v) => setForm({ ...form, language: v })}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.native }))} />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="big-btn">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {tt("save", lang)}
          </button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </form>
    </div>
  );
}

// ---------- Rate ----------
function RateTab({ lang }: { lang: LangCode }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyRating);
  const setFn = useServerFn(saveRating);
  const { data } = useQuery({ queryKey: ["rating"], queryFn: () => getFn() });
  const [stars, setStars] = useState<number>(data?.stars ?? 5);
  const [comment, setComment] = useState<string>(data?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (data && stars === 5 && comment === "" && (data.stars !== 5 || (data.comment ?? "") !== "")) {
    setStars(data.stars);
    setComment(data.comment ?? "");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await setFn({ data: { stars, comment: comment || null } });
      setMsg(tt("feedbackThanks", lang));
      qc.invalidateQueries({ queryKey: ["rating"] });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="text-2xl font-bold">{tt("rateApp", lang)}</h1>
      <form onSubmit={save} className="field-card p-5 space-y-4">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} stars`}>
              <Star className={`w-9 h-9 ${n <= stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <div>
          <label className="text-sm font-medium mb-1 flex items-center gap-1"><MessageSquare className="w-4 h-4" /> {tt("leaveComment", lang)}</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="big-btn">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {tt("submitFeedback", lang)}
          </button>
          {msg && <span className="text-sm text-primary font-medium">{msg}</span>}
        </div>
      </form>
    </div>
  );
}

// ---------- Tiny form atoms ----------
function Field({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-card focus:border-primary focus:outline-none"
      />
    </label>
  );
}
function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-card focus:border-primary focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
