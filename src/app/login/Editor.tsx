"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { STEPS, money } from "@/data/menu";
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
 * sign in, then collapsible sections with an availability switch per item and
 * a sheet to edit, add or delete. Every change is saved to the API right away.
 */

type AnyRow = MenuRows[Kind][number];
type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "url" | "color" | "textarea" | "checkbox" | "select";
  options?: string[];
  hint?: string;
};

const NAME: Field = { name: "name", label: "Nombre" };
const PRICE: Field = { name: "price", label: "Precio (MXN)", type: "number" };

const FIELDS: Record<Kind, Field[]> = {
  sizes: [NAME, PRICE],
  ingredients: [NAME, { name: "image_url", label: "Foto (URL)", type: "url", hint: "Opcional. Enlace a una imagen." }],
  extras: [NAME, PRICE, { name: "in_builder", label: "Se ofrece en Arma tu poke", type: "checkbox" }],
  beers: [
    { name: "tap", label: "Grifo", hint: "Ej. 09" },
    NAME,
    { name: "style", label: "Estilo" },
    { name: "abv", label: "ABV", hint: "Ej. 5.2%" },
    { name: "price_12", label: "Precio 12 oz", type: "number" },
    { name: "price_16", label: "Precio 16 oz", type: "number" },
    { name: "color", label: "Color en el menú", type: "color" },
    { name: "description", label: "Descripción", type: "textarea" },
  ],
  drinks: [NAME, PRICE, { name: "size", label: "Tamaño", hint: "Ej. 355 ml" }, { name: "pack", label: "Envase", type: "select", options: ["Botella", "Lata"] }],
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
      return true;
    } catch (err) {
      if (optimistic && before) setData((d) => d && { ...d, [kind]: before });
      fail(err);
      return false;
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
    next.forEach((r, order) => r.order !== order && persist(sec.kind, { id: r.id, order }, true));
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
                    <li key={r.id} className={s.row} data-hidden={!r.available}>
                      {sec.kind === "beers" ? (
                        <span className={s.dot} style={{ background: (r as BeerRow).color }} />
                      ) : sec.kind === "ingredients" ? (
                        (r as IngredientRow).image_url ? <img className={s.thumb} src={(r as IngredientRow).image_url} alt="" /> : <span className={s.thumb} />
                      ) : null}
                      <button className={s.rowMain} onClick={() => setSheet({ sec, row: r })}>
                        <span className={s.rowName}>{r.name}</span>
                        <span className={s.rowSub}>{r.available ? sec.sub(r) : "Oculto en el menú"}</span>
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
                          onChange={(e) => persist(sec.kind, { id: r.id, available: e.target.checked }, true)}
                          aria-label={`${r.name} disponible`}
                        />
                        <span aria-hidden />
                      </label>
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
          onSave={async (row) => (await persist(sheet.sec.kind, row)) && setSheet(null)}
          onDelete={async () => (await remove(sheet.sec.kind, sheet.row.id!)) && setSheet(null)}
          error={typeof save === "object" ? save.error : ""}
        />
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
  onSave: (row: Partial<AnyRow>) => void;
  onDelete: () => void;
  error: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState((row as IngredientRow).image_url ?? "");
  useEffect(() => ref.current?.showModal(), []);
  const isNew = !row.id;

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
    if (!confirm(`¿Borrar “${row.name}” del menú? Esto no se puede deshacer. Si solo se acabó, mejor ocúltalo con el interruptor.`)) return;
    setBusy(true);
    await onDelete();
    setBusy(false);
  };

  const value = (name: string) => (row as Record<string, unknown>)[name];

  return (
    <dialog ref={ref} className={s.sheet} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <form onSubmit={submit} className={s.sheetBody}>
        <div className={s.sheetHead}>
          <h2>{isNew ? `Agregar · ${sec.title}` : row.name}</h2>
          <button type="button" className={s.close} onClick={() => ref.current?.close()} aria-label="Cerrar">
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
                  required={fl.type !== "url"}
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
          <button className={s.primary} disabled={busy}>
            {busy ? "Guardando…" : isNew ? "Agregar" : "Guardar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
