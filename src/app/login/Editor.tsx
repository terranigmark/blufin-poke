"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LANDING, type Landing } from "@/data/landing";
import { LISTS, SRM, STATUS_LABELS, STEPS, money, srmColor, type Status } from "@/data/menu";
import {
  ApiError,
  editorFetch,
  isSignedIn,
  signIn,
  signOut,
  type BeerRow,
  type BowlRow,
  type CategoryRow,
  type DrinkRow,
  type ExtraRow,
  type IngredientRow,
  type Kind,
  type MenuRows,
} from "@/lib/api";
import s from "./editor.module.css";
import { LandingCards, type LandingSection } from "./LandingCards";
import { ActivityCard, UsersCard } from "./UsersCard";

/*
 * The manager's menu editor, a copy of Cervesoft's /taplist-admin (cervesoft-frontend
 * app/taplist-admin/page.tsx): sign in, then one card per section with rows you drag to
 * reorder, a ⋮ menu per row, and a sheet to edit or add. Every change is saved to the API
 * right away, and the last one can be undone.
 */

type AnyRow = MenuRows[Kind][number];
type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "url" | "srm" | "textarea" | "checkbox" | "select";
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
    { name: "srm", label: "Color en el menú", type: "srm" },
    { name: "description", label: "Descripción", type: "textarea" },
    { name: "description_en", label: "Descripción en inglés", type: "textarea", hint: "Opcional. Si la dejas vacía, se usa la descripción en español." },
  ],
  bowls: [
    NAME,
    NAME_EN,
    PRICE,
    { name: "description", label: "Descripción", type: "textarea", hint: "Ej. Atún, aguacate, pepino y salsa ponzu." },
    { name: "description_en", label: "Descripción en inglés", type: "textarea", optional: true, hint: "Opcional. Si la dejas vacía, se usa la descripción en español." },
    { name: "image_url", label: "Foto (URL)", type: "url", optional: true, hint: "Opcional. Enlace a una imagen." },
  ],
  drinks: [
    NAME,
    NAME_EN,
    PRICE,
    { name: "size", label: "Tamaño", hint: "Ej. 355 ml. Opcional.", optional: true },
    { name: "pack", label: "Envase", type: "select", options: ["Botella", "Lata", ""] },
  ],
};

type Group = CategoryRow["group"];
/** Every section belongs to one of these; Arma tu poke's "Agrega una bebida" offers the lists in Bebidas. */
const GROUPS: [Group, string][] = [
  ["poke", "Elementos del poke"],
  ["drinks", "Bebidas"],
  ["others", "Otros"],
];
const groupName = (g: Group) => GROUPS.find(([id]) => id === g)![1];

/** A price list's section: the category it comes from (without an id when the backend sends none). */
type ListCat = Pick<CategoryRow, "key" | "name" | "group" | "order"> & Partial<CategoryRow>;

type Section = {
  id: string;
  title: string;
  kind: Kind;
  group: Group;
  cat?: ListCat;
  /** Which rows of `kind` belong here, and the values a new one starts with. */
  where?: Record<string, string>;
  sub: (r: AnyRow) => string;
};

const priced = (r: AnyRow) => money((r as ExtraRow).price);

const FIXED_SECTIONS: Section[] = [
  { id: "sizes", title: "Tamaños de bowl", kind: "sizes", group: "poke", sub: priced },
  // The first three visible ones show on the home page; fewer than three and that section stays hidden.
  { id: "bowls", title: "Bowls de la casa", kind: "bowls", group: "poke", sub: priced },
  ...STEPS.map((st) => ({
    id: st.key,
    title: st.short,
    kind: "ingredients" as const,
    group: "poke" as const,
    where: { step: st.key },
    // The thumbnail already shows whether it has a photo.
    sub: () => "",
  })),
  { id: "extras", title: "Extras", kind: "extras", group: "poke", sub: (r) => priced(r) + ((r as ExtraRow).in_builder ? " · en Arma tu poke" : "") },
  {
    id: "beers",
    title: "Cerveza de barril",
    kind: "beers",
    group: "drinks",
    sub: (r) => {
      const b = r as BeerRow;
      return `Grifo ${b.tap} · ${b.style} · ${b.abv} · ${money(b.price_12)} / ${money(b.price_16)}`;
    },
  },
];

/** The fixed sections, then one per price list: the manager's lists from the API, or the two the menu ships with. */
const sectionsOf = (data: MenuRows): Section[] => [
  ...FIXED_SECTIONS,
  ...(data.categories?.filter((c) => c.kind === "drinks") ?? LISTS.map((l, order): ListCat => ({ key: l.key, name: l.name, group: l.group, order })))
    .sort((a, b) => a.order - b.order || (a.id ?? 0) - (b.id ?? 0))
    .map((cat) => ({
      id: cat.key,
      title: cat.name,
      kind: "drinks" as const,
      group: cat.group,
      cat,
      where: { category: cat.key },
      sub: (r: AnyRow) => {
        const d = r as DrinkRow;
        return [money(d.price), d.pack, d.size].filter(Boolean).join(" · ");
      },
    })),
];

/** The statuses in Cervesoft's order: "Marcar como…" label, icon, and the hint under its switch in the sheet. */
const STATUSES: [Exclude<Status, "">, string, IconName, string][] = [
  ["agotado", "agotado", "x", "Sigue en el menú, tachado, y no se puede pedir en Arma tu poke."],
  ["proximamente", "próximamente", "hourglass", "Se muestra con la etiqueta Próximamente y todavía no se puede pedir. Al activarlo se quita “agotado”."],
  ["por_agotarse", "por agotarse", "flame", "Se muestra con la etiqueta Por agotarse, para que lo pidan antes de que se acabe. Al activarlo se quitan los otros estados."],
  ["novedad", "novedad", "sparkles", "Se muestra con la etiqueta Novedad, para que vean lo que acaba de llegar. Al activarlo se quitan los otros estados."],
];
const statusLabel = (st?: Status) => (st ? STATUS_LABELS[st][0] : "");
const items = (n: number) => `${n} artículo${n === 1 ? "" : "s"}`;

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
export type Undo = { label: string; run: () => Promise<unknown> } | null;

function Panel({ onSignOut }: { onSignOut: () => void }) {
  const [data, setData] = useState<MenuRows | null>(null);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<Save>("idle");
  const [search, setSearch] = useState("");
  // "Menú", the home page's cards ("Página de inicio"), and for admins "Usuarios" and "Actividad".
  const [picked, setView] = useState<"menu" | "inicio" | "usuarios" | "actividad">("menu");
  // Sections start open, as in Cervesoft; this remembers the ones folded away.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // The round + button adds to the section used last.
  const lastSection = useRef(FIXED_SECTIONS[0]);
  const [sheet, setSheetState] = useState<Sheet>(null);
  const setSheet = (next: Sheet) => {
    if (typeof save === "object") setSave("idle"); // don't greet a new sheet with an old error
    if (next) lastSection.current = next.sec;
    setSheetState(next);
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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

  /** One home page card, saved whole; Deshacer puts back the version before it. */
  const putLanding = async (id: LandingSection, value: Landing[LandingSection]) => {
    setSave("saving");
    try {
      const landing = await editorFetch<Landing>("editor/landing/", { method: "PATCH", body: JSON.stringify({ [id]: value }) });
      setData((d) => d && { ...d, landing });
      setSave("saved");
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  };
  const saveLanding = async (id: LandingSection, value: Landing[LandingSection]) => {
    const old = landing[id];
    const ok = await putLanding(id, value);
    if (ok) setUndo({ label: "Guardaste la página de inicio", run: () => putLanding(id, old) });
    return ok;
  };

  /** A dropped row: renumber the section so every item has its own position. */
  const reorder = (sec: Section, rows: AnyRow[], { active, over }: DragEndEvent) => {
    const from = rows.findIndex((r) => r.id === active.id);
    const to = rows.findIndex((r) => r.id === over?.id);
    if (from < 0 || to < 0 || from === to) return;
    const next = arrayMove(rows, from, to);
    const moved = next.filter((r, order) => r.order !== order);
    moved.forEach((r) => persist(sec.kind, { id: r.id, order: next.indexOf(r) }, true));
    setUndo({
      label: `Moviste “${rows[from].name}”`,
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
        label: `“${r.name}” ${STATUSES.find(([v]) => v === status)?.[1] ?? "disponible"}`,
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

  /** Sheet "Guardar cambios"/"Añadir artículo": undo restores the previous version, or removes the new item. */
  const saveSheet = async (sec: Section, row: Partial<AnyRow>) => {
    const old = row.id ? (data![sec.kind] as AnyRow[]).find((x) => x.id === row.id) : undefined;
    const saved = await persist(sec.kind, row);
    if (!saved) return;
    setSheet(null);
    setUndo(
      old
        ? { label: `Guardaste “${saved.name}”`, run: () => persist(sec.kind, old) }
        : { label: `Añadiste “${saved.name}”`, run: () => remove(sec.kind, saved.id) },
    );
  };

  /** Deletes straight away, as in Cervesoft; Deshacer puts it back as a new row with the same content and key. */
  const deleteRow = async (sec: Section, r: AnyRow) => {
    if (await remove(sec.kind, r.id)) setUndo({ label: `Eliminaste “${r.name}”`, run: () => persist(sec.kind, { ...r, id: undefined }) });
  };

  /** Saves a price list (new, renamed or moved) and puts the server's copy in place. */
  const saveList = async (c: Partial<CategoryRow>) => {
    setSave("saving");
    try {
      const saved = await editorFetch<CategoryRow>(c.id ? `editor/categories/${c.id}/` : "editor/categories/", {
        method: c.id ? "PATCH" : "POST",
        body: JSON.stringify(c),
      });
      setData((d) => {
        const cats = d?.categories ?? [];
        return d && { ...d, categories: cats.some((x) => x.id === saved.id) ? cats.map((x) => (x.id === saved.id ? saved : x)) : [...cats, saved] };
      });
      setSave("saved");
      return saved;
    } catch (err) {
      fail(err);
      return null;
    }
  };

  const addList = async (group: Group) => {
    const name = prompt(`Nombre de la nueva lista en ${groupName(group)}`)?.trim();
    if (!name) return;
    const order = Math.max(0, ...(data?.categories ?? []).map((c) => c.order)) + 1;
    const saved = await saveList({ name, group, order });
    if (saved) setUndo({ label: `Añadiste la lista “${saved.name}”`, run: () => deleteList(saved, 0) });
  };

  const moveList = async (c: CategoryRow, group: Group) => {
    if (await saveList({ id: c.id, group }))
      setUndo({ label: `Moviste “${c.name}” a ${groupName(group)}`, run: () => saveList({ id: c.id, group: c.group }) });
  };

  /** A list goes with its items, so one that has any asks first; this one can't be undone. */
  const deleteList = async (c: CategoryRow, count: number) => {
    if (count && !confirm(`¿Eliminar la lista “${c.name}” y sus ${items(count)}? No se puede deshacer.`)) return;
    setSave("saving");
    try {
      await editorFetch(`editor/categories/${c.id}/`, { method: "DELETE" });
      setData((d) => d && { ...d, categories: d.categories?.filter((x) => x.id !== c.id), drinks: d.drinks.filter((x) => x.category !== c.key) });
      setSave("saved");
    } catch (err) {
      fail(err);
    }
  };

  const term = search.trim().toLowerCase();
  const sections = useMemo(() => (data ? sectionsOf(data) : FIXED_SECTIONS), [data]);
  const groups = useMemo(
    () =>
      data
        ? sections.map((sec) => {
            const all = rowsOf(data, sec);
            return { sec, all, rows: term ? all.filter((r) => r.name.toLowerCase().includes(term)) : all };
          }).filter((g) => !term || g.rows.length)
        : [],
    [data, sections, term],
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

  const landing = { ...LANDING, ...data.landing };
  // Only the tabs this account may use; a backend from before permissions sends no `me` and gets the first two.
  const me = data.me ?? { email: "", admin: false, menu: true, landing: true };
  const tabs = (
    [
      ["menu", "Menú", me.menu],
      ["inicio", "Página de inicio", me.landing],
      ["usuarios", "Usuarios", me.admin],
      ["actividad", "Actividad", me.admin],
    ] as const
  ).filter(([, , ok]) => ok);
  const view = tabs.some(([v]) => v === picked) ? picked : tabs[0][0];
  const total = sections.reduce((n, sec) => n + rowsOf(data, sec).length, 0);
  // Lists in Otros aren't drinks, so their items start without a bottle or can.
  const add = (sec: Section) =>
    setSheet({ sec, row: { ...blank(sec.kind, rowsOf(data, sec)), ...sec.where, ...(sec.group === "others" && { pack: "" }) } as Partial<AnyRow> });

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.headerRow}>
          <div>
            <Brand />
            <p className={s.saveState} aria-live="polite">
              {items(total)} · {sections.length} secciones ·{" "}
              {save === "saving" ? "Guardando…" : typeof save === "object" ? <span className={s.errorText}>{save.error}</span> : "Guardado"}
            </p>
          </div>
          <div className={s.headerActions}>
            <Link href="/menu/" target="_blank" className={s.iconButton} aria-label="Ver menú público">
              <Icon name="externalLink" />
            </Link>
            <RowMenu label="Más" actions={[["Salir", "logOut", onSignOut]]} />
          </div>
        </div>
        <div className={s.tabs} role="tablist">
          {tabs.map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
        {view === "menu" && (
          <div className={s.searchBox}>
            <Icon name="search" />
            <input type="search" placeholder="Buscar artículos" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar artículos" />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Borrar búsqueda">
                <Icon name="x" />
              </button>
            )}
          </div>
        )}
      </header>

      <main className={s.main}>
        {view === "inicio" && (
          <>
            {typeof save === "object" && (
              <p className={s.error} role="alert">
                {save.error}
              </p>
            )}
            <LandingCards landing={landing} onSave={saveLanding} />
          </>
        )}
        {view === "usuarios" && <UsersCard me={me.email} onUndo={setUndo} />}
        {view === "actividad" && <ActivityCard />}
        {view === "menu" && GROUPS.map(([g, label]) => {
          const cards = groups.filter((x) => x.sec.group === g);
          if (term && !cards.length) return null;
          return (
            <div key={g} className={s.group}>
              <h2 className={s.groupTitle}>{label}</h2>
              {cards.map(({ sec, all, rows }) => {
                const expanded = !!term || !collapsed[sec.id];
                const hidden = all.filter((r) => !r.available).length;
                // Beers stay in tap order, and a filtered list has gaps, so neither can be dragged.
                const sortable = sec.kind !== "beers" && !term;
                return (
                  <section key={sec.id} className={s.card}>
                    <div className={s.cardHead}>
                      <button className={s.cardToggle} onClick={() => setCollapsed((c) => ({ ...c, [sec.id]: !c[sec.id] }))} aria-expanded={expanded}>
                        <span className={s.chevron} data-open={expanded} aria-hidden>
                          ›
                        </span>
                        <span className={s.cardTitle}>{sec.title}</span>
                        <span className={s.count}>
                          {term ? `${rows.length} de ${all.length}` : items(all.length)}
                          {hidden ? ` · ${hidden} oculto${hidden > 1 ? "s" : ""}` : ""}
                        </span>
                      </button>
                      <button className={s.add} aria-label={`Añadir a ${sec.title}`} onClick={() => add(sec)}>
                        <Icon name="plus" />
                        Añadir
                      </button>
                      {sec.cat?.id && (
                        <RowMenu
                          label={`Opciones de la lista ${sec.title}`}
                          actions={[
                            sec.group === "drinks"
                              ? ["Mover a Otros", "arrowRight", () => moveList(sec.cat as CategoryRow, "others")]
                              : ["Mover a Bebidas", "arrowRight", () => moveList(sec.cat as CategoryRow, "drinks")],
                            ...(sec.cat.builtin ? [] : [["Eliminar lista", "trash", () => deleteList(sec.cat as CategoryRow, all.length), true] as Action]),
                          ]}
                        />
                      )}
                    </div>
                    {expanded &&
                      (rows.length === 0 ? (
                        <p className={s.empty}>Nada aquí todavía.</p>
                      ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => reorder(sec, rows, e)}>
                          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                            <ul className={s.list}>
                              {rows.map((r) => (
                                <ItemRow
                                  key={r.id}
                                  sec={sec}
                                  r={r}
                                  sortable={sortable}
                                  onEdit={() => setSheet({ sec, row: r })}
                                  actions={[
                                    ["Editar", "pencil", () => setSheet({ sec, row: r })],
                                    ["Duplicar", "copy", () => duplicate(sec, r, all)],
                                    // Cervesoft's toggles: the line for the current status turns into "Marcar como disponible".
                                    ...STATUSES.map(([v, label, icon]): Action =>
                                      r.status === v ? ["Marcar como disponible", "check", () => setStatus(sec, r, "")] : [`Marcar como ${label}`, icon, () => setStatus(sec, r, v)],
                                    ),
                                    r.available ? ["Ocultar del menú", "eyeOff", () => toggle(sec, r, false)] : ["Mostrar en el menú", "eye", () => toggle(sec, r, true)],
                                    ["Eliminar", "trash", () => deleteRow(sec, r), true],
                                  ]}
                                />
                              ))}
                            </ul>
                          </SortableContext>
                        </DndContext>
                      ))}
                  </section>
                );
              })}
              {g !== "poke" && !term && data.categories && (
                <>
                  {!cards.length && <p className={s.muted}>Aquí van las listas que no son bebidas, como postres. Arma tu poke no las ofrece.</p>}
                  <button className={s.newList} onClick={() => addList(g)}>
                    <Icon name="plus" />
                    Nueva lista en {label}
                  </button>
                </>
              )}
            </div>
          );
        })}
        {view === "menu" && groups.length === 0 && <p className={s.muted}>Nada coincide con “{search}”.</p>}
      </main>

      {sheet && (
        <ItemSheet
          key={sheet.row.id ?? "new"}
          sheet={sheet}
          onClose={() => setSheet(null)}
          onSave={(row) => saveSheet(sheet.sec, row)}
          error={typeof save === "object" ? save.error : ""}
        />
      )}

      {undo && (
        <div className={s.undo} role="status">
          <span>{undo.label}</span>
          <button onClick={runUndo}>Deshacer</button>
        </div>
      )}
      {view === "menu" && (
        <button className={s.fab} aria-label="Añadir artículo" onClick={() => add(lastSection.current)}>
          <Icon name="plus" />
        </button>
      )}
    </div>
  );
}

/** One row, as in Cervesoft: drag handle, picture, name and details (tap to edit), ⋮ menu. */
function ItemRow({ sec, r, sortable, onEdit, actions }: { sec: Section; r: AnyRow; sortable: boolean; onEdit: () => void; actions: Action[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.id, disabled: !sortable });
  const sub = [sec.sub(r), statusLabel(r.status), r.available ? "" : "Oculto"].filter(Boolean).join(" · ");
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={s.row}
      data-hidden={!r.available}
      data-status={r.status || undefined}
    >
      {sortable && (
        <button className={s.handle} aria-label={`Arrastra para reordenar ${r.name}`} {...attributes} {...listeners}>
          <Icon name="grip" />
        </button>
      )}
      {sec.kind === "beers" ? (
        <span className={s.dot} style={{ background: srmColor((r as BeerRow).srm) }} />
      ) : sec.kind === "ingredients" || sec.kind === "bowls" ? (
        (r as IngredientRow).image_url ? <img className={s.thumb} src={(r as IngredientRow).image_url} alt="" /> : <span className={s.thumb} />
      ) : null}
      <button className={s.rowMain} onClick={onEdit}>
        <span className={s.rowName}>
          {!r.available && <Icon name="eyeOff" />}
          <span>{r.name}</span>
        </span>
        {sub && <span className={s.rowSub}>{sub}</span>}
      </button>
      <RowMenu label={`Opciones de ${r.name}`} actions={actions} />
    </li>
  );
}

/** A new item goes last in its section; beers get the next free tap. */
function blank(kind: Kind, rows: AnyRow[]): Partial<AnyRow> {
  const order = rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0;
  if (kind === "beers") {
    const tap = String(Math.max(0, ...rows.map((r) => Number((r as BeerRow).tap) || 0)) + 1).padStart(2, "0");
    return { name: "", available: true, order, tap, srm: 4 } as Partial<BeerRow>;
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
  hourglass: <><path d="M5 22h14M5 2h14" /><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" /><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" /></>,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  sparkles: <><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" /><path d="M20 3v4M22 5h-4" /></>,
  eyeOff: <><path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49" /><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" /><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14" /><path d="m2 2 20 20" /></>,
  eye: <><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" /><circle cx="12" cy="12" r="3" /></>,
  trash: <><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
  plus: <path d="M5 12h14M12 5v14" />,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  externalLink: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  logOut: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  more: <><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></>,
  grip: <><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></>,
};
export type IconName = keyof typeof ICONS;

export const Icon = ({ name }: { name: IconName }) => (
  <svg className={s.icon} viewBox="0 0 24 24" aria-hidden>
    {ICONS[name]}
  </svg>
);

/** Label, icon, what it does, and whether it's the red one at the bottom. */
export type Action = [string, IconName, () => unknown, danger?: boolean];

export function RowMenu({ label, actions }: { label: string; actions: Action[] }) {
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
      <button className={s.iconButton} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="more" />
      </button>
      {open && (
        <div className={s.kebabMenu} role="menu" aria-label={label}>
          {actions.map(([text, icon, run, danger]) => (
            <button
              key={text}
              role="menuitem"
              className={danger ? s.kebabDanger : undefined}
              onClick={() => {
                setOpen(false);
                run();
              }}
            >
              <Icon name={icon} />
              {text}
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
  error,
}: {
  sheet: NonNullable<Sheet>;
  onClose: () => void;
  onSave: (row: Partial<AnyRow>) => Promise<void>;
  error: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState((row as IngredientRow).image_url ?? "");
  // Set by any edit in the form, so closing without saving asks before throwing the edits away.
  const [dirty, setDirty] = useState(false);
  // One status at a time, as in Cervesoft: switching one on turns the others off.
  const [status, setStatus] = useState<Status>(row.status ?? "");
  useEffect(() => ref.current?.showModal(), []);
  const isNew = !row.id;

  const cancel = () => {
    if (!dirty || confirm("¿Descartar los cambios? Se quedará como estaba.")) ref.current?.close();
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const out: Record<string, unknown> = { ...sec.where, id: row.id, status, available: f.get("hidden") !== "on" };
    if (isNew) out.order = row.order;
    for (const fl of FIELDS[sec.kind]) {
      const v = f.get(fl.name);
      out[fl.name] = fl.type === "checkbox" ? v === "on" : fl.type === "number" || fl.type === "srm" ? Number(v) : String(v ?? "").trim();
    }
    setBusy(true);
    await onSave(out as Partial<AnyRow>);
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
          <div>
            <h2>{isNew ? "Añadir artículo" : "Editar artículo"}</h2>
            <p className={s.muted}>{sec.title} · Los cambios se ven al momento en el menú público.</p>
          </div>
          <button type="button" className={s.close} onClick={cancel} aria-label="Cerrar sin guardar">
            ×
          </button>
        </div>

        {FIELDS[sec.kind].map((fl) =>
          fl.type === "srm" ? (
            <SrmPicker key={fl.name} name={fl.name} label={fl.label} value={Number(value(fl.name)) || 4} />
          ) : fl.type === "checkbox" ? (
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
                    <option key={o} value={o}>
                      {o || "Sin envase"}
                    </option>
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

        {STATUSES.map(([v, , , hint]) => (
          <SwitchRow key={v} label={STATUS_LABELS[v][0]} hint={hint}>
            <input type="checkbox" checked={status === v} onChange={(e) => setStatus(e.target.checked ? v : "")} />
          </SwitchRow>
        ))}
        <SwitchRow label="Oculto" hint="Se conserva aquí pero se quita del menú público.">
          <input type="checkbox" name="hidden" defaultChecked={row.available === false} />
        </SwitchRow>

        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}

        <div className={s.sheetActions}>
          <button type="button" className={s.ghost} onClick={cancel} disabled={busy}>
            Cancelar
          </button>
          <button className={s.primary} disabled={busy}>
            {busy ? "Guardando…" : isNew ? "Añadir artículo" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** A beer's colour as a value on the SRM chart: 40 swatches, from pale straw to black. */
function SrmPicker({ name, label, value }: { name: string; label: string; value: number }) {
  const [srm, setSrm] = useState(value);
  return (
    <fieldset className={s.srm}>
      <legend>
        {label} · SRM {srm}
      </legend>
      <div className={s.srmGrid}>
        {SRM.map((hex, i) => (
          <label key={i} title={`SRM ${i + 1}`}>
            <input type="radio" name={name} value={i + 1} checked={srm === i + 1} onChange={() => setSrm(i + 1)} aria-label={`SRM ${i + 1}`} />
            <span style={{ background: hex, color: i < 12 ? "var(--navy)" : "#fff" }}>{i + 1}</span>
          </label>
        ))}
      </div>
      <small>Como en la tabla SRM: 1 es la más clara y 40 la más oscura.</small>
    </fieldset>
  );
}

/** Cervesoft's switch rows in the edit sheet: label, a line on what it does, switch on the right. */
function SwitchRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className={s.switchRow}>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <span className={s.switch}>
        {children}
        <span aria-hidden />
      </span>
    </label>
  );
}
