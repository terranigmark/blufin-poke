"use client";

import { useEffect, useState } from "react";
import { editorFetch } from "@/lib/api";
import { Icon, RowMenu, useAdminT, type Action, type T, type Undo } from "./Editor";
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
const access = (u: UserRow, t: T) =>
  u.role === "admin"
    ? "Admin"
    : `Editor · ${t([u.menu && "menú", u.landing && "página de inicio"].filter(Boolean).join(" y "), [u.menu && "menu", u.landing && "home page"].filter(Boolean).join(" and "))}`;

export function UsersCard({ me, onUndo }: { me: string; onUndo: (u: NonNullable<Undo>) => void }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The form open above the list: a new user, or the one being edited.
  const [form, setForm] = useState<"new" | UserRow | null>(null);
  const t = useAdminT();

  /** Runs a call and shows its error; undefined means it failed (a DELETE answers null). */
  const run = async <T,>(call: Promise<T>): Promise<T | undefined> => {
    setError("");
    setNotice("");
    try {
      return await call;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo guardar.", "Couldn't save."));
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
    if (!active && !confirm(t(`¿Desactivar a ${u.email}? No podrá entrar hasta que lo actives.`, `Deactivate ${u.email}? They won't be able to sign in until you activate them.`))) return;
    if (await patch(u, { active })) onUndo({ label: active ? t(`Activaste a ${u.email}`, `You activated ${u.email}`) : t(`Desactivaste a ${u.email}`, `You deactivated ${u.email}`), run: restore(u) });
  };

  const resetPassword = async (u: UserRow) => {
    const password = prompt(t(`Nueva contraseña para ${u.email}. Mínimo 8 caracteres; compártela con esa persona.`, `New password for ${u.email}. At least 8 characters; share it with that person.`));
    if (password && (await patch(u, { password }))) setNotice(t(`Listo: ${u.email} ya entra con la nueva contraseña.`, `Done: ${u.email} now signs in with the new password.`));
  };

  /** No Deshacer here: the password goes with the account. */
  const remove = async (u: UserRow) => {
    if (!confirm(t(`¿Eliminar a ${u.email}? Ya no podrá entrar al editor. No se puede deshacer.`, `Delete ${u.email}? They won't be able to sign in to the editor. This can't be undone.`))) return;
    if ((await run(editorFetch(`editor/users/${u.id}/`, { method: "DELETE" }))) !== undefined) setUsers((us) => us!.filter((x) => x.id !== u.id));
  };

  const save = async (change: Change) => {
    if (form === "new") {
      const saved = await run(editorFetch<UserRow>("editor/users/", { method: "POST", body: JSON.stringify(change) }));
      if (!saved) return;
      setUsers((us) => [...us!, saved]);
      setForm(null);
      setNotice(t(`Comparte con ${saved.email} su correo y la contraseña temporal; puede entrar en /login.`, `Share the email and temporary password with ${saved.email}; they can sign in at /login.`));
      onUndo({
        label: t(`Añadiste a ${saved.email}`, `You added ${saved.email}`),
        run: () => run(editorFetch(`editor/users/${saved.id}/`, { method: "DELETE" })).then((r) => r !== undefined && setUsers((us) => us!.filter((x) => x.id !== saved.id))),
      });
    } else if (form) {
      const old = form;
      const less = (old.role === "admin" && change.role === "editor") || (old.menu && !change.menu) || (old.landing && !change.landing);
      if (less && change.role !== "admin" && !confirm(t(`¿Quitarle permisos a ${old.email}? Quedará como ${access({ ...old, ...change } as UserRow, t)}.`, `Take permissions away from ${old.email}? They'll be ${access({ ...old, ...change } as UserRow, t)}.`))) return;
      if (!(await patch(old, change))) return;
      setForm(null);
      onUndo({ label: t(`Guardaste a ${old.email}`, `You saved ${old.email}`), run: restore(old) });
    }
  };

  const actions = (u: UserRow): Action[] =>
    u.email === me
      ? [
          [t("Editar", "Edit"), "pencil", () => setForm(u)],
          [t("Cambiar contraseña", "Change password"), "pencil", () => resetPassword(u)],
        ]
      : [
          [t("Editar permisos", "Edit permissions"), "pencil", () => setForm(u)],
          [t("Cambiar contraseña", "Change password"), "pencil", () => resetPassword(u)],
          u.active ? [t("Desactivar", "Deactivate"), "eyeOff", () => setActive(u, false)] : [t("Activar", "Activate"), "eye", () => setActive(u, true)],
          [t("Eliminar", "Delete"), "trash", () => remove(u), true],
        ];

  return (
    <>
      <p className={s.muted}>
        {t(
          "Los admins pueden cambiar todo, y además manejan los usuarios y ven la actividad. A cada editor le eliges qué puede cambiar.",
          "Admins can change everything, and also manage users and see the activity. For each editor you choose what they can change.",
        )}
      </p>
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
            <span className={s.cardTitle}>{t("Usuarios", "Users")}</span>
          </span>
          {!form && (
            <button className={s.add} onClick={() => setForm("new")}>
              <Icon name="plus" />
              {t("Añadir", "Add")}
            </button>
          )}
        </div>
        {form && <UserForm key={form === "new" ? "new" : form.id} user={form === "new" ? null : form} self={form !== "new" && form.email === me} onSave={save} onCancel={() => setForm(null)} />}
        {!users ? (
          <p className={s.empty}>{t("Cargando…", "Loading…")}</p>
        ) : (
          <ul className={s.list}>
            {users.map((u) => (
              <li key={u.id} className={s.row} data-hidden={!u.active}>
                <button className={s.rowMain} onClick={() => setForm(u)}>
                  <span className={s.rowName}>
                    <span>{u.email}</span>
                  </span>
                  <span className={s.rowSub}>{[access(u, t), u.name, u.email === me && t("Tú", "You"), !u.active && t("Desactivado", "Deactivated")].filter(Boolean).join(" · ")}</span>
                </button>
                <RowMenu label={t(`Opciones de ${u.email}`, `Options for ${u.email}`)} actions={actions(u)} />
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
  const t = useAdminT();

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
    <form className={s.landingForm} onSubmit={submit} aria-label={user ? t(`Editar a ${user.email}`, `Edit ${user.email}`) : t("Nuevo usuario", "New user")}>
      <label className={s.field}>
        <span>{t("Correo")}</span>
        <input name="email" type="email" required autoComplete="off" defaultValue={user?.email} disabled={!!user} />
      </label>
      <label className={s.field}>
        <span>{t("Nombre")}</span>
        <input name="name" autoComplete="off" defaultValue={user?.name} />
        <small>{t("Opcional.", "Optional.")}</small>
      </label>
      {!user && (
        <label className={s.field}>
          <span>{t("Contraseña temporal", "Temporary password")}</span>
          <input name="password" required minLength={8} autoComplete="new-password" />
          <small>{t("Mínimo 8 caracteres. Compártela con esa persona; se la puedes cambiar después.", "At least 8 characters. Share it with that person; you can change it later.")}</small>
        </label>
      )}
      <label className={s.field}>
        <span>{t("Rol", "Role")}</span>
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as UserRow["role"])} disabled={self}>
          <option value="editor">{t("Editor: solo lo que elijas abajo", "Editor: only what you pick below")}</option>
          <option value="admin">{t("Admin: todo, además usuarios y actividad", "Admin: everything, plus users and activity")}</option>
        </select>
        {self && <small>{t("No puedes cambiar tu propio rol.", "You can't change your own role.")}</small>}
      </label>
      {role === "editor" && (
        <fieldset className={s.field}>
          <span>{t("Puede cambiar", "Can change")}</span>
          <label className={s.check}>
            <input type="checkbox" name="menu" defaultChecked={user?.menu ?? true} />
            <span>{t("El menú: platillos, precios, cervezas, bebidas y su disponibilidad", "The menu: dishes, prices, beers, drinks and their availability")}</span>
          </label>
          <label className={s.check}>
            <input type="checkbox" name="landing" defaultChecked={user?.landing ?? true} />
            <span>{t("La página de inicio: textos, fotos, video, ubicación y redes", "The home page: texts, photos, video, location and social networks")}</span>
          </label>
        </fieldset>
      )}
      <div className={s.sheetActions}>
        <button type="button" className={s.ghost} onClick={onCancel} disabled={busy}>
          {t("Cancelar", "Cancel")}
        </button>
        <button className={s.primary} disabled={busy}>
          {busy ? t("Guardando…", "Saving…") : user ? t("Guardar", "Save") : t("Añadir usuario", "Add user")}
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
  const t = useAdminT();
  useEffect(() => {
    editorFetch<Entry[]>("editor/activity/").then(setEntries, (err) => setError(err instanceof Error ? err.message : t("No se pudo cargar.", "Couldn't load.")));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <p className={s.muted}>{t("Quién cambió qué en los últimos 30 días. Lo más reciente va primero.", "Who changed what in the last 30 days. Newest first.")}</p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <section className={s.card}>
        {!entries ? (
          !error && <p className={s.empty}>{t("Cargando…", "Loading…")}</p>
        ) : entries.length === 0 ? (
          <p className={s.empty}>{t("Nadie ha cambiado nada en los últimos 30 días.", "Nobody has changed anything in the last 30 days.")}</p>
        ) : (
          <ul className={s.list} aria-label={t("Actividad", "Activity")}>
            {entries.map((a, i) => (
              <li key={i} className={s.row}>
                <span className={s.rowMain}>
                  <span className={s.rowName}>
                    <span>{a.text}</span>
                  </span>
                  <span className={s.rowSub}>
                    {a.email} · {new Date(a.at).toLocaleString(t("es-MX", "en-US"), { dateStyle: "medium", timeStyle: "short" })}
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
