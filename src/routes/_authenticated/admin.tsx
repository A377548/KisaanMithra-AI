import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Sprout, LogOut, Users, Leaf, MessageSquare, Loader2, Plus, Trash2, ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";

import { LANGUAGES, T, readSavedLang, type LangCode } from "@/lib/i18n";
import {
  amIAdmin, adminStats,
  listFarmers, listAdminCrops, addAdminCrop, deleteAdminCrop,
  listDiagnosisFeedback,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Kisaan Mithra" }] }),
  component: AdminPage,
});

function t(key: keyof typeof T, lang: LangCode): string {
  const entry = T[key] as Record<string, string>;
  return entry?.[lang] ?? entry?.en ?? String(key);
}

type Tab = "farmers" | "crops" | "feedback";

function AdminPage() {
  const [lang, setLang] = useState<LangCode>("te");
  useEffect(() => setLang(readSavedLang()), []);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("km_lang", lang); }, [lang]);

  const nav = useNavigate();
  const amIAdminFn = useServerFn(amIAdmin);
  const statsFn = useServerFn(adminStats);

  const { data: roleData, isLoading: roleLoading } =
    useQuery({ queryKey: ["amIAdmin"], queryFn: () => amIAdminFn() });

  const isAdmin = !!roleData?.admin;
  const { data: stats } = useQuery({
    queryKey: ["adminStats"],
    queryFn: () => statsFn(),
    enabled: isAdmin,
  });

  const [tab, setTab] = useState<Tab>("farmers");

  async function signOut() { await supabase.auth.signOut(); nav({ to: "/" }); }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> {t("dashboard", lang)}
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-bold text-primary">{t("adminPanel", lang)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as LangCode)}
              className="text-sm rounded-lg border border-border bg-card px-2 py-1"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.native}</option>
              ))}
            </select>
            <button onClick={signOut} className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" /> {t("signOut", lang)}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {roleLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> …</div>
        ) : !isAdmin ? (
          <div className="field-card p-6 max-w-xl mx-auto space-y-4 text-center">
            <p className="font-medium">{t("notAdmin", lang)}</p>
            <p className="text-sm text-muted-foreground">
              Admin access must be granted directly by the project owner via the database. Self-service admin claim is disabled for security.
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-3 mb-6">
              <StatCard icon={<Users className="w-5 h-5" />} label={t("totalFarmers", lang)} value={String(stats?.farmers ?? "…")} />
              <StatCard icon={<Leaf className="w-5 h-5" />} label={t("totalDiagnoses", lang)} value={String(stats?.diagnoses ?? "…")} />
              <StatCard icon={<MessageSquare className="w-5 h-5" />} label={t("totalFeedback", lang)} value={String(stats?.feedback ?? "…")} />
            </div>

            <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
              <TabBtn cur={tab} me="farmers" set={setTab}>{t("allFarmers", lang)}</TabBtn>
              <TabBtn cur={tab} me="crops" set={setTab}>{t("manageCrops", lang)}</TabBtn>
              <TabBtn cur={tab} me="feedback" set={setTab}>{t("diagnosisFeedback", lang)}</TabBtn>
            </div>

            {tab === "farmers" && <FarmersTab lang={lang} />}
            {tab === "crops" && <CropsTab lang={lang} />}
            {tab === "feedback" && <FeedbackTab lang={lang} />}
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({ cur, me, set, children }: { cur: Tab; me: Tab; set: (t: Tab) => void; children: React.ReactNode }) {
  const active = cur === me;
  return (
    <button
      onClick={() => set(me)}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
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

// ----- Farmers -----
function FarmersTab({ lang }: { lang: LangCode }) {
  const fn = useServerFn(listFarmers);
  const { data = [], isLoading } = useQuery({ queryKey: ["adminFarmers"], queryFn: () => fn() });
  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin" />;
  if (!data.length) return <p className="text-muted-foreground text-sm">{t("noRecordsYet", lang)}</p>;
  return (
    <div className="field-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left">
          <tr>
            <Th>{t("farmer", lang)}</Th>
            <Th>{t("village", lang)}</Th>
            <Th>{t("state", lang)}</Th>
            <Th>{t("language", lang)}</Th>
            <Th>{t("joined", lang)}</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((f: any) => (
            <tr key={f.id} className="border-t border-border">
              <Td>{f.full_name || "—"}</Td>
              <Td>{f.village || "—"}</Td>
              <Td>{f.state || "—"}</Td>
              <Td>{f.language || "—"}</Td>
              <Td>{f.created_at ? new Date(f.created_at).toLocaleDateString() : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----- Crops -----
function CropsTab({ lang }: { lang: LangCode }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminCrops);
  const addFn = useServerFn(addAdminCrop);
  const delFn = useServerFn(deleteAdminCrop);
  const { data = [], isLoading } = useQuery({ queryKey: ["adminCrops"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ crop_id: "", en_name: "", emoji: "🌱" });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addFn({ data: { crop_id: form.crop_id, en_name: form.en_name, emoji: form.emoji, names: {} } });
      setForm({ crop_id: "", en_name: "", emoji: "🌱" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["adminCrops"] });
    } catch { /* handled globally */ } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setOpen((v) => !v)} className="big-btn bg-primary text-primary-foreground text-sm">
          <Plus className="w-4 h-4 inline mr-1" /> {t("addNewCrop", lang)}
        </button>
      </div>

      {open && (
        <form onSubmit={save} className="field-card p-4 grid sm:grid-cols-3 gap-3">
          <input required maxLength={40} placeholder={t("cropId", lang)} value={form.crop_id}
            onChange={(e) => setForm({ ...form, crop_id: e.target.value })}
            className="px-3 py-2 rounded-lg border border-border bg-card" />
          <input required maxLength={60} placeholder={t("englishName", lang)} value={form.en_name}
            onChange={(e) => setForm({ ...form, en_name: e.target.value })}
            className="px-3 py-2 rounded-lg border border-border bg-card" />
          <input maxLength={4} placeholder={t("emoji", lang)} value={form.emoji}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            className="px-3 py-2 rounded-lg border border-border bg-card" />
          <div className="sm:col-span-3 flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm">
              {t("cancel", lang)}
            </button>
            <button disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("save", lang)}
            </button>
          </div>
        </form>
      )}

      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
        <div className="field-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left">
              <tr>
                <Th>{t("emoji", lang)}</Th>
                <Th>ID</Th>
                <Th>{t("englishName", lang)}</Th>
                <Th>{" "}</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <Td>{c.emoji}</Td>
                  <Td>{c.crop_id}</Td>
                  <Td>{c.name_en}</Td>
                  <Td>
                    <button
                      onClick={async () => { await delFn({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ["adminCrops"] }); }}
                      className="text-destructive hover:opacity-80"
                      aria-label={t("delete", lang)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Td>
                </tr>
              ))}
              {!data.length && <tr><Td>—</Td><Td>—</Td><Td>{t("noRecordsYet", lang)}</Td><Td>{" "}</Td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ----- Feedback -----
function FeedbackTab({ lang }: { lang: LangCode }) {
  const fn = useServerFn(listDiagnosisFeedback);
  const { data = [], isLoading } = useQuery({ queryKey: ["adminFeedback"], queryFn: () => fn() });
  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin" />;
  if (!data.length) return <p className="text-muted-foreground text-sm">{t("noRecordsYet", lang)}</p>;
  return (
    <div className="field-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left">
          <tr>
            <Th>{t("date", lang)}</Th>
            <Th>{t("helpful", lang)}</Th>
            <Th>{t("comment", lang)}</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((f: any) => (
            <tr key={f.id} className="border-t border-border">
              <Td>{new Date(f.created_at).toLocaleString()}</Td>
              <Td>
                <span className={`px-2 py-0.5 rounded-full text-xs ${f.helpful ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                  {f.helpful ? t("helpful", lang) : t("notHelpful", lang)}
                </span>
              </Td>
              <Td className="max-w-md">{f.comment || "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
