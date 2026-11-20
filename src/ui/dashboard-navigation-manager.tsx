import { useEffect, useState } from 'react';
import { publishDashboardLink, unpublishDashboardLink } from '../lib/dashboard-navigation.ts';
import {
  createOmnichannelMenuAlias, listOmnichannelMenuEntries, renameOmnichannelMenuEntry,
  type OmnichannelMenuEntry,
} from '../lib/omnichannel-navigation.ts';

const entryType = {
  PAGE_LAYOUT: 'Página',
  LINK: 'Enlace',
  OBJECT: 'Tabla nativa',
  VIEW: 'Vista nativa',
} satisfies Record<OmnichannelMenuEntry['type'], string>;

type Edit = { id: string; mode: 'rename' | 'alias'; name: string };

const styles = `
.omni-menu-manager { display: grid; gap: 1rem; }
.omni-menu-manager__heading, .omni-menu-manager__entry, .omni-menu-manager__buttons {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem;
}
.omni-menu-manager__heading, .omni-menu-manager__entry { justify-content: space-between; }
.omni-menu-manager__heading h3 { margin: 0; font-size: 1rem; font-weight: 650; }
.omni-menu-manager__list { list-style: none; margin: 0; padding: 0; }
.omni-menu-manager__entry { border-bottom: 1px solid var(--omni-line); min-height: 3.75rem; padding: 0.625rem 0; }
.omni-menu-manager__item { flex: 1 1 13rem; min-width: 0; overflow-wrap: anywhere; }
.omni-menu-manager__item strong { font-size: 0.875rem; }
.omni-menu-manager__meta { margin: 0.25rem 0 0; color: var(--omni-muted); font-size: 0.8125rem; }
.omni-menu-manager__fields { display: grid; gap: 0.75rem; }
.omni-menu-manager__field { display: grid; gap: 0.25rem; min-width: 0; font-size: 0.8125rem; }
.omni-menu-manager__field input {
  border: 1px solid var(--omni-line); border-radius: 0.5rem; min-width: 0; min-height: 2.5rem;
  padding: 0.5rem 0.625rem; color: inherit; background: var(--omni-surface); font: inherit;
}
.omni-menu-manager__field input:focus-visible, .omni-menu-manager__create summary:focus-visible {
  outline: 2px solid var(--omni-focus); outline-offset: 2px;
}
.omni-menu-manager__editor { display: grid; gap: 0.5rem; width: 100%; padding: 0.25rem 0; }
.omni-menu-manager__create { border-top: 1px solid var(--omni-line); padding-top: 0.75rem; max-width: 32rem; }
.omni-menu-manager__create summary { cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.omni-menu-manager__create form { margin-top: 0.75rem; }
.omni-menu-manager__note { margin: 0; color: var(--omni-muted); font-size: 0.875rem; line-height: 1.5; }
.omni-menu-manager__error { margin: 0; color: var(--omni-danger); font-size: 0.875rem; line-height: 1.5; }
`;

function updateError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'INVALID_NAME') return 'Escribe un nombre de entre 1 y 80 caracteres.';
  if (code === 'MENU_ALIAS_ALREADY_EXISTS') return 'Ya hay un enlace al mismo destino en esta carpeta. Puedes renombrarlo en la lista.';
  return 'No se pudo actualizar el acceso. Comprueba tu permiso para editar los diseños del espacio y vuelve a intentarlo.';
}

export function DashboardNavigationManager() {
  const [items, setItems] = useState<OmnichannelMenuEntry[] | null>(null);
  const [publishName, setPublishName] = useState('');
  const [publishLink, setPublishLink] = useState('');
  const [edit, setEdit] = useState<Edit | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    try {
      setItems(await listOmnichannelMenuEntries());
    } catch {
      setError('No se pudo cargar la lista. Comprueba tus permisos en Twenty y pulsa Actualizar lista.');
    }
  }

  useEffect(() => { void load(); }, []);

  async function run(action: () => Promise<void>, failure: (error: unknown) => string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      setError(failure(cause));
    } finally {
      setBusy(false);
    }
  }

  function saveEdit() {
    if (!edit || !edit.name.trim()) return;
    void run(async () => {
      if (edit.mode === 'alias') {
        await createOmnichannelMenuAlias(edit.id, edit.name);
        setNotice('Acceso con nombre creado.');
      } else {
        await renameOmnichannelMenuEntry(edit.id, edit.name);
        setNotice('Nombre del acceso actualizado.');
      }
      setEdit(null);
      await load();
    }, updateError);
  }

  function publish() {
    void run(async () => {
      await publishDashboardLink({ name: publishName, link: publishLink });
      setPublishName('');
      setPublishLink('');
      setNotice('Acceso al dashboard publicado.');
      await load();
    }, cause => {
      if (cause instanceof Error && cause.message === 'ALREADY_PUBLISHED') return 'Este dashboard ya tiene un acceso compartido.';
      if (cause instanceof Error && cause.message.startsWith('INVALID_')) {
        return 'Indica un nombre válido y copia el enlace interno al dashboard.';
      }
      return updateError(cause);
    });
  }

  function remove(id: string) {
    void run(async () => {
      await unpublishDashboardLink(id);
      setConfirmId(null);
      setNotice('Acceso retirado del menú.');
      await load();
    }, updateError);
  }

  return <section className="omni-menu-manager" aria-label="Accesos del menú" aria-busy={busy}>
    <style>{styles}</style>
    <div className="omni-menu-manager__heading">
      <h3>Accesos compartidos</h3>
      <button type="button" className="omni-admin__button" disabled={busy} onClick={() => void run(load, updateError)}>
        Actualizar lista
      </button>
    </div>
    {error && <p className="omni-menu-manager__error" role="alert">{error}</p>}
    {notice && <p className="omni-menu-manager__note" role="status">{notice}</p>}
    {items === null && !error && <p className="omni-menu-manager__note" role="status">Cargando accesos…</p>}
    {items?.length === 0 && <p className="omni-menu-manager__note">Los accesos de Omnichannel que añadas al menú del espacio aparecerán aquí.</p>}
    {!!items?.length && <ul className="omni-menu-manager__list">
      {items.map(item => {
        const canRename = item.type === 'LINK' || item.type === 'PAGE_LAYOUT';
        return <li key={item.id} className="omni-menu-manager__entry">
          <div className="omni-menu-manager__item">
            <strong>{item.name}</strong>
            <p className="omni-menu-manager__meta">{entryType[item.type]}{item.targetName !== item.name ? ` · ${item.targetName}` : ''}</p>
          </div>
          {edit?.id === item.id ? <form className="omni-menu-manager__editor" onSubmit={event => {
            event.preventDefault();
            saveEdit();
          }}>
            <label className="omni-menu-manager__field">
              Nombre en el menú
              <input maxLength={80} value={edit.name} disabled={busy} required
                onChange={event => setEdit({ ...edit, name: event.target.value })} />
            </label>
            {edit.mode === 'alias' && <p className="omni-menu-manager__note">Se añade un enlace al mismo destino en el menú.</p>}
            <div className="omni-menu-manager__buttons">
              <button className="omni-admin__button omni-admin__button--primary" type="submit" disabled={busy || !edit.name.trim()}>
                {edit.mode === 'alias' ? 'Crear acceso' : 'Guardar nombre'}
              </button>
              <button className="omni-admin__button" type="button" disabled={busy} onClick={() => setEdit(null)}>Cancelar</button>
            </div>
          </form> : confirmId === item.id ? <div className="omni-menu-manager__buttons">
            <button className="omni-admin__button" type="button" disabled={busy} onClick={() => remove(item.id)}>Confirmar retirada</button>
            <button className="omni-admin__button" type="button" disabled={busy} onClick={() => setConfirmId(null)}>Cancelar</button>
          </div> : <div className="omni-menu-manager__buttons">
            <button className="omni-admin__button" type="button" disabled={busy} onClick={() => {
              setError('');
              setNotice('');
              setConfirmId(null);
              setEdit({ id: item.id, mode: canRename ? 'rename' : 'alias', name: canRename ? item.name : '' });
            }}>{canRename ? 'Renombrar' : 'Crear acceso con nombre'}</button>
            {item.canUnpublish && <button className="omni-admin__button" type="button" disabled={busy} onClick={() => {
              setEdit(null);
              setConfirmId(item.id);
            }}>Retirar</button>}
          </div>}
        </li>;
      })}
    </ul>}
    <details className="omni-menu-manager__create">
      <summary>Publicar acceso a un dashboard</summary>
      <form className="omni-menu-manager__fields" onSubmit={event => {
        event.preventDefault();
        publish();
      }}>
        <label className="omni-menu-manager__field">
          Nombre del acceso
          <input disabled={busy} maxLength={80} required value={publishName} onChange={event => setPublishName(event.target.value)} />
        </label>
        <label className="omni-menu-manager__field">
          Enlace interno del dashboard
          <input disabled={busy} placeholder="/page/…?omniDashboard=…" required value={publishLink} onChange={event => setPublishLink(event.target.value)} />
        </label>
        <div><button type="submit" className="omni-admin__button" disabled={busy || !publishName.trim() || !publishLink.trim()}>
          Publicar acceso
        </button></div>
      </form>
    </details>
  </section>;
}
