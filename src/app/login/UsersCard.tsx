"use client";

import { useEffect, useState } from "react";
import { editorFetch } from "@/lib/api";
import { Icon, RowMenu, type Action, type Undo } from "./Editor";
import s from "./editor.module.css";

/*
 * /admin's "Usuarios" and "Actividad", for admins only. Usuarios: the people who can sign in
 * to the editor and what each one may change (admins change everything and manage users).
 * Actividad: who changed what in the last 30 days. The API refuses the same things this
 * screen hides, such as an admin removing themselves.
 */

export type UserRow = { id: number; email: string; name: string; role: "admin" | "editor"; active: boolean; menu: boolean; landing: boolean };
type Change = Partial<Omit<UserRow, "id">> & { password?: string };

/** "Admin", or "Editor · menú y página de inicio". */
const access = (u: UserRow) => (u.role === "admin" ? "Admin" : `Editor · ${[u.menu && "menú", u.landing && "página de inicio"].filter(Boolean).join(" y ")}`);

export function UsersCard({ me, onUndo }: { me: string; onUndo: (u: NonNullable<Undo>) => void }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The form open above the list: a new user, or the one being edited.
  const [form, setForm] = useState<"new" | UserRow | null>(null);

  /** Runs a call and shows its error; undefined means it failed (a DELETE answers null). */
  const run = async <T,>(call: Promise<T>): Promise<T | undefined> => {
    setError("");
    setNotice("");
    try {
      return await call;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  };

  useEffect(() => {
    run(editorFetch<UserRow[]>("editor/users/")).then((us) => us && setUsers(us));
  }, []);

  const patch = async (u: UserRow, change: Change) => {
    const saved = await run(editorFetch<UserRow>(`editor/users/${u.id}/`, { method: "PATCH", body: JSON.stringify(change) }));
    if (saved) setUsers((us) => us!.map((x) => (x.id === saved.id ? saved : x)));
    return saved;
  };

  /** Deshacer puts back the role, permissions, access and name the user had. */
  const restore = (u: UserRow) => () => patch(u, { role: u.role, menu: u.menu, landing: u.landing, active: u.active, name: u.name });

  const setActive = async (u: UserRow, active: boolean) => {
    if (!active && !confirm(`¿Desactivar a ${u.email}? No podrá entrar hasta que lo actives.`)) return;
    if (await patch(u, { active })) onUndo({ label: `${active ? "Activaste" : "Desactivaste"} a ${u.email}`, run: restore(u) });
  };

  const resetPassword = async (u: UserRow) => {
    const password = prompt(`Nueva contraseña para ${u.email}. Mínimo 8 caracteres; compártela con esa persona.`);
    if (password && (await patch(u, { password }))) setNotice(`Listo: ${u.email} ya entra con la nueva contraseña.`);
  };

  /** No Deshacer here: the password goes with the account. */
  const remove = async (u: UserRow) => {
    if (!confirm(`¿Eliminar a ${u.email}? Ya no podrá entrar al editor. No se puede deshacer.`)) return;
    if ((await run(editorFetch(`editor/users/${u.id}/`, { method: "DELETE" }))) !== undefined) setUsers((us) => us!.filter((x) => x.id !== u.id));
  };

  const save = async (change: Change) => {
    if (form === "new") {
      const saved = await run(editorFetch<UserRow>("editor/users/", { method: "POST", body: JSON.stringify(change) }));
      if (!saved) return;
      setUsers((us) => [...us!, saved]);
      setForm(null);
      setNotice(`Comparte con ${saved.email} su correo y la contraseña temporal; puede entrar en /login.`);
      onUndo({
        label: `Añadiste a ${saved.email}`,
        run: () => run(editorFetch(`editor/users/${saved.id}/`, { method: "DELETE" })).then((r) => r !== undefined && setUsers((us) => us!.filter((x) => x.id !== saved.id))),
      });
    } else if (form) {
      const old = form;
      const less = (old.role === "admin" && change.role === "editor") || (old.menu && !change.menu) || (old.landing && !change.landing);
      if (less && change.role !== "admin" && !confirm(`¿Quitarle permisos a ${old.email}? Quedará como ${access({ ...old, ...change } as UserRow)}.`)) return;
      if (!(await patch(old, change))) return;
      setForm(null);
      onUndo({ label: `Guardaste a ${old.email}`, run: restore(old) });
    }
  };

  const actions = (u: UserRow): Action[] =>
    u.email === me
      ? [
          ["Editar", "pencil", () => setForm(u)],
          ["Cambiar contraseña", "pencil", () => resetPassword(u)],
        ]
      : [
          ["Editar permisos", "pencil", () => setForm(u)],
          ["Cambiar contraseña", "pencil", () => resetPassword(u)],
          u.active ? ["Desactivar", "eyeOff", () => setActive(u, false)] : ["Activar", "eye", () => setActive(u, true)],
          ["Eliminar", "trash", () => remove(u), true],
        ];

  return (
    <>
      <p className={s.muted}>Los admins pueden cambiar todo, y además manejan los usuarios y ven la actividad. A cada editor le eliges qué puede cambiar.</p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={s.muted} role="status">
          {notice}
        </p>
      )}
      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardToggle}>
            <span className={s.cardTitle}>Usuarios</span>
          </span>
          {!form && (
            <button className={s.add} onClick={() => setForm("new")}>
              <Icon name="plus" />
              Añadir
            </button>
          )}
        </div>
        {form && <UserForm key={form === "new" ? "new" : form.id} user={form === "new" ? null : form} self={form !== "new" && form.email === me} onSave={save} onCancel={() => setForm(null)} />}
        {!users ? (
          <p className={s.empty}>Cargando…</p>
        ) : (
          <ul className={s.list}>
            {users.map((u) => (
              <li key={u.id} className={s.row} data-hidden={!u.active}>
                <button className={s.rowMain} onClick={() => setForm(u)}>
                  <span className={s.rowName}>
                    <span>{u.email}</span>
                  </span>
                  <span className={s.rowSub}>{[access(u), u.name, u.email === me && "Tú", !u.active && "Desactivado"].filter(Boolean).join(" · ")}</span>
                </button>
                <RowMenu label={`Opciones de ${u.email}`} actions={actions(u)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Add or edit a user: who they are, their role, and, for an editor, what they may change. */
function UserForm({ user, self, onSave, onCancel }: { user: UserRow | null; self: boolean; onSave: (c: Change) => Promise<void>; onCancel: () => void }) {
  const [role, setRole] = useState(user?.role ?? "editor");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const change: Change = { name: String(f.get("name")).trim(), role, menu: f.get("menu") === "on", landing: f.get("landing") === "on" };
    if (!user) Object.assign(change, { email: String(f.get("email")), password: String(f.get("password")) });
    // An admin changes everything; sending nothing keeps what they had as an editor.
    if (role === "admin") {
      delete change.menu;
      delete change.landing;
    }
    setBusy(true);
    await onSave(change);
    setBusy(false);
  };

  return (
    <form className={s.landingForm} onSubmit={submit} aria-label={user ? `Editar a ${user.email}` : "Nuevo usuario"}>
      <label className={s.field}>
        <span>Correo</span>
        <input name="email" type="email" required autoComplete="off" defaultValue={user?.email} disabled={!!user} />
      </label>
      <label className={s.field}>
        <span>Nombre</span>
        <input name="name" autoComplete="off" defaultValue={user?.name} />
        <small>Opcional.</small>
      </label>
      {!user && (
        <label className={s.field}>
          <span>Contraseña temporal</span>
          <input name="password" required minLength={8} autoComplete="new-password" />
          <small>Mínimo 8 caracteres. Compártela con esa persona; se la puedes cambiar después.</small>
        </label>
      )}
      <label className={s.field}>
        <span>Rol</span>
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as UserRow["role"])} disabled={self}>
          <option value="editor">Editor: solo lo que elijas abajo</option>
          <option value="admin">Admin: todo, además usuarios y actividad</option>
        </select>
        {self && <small>No puedes cambiar tu propio rol.</small>}
      </label>
      {role === "editor" && (
        <fieldset className={s.field}>
          <span>Puede cambiar</span>
          <label className={s.check}>
            <input type="checkbox" name="menu" defaultChecked={user?.menu ?? true} />
            <span>El menú: platillos, precios, cervezas, bebidas y su disponibilidad</span>
          </label>
          <label className={s.check}>
            <input type="checkbox" name="landing" defaultChecked={user?.landing ?? true} />
            <span>La página de inicio: textos, fotos, video, ubicación y redes</span>
          </label>
        </fieldset>
      )}
      <div className={s.sheetActions}>
        <button type="button" className={s.ghost} onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button className={s.primary} disabled={busy}>
          {busy ? "Guardando…" : user ? "Guardar" : "Añadir usuario"}
        </button>
      </div>
    </form>
  );
}

type Entry = { at: string; email: string; text: string };

/** Who changed what in /admin, newest first; the backend keeps 30 days. */
export function ActivityCard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    editorFetch<Entry[]>("editor/activity/").then(setEntries, (err) => setError(err instanceof Error ? err.message : "No se pudo cargar."));
  }, []);

  return (
    <>
      <p className={s.muted}>Quién cambió qué en los últimos 30 días. Lo más reciente va primero.</p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <section className={s.card}>
        {!entries ? (
          !error && <p className={s.empty}>Cargando…</p>
        ) : entries.length === 0 ? (
          <p className={s.empty}>Nadie ha cambiado nada en los últimos 30 días.</p>
        ) : (
          <ul className={s.list} aria-label="Actividad">
            {entries.map((a, i) => (
              <li key={i} className={s.row}>
                <span className={s.rowMain}>
                  <span className={s.rowName}>
                    <span>{a.text}</span>
                  </span>
                  <span className={s.rowSub}>
                    {a.email} · {new Date(a.at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
