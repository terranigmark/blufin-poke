"use client";

import { useEffect, useState } from "react";
import { editorFetch } from "@/lib/api";
import { Icon, RowMenu, type Action, type Undo } from "./Editor";
import s from "./editor.module.css";

/*
 * /admin's "Usuarios", for owners only: the people who can sign in to the editor. Owners
 * also manage users; editors only change the menu and the home page. The API refuses
 * the same things this screen hides, such as an owner removing themselves.
 */

export type UserRow = { id: number; email: string; name: string; role: "owner" | "editor"; active: boolean };

const ROLES = { owner: "Dueño", editor: "Editor" };

export function UsersCard({ me, onUndo }: { me: string; onUndo: (u: NonNullable<Undo>) => void }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);

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

  const patch = async (u: UserRow, change: Partial<UserRow> & { password?: string }) => {
    const saved = await run(editorFetch<UserRow>(`editor/users/${u.id}/`, { method: "PATCH", body: JSON.stringify(change) }));
    if (saved) setUsers((us) => us!.map((x) => (x.id === saved.id ? saved : x)));
    return saved;
  };

  /** A role or access change: asks first when it takes access away, and Deshacer puts back the old one. */
  const change = async (u: UserRow, next: Partial<UserRow>, label: string, ask?: string) => {
    if (ask && !confirm(ask)) return;
    if (await patch(u, next)) onUndo({ label, run: () => patch(u, { role: u.role, active: u.active }) });
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

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const saved = await run(editorFetch<UserRow>("editor/users/", { method: "POST", body: JSON.stringify(body) }));
    if (!saved) return;
    setUsers((us) => [...us!, saved]);
    setAdding(false);
    setNotice(`Comparte con ${saved.email} su correo y la contraseña temporal; puede entrar en /login.`);
    onUndo({
      label: `Añadiste a ${saved.email}`,
      run: () => run(editorFetch(`editor/users/${saved.id}/`, { method: "DELETE" })).then((r) => r !== undefined && setUsers((us) => us!.filter((x) => x.id !== saved.id))),
    });
  };

  const actions = (u: UserRow): Action[] =>
    u.email === me
      ? [["Cambiar contraseña", "pencil", () => resetPassword(u)]]
      : [
          u.role === "owner"
            ? ["Hacer editor", "arrowRight", () => change(u, { role: "editor" }, `${u.email} ahora es editor`, `¿Quitarle a ${u.email} el acceso de dueño? Ya no podrá manejar usuarios.`)]
            : ["Hacer dueño", "arrowRight", () => change(u, { role: "owner" }, `${u.email} ahora es dueño`, `¿Hacer dueño a ${u.email}? Podrá manejar usuarios y todo el sitio.`)],
          ["Cambiar contraseña", "pencil", () => resetPassword(u)],
          u.active
            ? ["Desactivar", "eyeOff", () => change(u, { active: false }, `Desactivaste a ${u.email}`, `¿Desactivar a ${u.email}? No podrá entrar hasta que lo actives.`)]
            : ["Activar", "eye", () => change(u, { active: true }, `Activaste a ${u.email}`)],
          ["Eliminar", "trash", () => remove(u), true],
        ];

  return (
    <>
      <p className={s.muted}>Los dueños manejan los usuarios y todo el sitio. Los editores cambian el menú y la página de inicio.</p>
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
          {!adding && (
            <button className={s.add} onClick={() => setAdding(true)}>
              <Icon name="plus" />
              Añadir
            </button>
          )}
        </div>
        {adding && (
          <form className={s.landingForm} onSubmit={add} aria-label="Nuevo usuario">
            <label className={s.field}>
              <span>Correo</span>
              <input name="email" type="email" required autoComplete="off" />
            </label>
            <label className={s.field}>
              <span>Nombre</span>
              <input name="name" autoComplete="off" />
              <small>Opcional.</small>
            </label>
            <label className={s.field}>
              <span>Contraseña temporal</span>
              <input name="password" required minLength={8} autoComplete="new-password" />
              <small>Mínimo 8 caracteres. Compártela con esa persona; tú se la puedes cambiar después.</small>
            </label>
            <label className={s.field}>
              <span>Rol</span>
              <select name="role" defaultValue="editor">
                <option value="editor">Editor: menú y página de inicio</option>
                <option value="owner">Dueño: además maneja usuarios</option>
              </select>
            </label>
            <div className={s.sheetActions}>
              <button type="button" className={s.ghost} onClick={() => setAdding(false)}>
                Cancelar
              </button>
              <button className={s.primary}>Añadir usuario</button>
            </div>
          </form>
        )}
        {!users ? (
          <p className={s.empty}>Cargando…</p>
        ) : (
          <ul className={s.list}>
            {users.map((u) => (
              <li key={u.id} className={s.row} data-hidden={!u.active}>
                <span className={s.rowMain}>
                  <span className={s.rowName}>
                    <span>{u.email}</span>
                  </span>
                  <span className={s.rowSub}>{[ROLES[u.role], u.name, u.email === me && "Tú", !u.active && "Desactivado"].filter(Boolean).join(" · ")}</span>
                </span>
                <RowMenu label={`Opciones de ${u.email}`} actions={actions(u)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
