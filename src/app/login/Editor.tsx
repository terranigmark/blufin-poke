"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_LABELS, STEPS, money, type Status } from "@/data/menu";
import {
  ApiError,
  editorFetch,
  isSignedIn,
  signIn,
  signOut,
  type BeerRow,
  type DrinkRow,
  type ExtraRow,
  type IngredientRow,
  type Kind,
  type MenuRows,
} from "@/lib/api";
import s from "./editor.module.css";

/*
 * The manager's menu editor, modelled on Cervesoft's /taplist-admin: one page,
 * sign in, then collapsible sections with an availability switch and a ⋮ menu
 * per item, and a sheet to edit, add or delete. Every change is saved to the API right away.
 */

type AnyRow = MenuRows[Kind][number];
type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "url" | "color" | "textarea" | "checkbox" | "select";
  options?: string[];
  hint?: string;
  optional?: boolean;
};

const NAME: Field = { name: "name", label: "Nombre" };
// The public site shows these when a visitor reads it in English; empty falls back to the Spanish.
const NAME_EN: Field = { name: "name_en", label: "Nombre en inglés", optional: true, hint: "Opcional. Si lo dejas vacío, se usa el nombre en español." };
const PRICE: Field = { name: "price", label: "Precio (MXN)", type: "number" };

const FIELDS: Record<Kind, Field[]> = {
  sizes: [NAME, NAME_EN, PRICE],
  ingredients: [NAME, NAME_EN, { name: "image_url", label: "Foto (URL)", type: "url", hint: "Opcional. Enlace a una imagen." }],
  extras: [NAME, NAME_EN, PRICE, { name: "in_builder", label: "Se ofrece en Arma tu poke", type: "checkbox" }],
  beers: [
    { name: "tap", label: "Grifo", hint: "Ej. 09" },
    NAME,
    NAME_EN,
    { name: "style", label: "Estilo" },
    { name: "abv", label: "ABV", hint: "Ej. 5.2%" },
    { name: "price_12", label: "Precio 12 oz", type: "number" },
    { name: "price_16", label: "Precio 16 oz", type: "number" },
    { name: "color", label: "Color en el menú", type: "color" },
    { name: "description", label: "Descripción", type: "textarea" },
    { name: "description_en", label: "Descripción en inglés", type: "textarea", hint: "Opcional. Si la dejas vacía, se usa la descripción en español." },
  ],
  drinks: [NAME, NAME_EN, PRICE, { name: "size", label: "Tamaño", hint: "Ej. 355 ml" }, { name: "pack", label: "Envase", type: "select", options: ["Botella", "Lata"] }],
};

type Section = {
  id: string;
  title: string;
  kind: Kind;
  /** Which rows of `kind` belong here, and the values a new one starts with. */
  where?: Record<string, string>;
  sub: (r: AnyRow) => string;
};

const priced = (r: AnyRow) => money((r as ExtraRow).price);

const SECTIONS: Section[] = [
  { id: "sizes", title: "Tamaños de bowl", kind: "sizes", sub: priced },
  ...STEPS.map((st) => ({
    id: st.key,
    title: st.short,
    kind: "ingredients" as const,
    where: { step: st.key },
    sub: (r: AnyRow) => ((r as IngredientRow).image_url ? "Con foto" : "Sin foto"),
  })),
  { id: "extras", title: "Extras", kind: "extras", sub: (r) => priced(r) + ((r as ExtraRow).in_builder ? " · en Arma tu poke" : "") },
  {
    id: "beers",
    title: "Cerveza de barril",
    kind: "beers",
    sub: (r) => {
      const b = r as BeerRow;
      return `Grifo ${b.tap} · ${b.style} · ${b.abv} · ${money(b.price_12)} / ${money(b.price_16)}`;
    },
  },
  ...(["aguas", "nacional"] as const).map((category) => ({
    id: category,
    title: category === "aguas" ? "Aguas y refrescos" : "Cerveza nacional",
    kind: "drinks" as const,
    where: { category },
    sub: (r: AnyRow) => {
      const d = r as DrinkRow;
      return `${money(d.price)} · ${d.pack} · ${d.size}`;
    },
  })),
];

/** "Marcar como…" in the ⋮ menu, Cervesoft's order; "" is plain available. */
const STATUSES: [Status, string, IconName][] = [
  ["", "disponible", "check"],
  ["agotado", "agotado", "ban"],
  ["proximamente", "próximamente", "hourglass"],
  ["por_agotarse", "por agotarse", "flame"],
  ["novedad", "novedad", "sparkles"],
];
const statusLabel = (st?: Status) => (st ? STATUS_LABELS[st][0] : "");
const DELETE_ASK = (name: string) => `¿Borrar “${name}” del menú? Si solo se acabó, mejor márcalo como agotado u ocúltalo.`;

const sortRows = (kind: Kind, rows: AnyRow[]) =>
  [...rows].sort((a, b) =>
    kind === "beers" ? (a as BeerRow).tap.localeCompare((b as BeerRow).tap) : a.order - b.order || a.id - b.id,
  );

const rowsOf = (data: MenuRows, sec: Section) =>
  sortRows(
    sec.kind,
    (data[sec.kind] as AnyRow[]).filter((r) =>
      Object.entries(sec.where ?? {}).every(([k, v]) => (r as Record<string, unknown>)[k] === v),
    ),
  );

// ---------------------------------------------------------------- Page

/** Renders only once the stored session matches `signedIn`; otherwise sends the visitor to the other page. */
function useGate(signedIn: boolean, elsewhere: string) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (isSignedIn() === signedIn) setOk(true);
    else router.replace(elsewhere);
  }, [router, signedIn, elsewhere]);
  return { ok, router };
}

/** /login: the sign-in form, or straight on to /admin when already signed in. */
export function LoginPage() {
  const { ok, router } = useGate(false, "/admin/");
  return ok ? <LoginForm onDone={() => router.replace("/admin/")} /> : <div className={s.center} />;
}

/** /admin: the editor, or back to /login when signed out. */
export function AdminPage() {
  const { ok, router } = useGate(true, "/login/");
  if (!ok) return <div className={s.center} />;
  return (
    <Panel
      onSignOut={() => {
        signOut();
        router.replace("/login/");
      }}
    />
  );
}

function Brand() {
  return (
    <div className={s.brand}>
      <span className={s.blufin}>Blufin</span>
      <span className={s.pokeco}>Poke Co</span>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await signIn(String(f.get("email")), String(f.get("password")));
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No hay conexión con el servidor. Revisa tu internet.");
      setBusy(false);
    }
  };

  return (
    <main className={s.center}>
      <form className={s.loginCard} onSubmit={submit}>
        <Brand />
        <h1 className={s.loginTitle}>Editor del menú</h1>
        <p className={s.muted}>Entra con tu correo y contraseña.</p>
        <label className={s.field}>
          <span>Correo</span>
          <input name="email" type="email" autoComplete="username" required autoFocus />
        </label>
        <label className={s.field}>
          <span>Contraseña</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <button className={s.primary} disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <Link href="/" className={s.back}>
          ← Volver al sitio
        </Link>
      </form>
    </main>
  );
}

// ---------------------------------------------------------------- Editor panel

type Save = "idle" | "saving" | "saved" | { error: string };
type Sheet = { sec: Section; row: Partial<AnyRow> } | null;
/** The last change, and how to put things back as they were. */
type Undo = { label: string; run: () => Promise<unknown> } | null;

function Panel({ onSignOut }: { onSignOut: () => void }) {
  const [data, setData] = useState<MenuRows | null>(null);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<Save>("idle");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sheet, setSheetState] = useState<Sheet>(null);
  const setSheet = (next: Sheet) => {
    if (typeof save === "object") setSave("idle"); // don't greet a new sheet with an old error
    setSheetState(next);
  };
  const [undo, setUndo] = useState<Undo>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10_000);
    return () => clearTimeout(t);
  }, [undo]);
  const runUndo = () => {
    undo?.run();
    setUndo(null);
  };

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return onSignOut();
    setSave({ error: err instanceof Error ? err.message : "No se pudo guardar." });
  };

  const load = () => {
    setLoadError("");
    editorFetch<MenuRows>("editor/").then(setData, (err) => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return onSignOut();
      setLoadError(err instanceof Error ? err.message : "No se pudo cargar el menú.");
    });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Saves one row and puts the server's copy in place; `optimistic` shows it before the server answers. */
  const persist = async (kind: Kind, row: Partial<AnyRow>, optimistic = false) => {
    const put = (r: AnyRow) =>
      setData((d) => d && { ...d, [kind]: (d[kind] as AnyRow[]).some((x) => x.id === r.id) ? (d[kind] as AnyRow[]).map((x) => (x.id === r.id ? r : x)) : [...d[kind], r] });
    const before = data?.[kind];
    if (optimistic && row.id) put({ ...(data![kind] as AnyRow[]).find((x) => x.id === row.id)!, ...row });
    setSave("saving");
    try {
      const saved = await editorFetch<AnyRow>(row.id ? `editor/${kind}/${row.id}/` : `editor/${kind}/`, {
        method: row.id ? "PATCH" : "POST",
        body: JSON.stringify(row),
      });
      put(saved);
      setSave("saved");
      return saved;
    } catch (err) {
      if (optimistic && before) setData((d) => d && { ...d, [kind]: before });
      fail(err);
      return null;
    }
  };

  const remove = async (kind: Kind, id: number) => {
    setSave("saving");
    try {
      await editorFetch(`editor/${kind}/${id}/`, { method: "DELETE" });
      setData((d) => d && { ...d, [kind]: (d[kind] as AnyRow[]).filter((x) => x.id !== id) });
      setSave("saved");
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  };

  /** Swap a row with its neighbour, renumbering the section so every item has its own position. */
  const move = (sec: Section, rows: AnyRow[], i: number, dir: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    const moved = next.filter((r, order) => r.order !== order);
    moved.forEach((r) => persist(sec.kind, { id: r.id, order: next.indexOf(r) }, true));
    setUndo({
      label: `Moviste “${rows[i].name}”`,
      run: () => Promise.all(moved.map((r) => persist(sec.kind, { id: r.id, order: r.order }, true))),
    });
  };

  const toggle = async (sec: Section, r: AnyRow, available: boolean) => {
    if (await persist(sec.kind, { id: r.id, available }, true))
      setUndo({
        label: `“${r.name}” ${available ? "visible" : "oculto"}`,
        run: () => persist(sec.kind, { id: r.id, available: !available }, true),
      });
  };

  const setStatus = async (sec: Section, r: AnyRow, status: Status) => {
    if (await persist(sec.kind, { id: r.id, status }, true))
      setUndo({
        label: `“${r.name}” ${STATUSES.find(([v]) => v === status)![1]}`,
        run: () => persist(sec.kind, { id: r.id, status: r.status ?? "" }, true),
      });
  };

  /** A copy goes last in its section (beers on the next free tap); the backend gives it its own key. */
  const duplicate = async (sec: Section, r: AnyRow, all: AnyRow[]) => {
    const { id: _id, key: _key, ...rest } = r as AnyRow & { key?: string };
    const { order, tap } = blank(sec.kind, all) as Partial<BeerRow>;
    const saved = await persist(sec.kind, { ...rest, name: `${r.name.slice(0, 92)} (copia)`, order, ...(tap && { tap }) } as Partial<AnyRow>);
    if (saved) setUndo({ label: `Duplicaste “${r.name}”`, run: () => remove(sec.kind, saved.id) });
  };

  /** Sheet "Guardar"/"Agregar": undo restores the previous version, or removes the new item. */
  const saveSheet = async (sec: Section, row: Partial<AnyRow>) => {
    const old = row.id ? (data![sec.kind] as AnyRow[]).find((x) => x.id === row.id) : undefined;
    const saved = await persist(sec.kind, row);
    if (!saved) return;
    setSheet(null);
    setUndo(
      old
        ? { label: `Guardaste “${saved.name}”`, run: () => persist(sec.kind, old) }
        : { label: `Agregaste “${saved.name}”`, run: () => remove(sec.kind, saved.id) },
    );
  };

  /** Undo puts a deleted item back as a new row with the same content. */
  const deleteSheet = async (sec: Section, id: number) => {
    const old = (data![sec.kind] as AnyRow[]).find((x) => x.id === id)!;
    if (!(await remove(sec.kind, id))) return;
    setSheet(null);
    setUndo({ label: `Borraste “${old.name}”`, run: () => persist(sec.kind, { ...old, id: undefined }) });
  };

  const term = search.trim().toLowerCase();
  const groups = useMemo(
    () =>
      data
        ? SECTIONS.map((sec) => {
            const all = rowsOf(data, sec);
            return { sec, all, rows: term ? all.filter((r) => r.name.toLowerCase().includes(term)) : all };
          }).filter((g) => !term || g.rows.length)
        : [],
    [data, term],
  );

  if (!data)
    return (
      <main className={s.center}>
        {loadError ? (
          <div className={s.loginCard}>
            <p className={s.error}>{loadError}</p>
            <button className={s.primary} onClick={load}>
              Reintentar
            </button>
          </div>
        ) : (
          <p className={s.muted}>Cargando el menú…</p>
        )}
      </main>
    );

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.headerRow}>
          <div>
            <Brand />
            <p className={s.saveState} aria-live="polite">
              {save === "saving" ? "Guardando…" : save === "saved" ? "Cambios guardados" : typeof save === "object" ? <span className={s.errorText}>{save.error}</span> : "Los cambios se guardan al momento"}
            </p>
          </div>
          <div className={s.headerActions}>
            <Link href="/menu/" target="_blank" className={s.ghost}>
              Ver menú
            </Link>
            <button className={s.ghost} onClick={onSignOut}>
              Salir
            </button>
          </div>
        </div>
        <input
          className={s.search}
          type="search"
          placeholder="Buscar en el menú"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar en el menú"
        />
      </header>

      <main className={s.main}>
        {groups.map(({ sec, all, rows }) => {
          const expanded = !!term || open[sec.id];
          const hidden = all.filter((r) => !r.available).length;
          return (
            <section key={sec.id} className={s.card}>
              <div className={s.cardHead}>
                <button className={s.cardToggle} onClick={() => setOpen((o) => ({ ...o, [sec.id]: !o[sec.id] }))} aria-expanded={expanded}>
                  <span className={s.chevron} data-open={expanded} aria-hidden>
                    ›
                  </span>
                  <span className={s.cardTitle}>{sec.title}</span>
                  <span className={s.count}>
                    {all.length}
                    {hidden ? ` · ${hidden} oculto${hidden > 1 ? "s" : ""}` : ""}
                  </span>
                </button>
                <button
                  className={s.add}
                  aria-label={`Agregar a ${sec.title}`}
                  onClick={() => setSheet({ sec, row: { ...blank(sec.kind, all), ...sec.where } })}
                >
                  + Agregar
                </button>
              </div>
              {expanded && (
                <ul className={s.list}>
                  {rows.length === 0 && <li className={s.empty}>Nada aquí todavía.</li>}
                  {rows.map((r, i) => (
                    <li key={r.id} className={s.row} data-hidden={!r.available} data-status={r.status || undefined}>
                      {sec.kind === "beers" ? (
                        <span className={s.dot} style={{ background: (r as BeerRow).color }} />
                      ) : sec.kind === "ingredients" ? (
                        (r as IngredientRow).image_url ? <img className={s.thumb} src={(r as IngredientRow).image_url} alt="" /> : <span className={s.thumb} />
                      ) : null}
                      <button className={s.rowMain} onClick={() => setSheet({ sec, row: r })}>
                        <span className={s.rowName}>{r.name}</span>
                        <span className={s.rowSub}>
                          {r.available ? [sec.sub(r), statusLabel(r.status)].filter(Boolean).join(" · ") : "Oculto en el menú"}
                        </span>
                      </button>
                      {sec.kind !== "beers" && !term && (
                        <span className={s.arrows}>
                          <button aria-label={`Subir ${r.name}`} disabled={i === 0} onClick={() => move(sec, rows, i, -1)}>
                            ↑
                          </button>
                          <button aria-label={`Bajar ${r.name}`} disabled={i === rows.length - 1} onClick={() => move(sec, rows, i, 1)}>
                            ↓
                          </button>
                        </span>
                      )}
                      <label className={s.switch} title={r.available ? "Disponible" : "Oculto"}>
                        <input
                          type="checkbox"
                          checked={r.available}
                          onChange={(e) => toggle(sec, r, e.target.checked)}
                          aria-label={`${r.name} disponible`}
                        />
                        <span aria-hidden />
                      </label>
                      <RowMenu
                        name={r.name}
                        actions={[
                          ["Editar", "pencil", () => setSheet({ sec, row: r })],
                          ["Duplicar", "copy", () => duplicate(sec, r, all)],
                          ...STATUSES.filter(([v]) => v !== (r.status ?? "")).map(
                            ([v, label, icon]): Action => [`Marcar como ${label}`, icon, () => setStatus(sec, r, v)],
                          ),
                          r.available
                            ? ["Ocultar del menú", "eyeOff", () => toggle(sec, r, false)]
                            : ["Mostrar en el menú", "eye", () => toggle(sec, r, true)],
                          ["Eliminar", "trash", () => confirm(DELETE_ASK(r.name)) && deleteSheet(sec, r.id), true],
                        ]}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        {groups.length === 0 && <p className={s.muted}>Nada coincide con “{search}”.</p>}
      </main>

      {sheet && (
        <ItemSheet
          key={sheet.row.id ?? "new"}
          sheet={sheet}
          onClose={() => setSheet(null)}
          onSave={(row) => saveSheet(sheet.sec, row)}
          onDelete={() => deleteSheet(sheet.sec, sheet.row.id!)}
          error={typeof save === "object" ? save.error : ""}
        />
      )}

      {undo && (
        <div className={s.undo} role="status">
          <span>{undo.label}</span>
          <button onClick={runUndo}>Deshacer</button>
        </div>
      )}
    </div>
  );
}

/** A new item goes last in its section; beers get the next free tap. */
function blank(kind: Kind, rows: AnyRow[]): Partial<AnyRow> {
  const order = rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0;
  if (kind === "beers") {
    const tap = String(Math.max(0, ...rows.map((r) => Number((r as BeerRow).tap) || 0)) + 1).padStart(2, "0");
    return { name: "", available: true, order, tap, color: "#E8B84A" } as Partial<BeerRow>;
  }
  if (kind === "drinks") return { name: "", available: true, order, pack: "Botella" } as Partial<DrinkRow>;
  return { name: "", available: true, order };
}

// ---------------------------------------------------------------- Row ⋮ menu (Cervesoft's kebab menu)

// Outline icons drawn like Cervesoft's (Lucide, ISC licence), inlined to avoid adding an icon package.
const ICONS = {
  pencil: <><path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" /><path d="m15 5 4 4" /></>,
  copy: <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>,
  check: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  ban: <><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></>,
  hourglass: <><path d="M5 22h14M5 2h14" /><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" /><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" /></>,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  sparkles: <><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" /><path d="M20 3v4M22 5h-4" /></>,
  eyeOff: <><path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49" /><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" /><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14" /><path d="m2 2 20 20" /></>,
  eye: <><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" /><circle cx="12" cy="12" r="3" /></>,
  trash: <><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>,
};
type IconName = keyof typeof ICONS;

/** Label, icon, what it does, and whether it's the red one at the bottom. */
type Action = [string, IconName, () => unknown, danger?: boolean];

function RowMenu({ name, actions }: { name: string; actions: Action[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className={s.kebab} ref={ref}>
      <button className={s.kebabButton} aria-label={`Opciones de ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        ⋮
      </button>
      {open && (
        <div className={s.kebabMenu} role="menu" aria-label={`Opciones de ${name}`}>
          {actions.map(([label, icon, run, danger]) => (
            <button
              key={label}
              role="menuitem"
              className={danger ? s.kebabDanger : undefined}
              onClick={() => {
                setOpen(false);
                run();
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                {ICONS[icon]}
              </svg>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Edit sheet

function ItemSheet({
  sheet: { sec, row },
  onClose,
  onSave,
  onDelete,
  error,
}: {
  sheet: NonNullable<Sheet>;
  onClose: () => void;
  onSave: (row: Partial<AnyRow>) => Promise<void>;
  onDelete: () => Promise<void>;
  error: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState((row as IngredientRow).image_url ?? "");
  // Set by any edit in the form, so closing without saving asks before throwing the edits away.
  const [dirty, setDirty] = useState(false);
  useEffect(() => ref.current?.showModal(), []);
  const isNew = !row.id;

  const cancel = () => {
    if (!dirty || confirm("¿Descartar los cambios? Se quedará como estaba.")) ref.current?.close();
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const out: Record<string, unknown> = { ...sec.where, id: row.id, available: f.get("available") === "on" };
    if (isNew) out.order = row.order;
    for (const fl of FIELDS[sec.kind]) {
      const v = f.get(fl.name);
      out[fl.name] = fl.type === "checkbox" ? v === "on" : fl.type === "number" ? Number(v) : String(v ?? "").trim();
    }
    setBusy(true);
    await onSave(out as Partial<AnyRow>);
    setBusy(false);
  };

  const del = async () => {
    if (!confirm(DELETE_ASK(row.name ?? ""))) return;
    setBusy(true);
    await onDelete();
    setBusy(false);
  };

  const value = (name: string) => (row as Record<string, unknown>)[name];

  return (
    <dialog
      ref={ref}
      className={s.sheet}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault(); // Esc goes through the same "discard?" check
        cancel();
      }}
      onClick={(e) => e.target === ref.current && cancel()}
    >
      <form onSubmit={submit} onInput={() => setDirty(true)} className={s.sheetBody}>
        <div className={s.sheetHead}>
          <h2>{isNew ? `Agregar · ${sec.title}` : row.name}</h2>
          <button type="button" className={s.close} onClick={cancel} aria-label="Cerrar sin guardar">
            ×
          </button>
        </div>

        {FIELDS[sec.kind].map((fl) =>
          fl.type === "checkbox" ? (
            <label key={fl.name} className={s.check}>
              <input type="checkbox" name={fl.name} defaultChecked={!!value(fl.name)} />
              <span>{fl.label}</span>
            </label>
          ) : (
            <label key={fl.name} className={s.field}>
              <span>{fl.label}</span>
              {fl.type === "textarea" ? (
                <textarea name={fl.name} defaultValue={String(value(fl.name) ?? "")} rows={3} maxLength={200} />
              ) : fl.type === "select" ? (
                <select name={fl.name} defaultValue={String(value(fl.name) ?? "")}>
                  {fl.options!.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  name={fl.name}
                  type={fl.type ?? "text"}
                  defaultValue={String(value(fl.name) ?? "")}
                  required={!fl.optional && fl.type !== "url"}
                  min={fl.type === "number" ? 0 : undefined}
                  inputMode={fl.type === "number" ? "numeric" : undefined}
                  onChange={fl.type === "url" ? (e) => setImg(e.target.value) : undefined}
                />
              )}
              {fl.hint && <small>{fl.hint}</small>}
              {fl.type === "url" && img && <img className={s.preview} src={img} alt="Vista previa" />}
            </label>
          ),
        )}

        <label className={s.check}>
          <input type="checkbox" name="available" defaultChecked={row.available ?? true} />
          <span>Disponible (se ve en el menú)</span>
        </label>

        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}

        <div className={s.sheetActions}>
          {!isNew && (
            <button type="button" className={s.danger} onClick={del} disabled={busy}>
              Borrar
            </button>
          )}
          <span className={s.sheetEnd}>
            <button type="button" className={s.ghost} onClick={cancel} disabled={busy}>
              Cancelar
            </button>
            <button className={s.primary} disabled={busy}>
              {busy ? "Guardando…" : isNew ? "Agregar" : "Guardar"}
            </button>
          </span>
        </div>
      </form>
    </dialog>
  );
}
