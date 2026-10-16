"use client";

import { useState } from "react";
import type { Landing } from "@/data/landing";
import { editorFetch, mediaUrl } from "@/lib/api";
import s from "./editor.module.css";

/*
 * /admin's "Página de inicio": one card per section of the home page. Each card is a
 * form saved whole with Guardar, after a confirmation (Panel adds Deshacer). Pictures and videos upload as
 * soon as they're picked and go live with the rest of the card.
 */

export type LandingSection = keyof Landing;

type Field = {
  name: string;
  label: string;
  type?: "text" | "lines" | "image" | "logo" | "video" | "link" | "list";
  /** Adds the optional English field `<name>_en`. */
  en?: boolean;
  hint?: string;
  /** For lists: the fields of each entry, what one entry is called, and how many fit. */
  item?: Field[];
  itemLabel?: string;
  max?: number;
};

const LINK_HINT = "Una página del sitio, como /menu?tab=extras, o un enlace https://.";

const CARDS: { id: LandingSection; title: string; fields: Field[] }[] = [
  {
    id: "header",
    title: "Encabezado",
    fields: [
      { name: "marlin_logo", label: "Logo de Black Marlin", type: "logo", hint: "Sin logo se muestran las letras BLACK MARLIN BREWING." },
      { name: "blufin_logo", label: "Logo de Blufin Poke Co", type: "logo", hint: "Sin logo se muestran las letras Blufin POKE CO." },
    ],
  },
  {
    id: "hero",
    title: "Portada",
    fields: [
      { name: "image", label: "Foto", type: "image", hint: "Se ve mientras carga el video, o sola si no hay video." },
      { name: "video", label: "Video", type: "video", hint: "Opcional. MP4 o WebM de hasta 12 MB, sin sonido. Corto y en bucle se ve mejor." },
      { name: "slogan", label: "Frase", en: true },
      { name: "title", label: "Título", type: "lines", en: true, hint: "Cada renglón se muestra en su propia línea." },
      { name: "lead", label: "Texto bajo el título", en: true },
      { name: "hours", label: "Días y horario", en: true },
      { name: "address", label: "Dirección", en: true },
    ],
  },
  {
    id: "belt",
    title: "Franja animada",
    fields: [{ name: "words", label: "Textos", type: "list", item: [{ name: "text", label: "Texto", en: true }], itemLabel: "texto", max: 12, hint: "Se repiten en orden a lo ancho de la franja." }],
  },
  {
    id: "build",
    title: "Arma tu poke",
    fields: [
      { name: "title", label: "Título", en: true },
      { name: "lead", label: "Descripción", en: true },
      { name: "steps", label: "Pasos", type: "list", item: [{ name: "text", label: "Paso", en: true }], itemLabel: "paso", max: 10, hint: "Se numeran solos, en este orden." },
      { name: "cta", label: "Texto del botón", en: true, hint: "El botón lleva a Arma tu poke." },
      { name: "image", label: "Foto", type: "image" },
    ],
  },
  {
    id: "cravings",
    title: "¿Qué se te antoja?",
    fields: [
      { name: "title", label: "Título", en: true },
      {
        name: "tiles",
        label: "Fotos",
        type: "list",
        item: [
          { name: "image", label: "Foto", type: "image" },
          { name: "text", label: "Texto", en: true },
          { name: "link", label: "Enlace", type: "link", hint: LINK_HINT },
        ],
        itemLabel: "foto",
        max: 6,
        hint: "Cada foto lleva su texto encima y abre su enlace.",
      },
    ],
  },
];

const IMAGE_SIDE = 1920;
const LOGO_SIDE = 600;
const VIDEO_MAX = 12_000_000;

/** A picked file as the data: URL the API takes; pictures shrink first (logos keep their transparency). */
async function encode(file: File, kind: "image" | "logo" | "video"): Promise<string> {
  if (kind === "video") {
    if (file.size > VIDEO_MAX) throw new Error("El video pesa más de 12 MB.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer el video."));
      reader.readAsDataURL(file);
    });
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Esa imagen no se pudo leer.");
  });
  const max = kind === "logo" ? LOGO_SIDE : IMAGE_SIDE;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return kind === "logo" ? canvas.toDataURL("image/webp", 0.9) : canvas.toDataURL("image/jpeg", 0.85);
}

export function LandingCards({
  landing,
  onSave,
}: {
  landing: Landing;
  /** Saves one section; resolves false (and shows why) when the API refused it. */
  onSave: (id: LandingSection, value: Landing[LandingSection]) => Promise<boolean>;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <>
      {CARDS.map((card) => {
        const open = !collapsed[card.id];
        return (
          <section key={card.id} className={s.card}>
            <div className={s.cardHead}>
              <button className={s.cardToggle} onClick={() => setCollapsed((c) => ({ ...c, [card.id]: open }))} aria-expanded={open}>
                <span className={s.chevron} data-open={open} aria-hidden>
                  ›
                </span>
                <span className={s.cardTitle}>{card.title}</span>
              </button>
            </div>
            {/* Keyed by the saved content, so a save or Deshacer starts the form over from it. */}
            {open && <CardForm key={JSON.stringify(landing[card.id])} card={card} value={landing[card.id]} onSave={(v) => onSave(card.id, v)} />}
          </section>
        );
      })}
    </>
  );
}

type Draft = Record<string, unknown>;

function CardForm({ card, value, onSave }: { card: (typeof CARDS)[number]; value: Landing[LandingSection]; onSave: (v: Landing[LandingSection]) => Promise<boolean> }) {
  const [draft, setDraft] = useState<Draft>(value as Draft);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const set = (name: string, v: unknown) => setDraft((d) => ({ ...d, [name]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // These are the first thing every visitor sees, so a stray tap shouldn't publish them.
    if (!confirm(`¿Publicar los cambios de “${card.title}” en la página de inicio?`)) return;
    setBusy(true);
    await onSave(draft as Landing[LandingSection]);
    setBusy(false);
  };

  return (
    <form className={s.landingForm} onSubmit={submit} aria-label={card.title}>
      {card.fields.map((f) => (
        <FieldView key={f.name} field={f} get={(n) => draft[n]} set={set} />
      ))}
      <div className={s.sheetActions}>
        {dirty && (
          <button type="button" className={s.ghost} onClick={() => setDraft(value as Draft)} disabled={busy}>
            Descartar cambios
          </button>
        )}
        <button className={s.primary} disabled={busy || !dirty}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function MediaField({ field, kind, value, onChange }: { field: Field; kind: "image" | "logo" | "video"; value: string; onChange: (v: string) => void }) {
  const [state, setState] = useState<"" | "uploading" | { error: string }>("");
  const pick = async (file?: File) => {
    if (!file) return;
    setState("uploading");
    try {
      const { src } = await editorFetch<{ src: string }>("editor/media/", { method: "POST", body: JSON.stringify({ file: await encode(file, kind) }) });
      onChange(src);
      setState("");
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : "No se pudo subir." });
    }
  };
  return (
    <div className={s.field}>
      <span>{field.label}</span>
      {value &&
        (kind === "video" ? (
          <video className={s.mediaPreview} src={mediaUrl(value)} muted loop autoPlay playsInline />
        ) : (
          <img className={kind === "logo" ? s.logoPreview : s.mediaPreview} src={mediaUrl(value)} alt="Vista previa" />
        ))}
      <div className={s.mediaActions}>
        <label className={s.ghost}>
          {state === "uploading" ? "Subiendo…" : value ? "Cambiar" : kind === "video" ? "Subir video" : "Subir imagen"}
          <input
            type="file"
            hidden
            accept={kind === "video" ? "video/mp4,video/webm" : "image/*"}
            disabled={state === "uploading"}
            aria-label={`${field.label}: subir archivo`}
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        {value && (
          <button type="button" className={s.ghost} onClick={() => onChange("")}>
            Quitar
          </button>
        )}
      </div>
      {typeof state === "object" && (
        <p className={s.error} role="alert">
          {state.error}
        </p>
      )}
      {field.hint && <small>{field.hint}</small>}
    </div>
  );
}

/** One field of a card, or of a list entry (`n` numbers it there: "Texto 2"). */
function FieldView({ field: f, get, set, n }: { field: Field; get: (name: string) => unknown; set: (name: string, v: unknown) => void; n?: number }) {
  const str = (name: string) => String(get(name) ?? "");
  const label = n ? `${f.label} ${n}` : f.label;
  if (f.type === "image" || f.type === "logo" || f.type === "video")
    return <MediaField field={{ ...f, label }} kind={f.type} value={str(f.name)} onChange={(v) => set(f.name, v)} />;
  if (f.type === "list") return <ListField field={f} items={get(f.name) as Draft[]} onChange={(v) => set(f.name, v)} />;
  const Input = f.type === "lines" ? "textarea" : "input";
  const max = f.type === "lines" ? 80 : f.type === "link" ? 300 : n ? 60 : 120;
  return (
    <div className={s.landingPair}>
      <label className={s.field}>
        <span>{label}</span>
        <Input value={str(f.name)} rows={f.type === "lines" ? 2 : undefined} maxLength={max} required onChange={(e) => set(f.name, e.target.value)} />
        {f.hint && <small>{f.hint}</small>}
      </label>
      {f.en && (
        <label className={s.field}>
          <span>{label} en inglés</span>
          <Input value={str(`${f.name}_en`)} rows={f.type === "lines" ? 2 : undefined} maxLength={max} onChange={(e) => set(`${f.name}_en`, e.target.value)} />
          {!n && <small>Opcional. Si lo dejas vacío, se usa el español.</small>}
        </label>
      )}
    </div>
  );
}

/** Entries you add, remove and move up or down: belt texts, steps, pictures. */
function ListField({ field, items, onChange }: { field: Field; items: Draft[]; onChange: (v: Draft[]) => void }) {
  const what = field.itemLabel!;
  const blank = Object.fromEntries(field.item!.flatMap((f) => [[f.name, ""], ...(f.en ? [[`${f.name}_en`, ""]] : [])]));
  const move = (i: number, to: number) => {
    const next = [...items];
    next.splice(to, 0, ...next.splice(i, 1));
    onChange(next);
  };
  return (
    <fieldset className={s.landingList}>
      <legend>{field.label}</legend>
      {field.hint && <small>{field.hint}</small>}
      {items.map((it, i) => (
        <div key={i} className={s.landingItem}>
          <div className={s.landingItemFields}>
            {field.item!.map((f) => (
              <FieldView key={f.name} field={f} n={i + 1} get={(name) => it[name]} set={(name, v) => onChange(items.map((x, j) => (j === i ? { ...x, [name]: v } : x)))} />
            ))}
          </div>
          <div className={s.landingItemActions}>
            <button type="button" aria-label={`Subir ${what} ${i + 1}`} disabled={i === 0} onClick={() => move(i, i - 1)}>
              ↑
            </button>
            <button type="button" aria-label={`Bajar ${what} ${i + 1}`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
              ↓
            </button>
            <button type="button" aria-label={`Quitar ${what} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        </div>
      ))}
      {items.length < field.max! && (
        <button type="button" className={s.add} onClick={() => onChange([...items, blank])}>
          + Añadir {what}
        </button>
      )}
    </fieldset>
  );
}
