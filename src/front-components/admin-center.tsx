import { useState, type ReactNode } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme, useSelectedObjectMetadata } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { findStandalonePageLayoutId } from '../lib/admin-navigation.ts';
import { Dashboards } from '../ui/dashboard-page.tsx';
import { FaqManagerEntry } from '../ui/faq-manager-page.tsx';
import { ChannelSetup } from '../ui/channel-setup-page.tsx';
import { ChannelPolicies } from '../ui/channel-policies-page.tsx';
import { NavigationPreflight } from '../ui/navigation-preflight.tsx';
import { DashboardNavigationManager } from '../ui/dashboard-navigation-manager.tsx';

const sections = [
  ['dashboards', 'Dashboards'],
  ['faqs', 'FAQs'],
  ['channels', 'Canales'],
  ['policies', 'Políticas por canal'],
  ['shortcuts', 'Accesos'],
  ['catalogs', 'Datos y ajustes'],
] as const;

type Section = typeof sections[number][0];

const nativeObjects = [
  { label: 'Conversaciones', plural: 'supportCases', description: 'Casos, estado y seguimiento' },
  { label: 'Mensajes', plural: 'supportMessages', description: 'Historial de los canales' },
  { label: 'Canales', plural: 'supportChannels', description: 'Instancias, proveedor y estado' },
  { label: 'FAQs', plural: 'supportFaqs', description: 'Contenido, idiomas y alcances' },
  { label: 'Categorías', plural: 'supportCategories', description: 'Clasificación de consultas' },
  { label: 'Tipos de conversación', plural: 'supportTypes', description: 'Catálogo de tipos' },
  { label: 'Evaluaciones', plural: 'supportEvaluations', description: 'Revisión y calidad' },
  { label: 'Identidades externas', plural: 'supportExternalIdentities', description: 'Contactos en cada proveedor' },
  { label: 'Alias de identidad', plural: 'supportIdentityAliases', description: 'Identificadores PN y LID' },
  { label: 'Ajustes de soporte', plural: 'supportSettings', description: 'Configuración técnica' },
] as const;

const styles = `
.omni-admin {
  --omni-canvas: #f8fafc;
  --omni-surface: #fff;
  --omni-ink: #172033;
  --omni-muted: #526079;
  --omni-line: #dce3ed;
  --omni-accent: #413bb6;
  --omni-accent-hover: #332e96;
  --omni-selected: #eeedff;
  --omni-focus: #504bc7;
  --omni-danger: #9e283a;
  background: var(--omni-canvas);
  color: var(--omni-ink);
  color-scheme: light;
  box-sizing: border-box;
  min-height: 100%;
  min-width: 0;
  width: 100%;
  padding: clamp(1rem, 2.4vw, 2.75rem);
}
.omni-admin[data-theme='dark'] {
  --omni-canvas: #1d232c;
  --omni-surface: #252d38;
  --omni-ink: #f2f5fb;
  --omni-muted: #bcc8d9;
  --omni-line: #46536a;
  --omni-accent: #b8b5ff;
  --omni-accent-hover: #d0cdff;
  --omni-selected: #35335b;
  --omni-focus: #c3bfff;
  --omni-danger: #ffadb6;
  color-scheme: dark;
}
.omni-admin[data-compact='true'] { background: transparent; padding: 0; }
.omni-admin__heading, .omni-admin__shortcut-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: .75rem 1rem;
  margin-bottom: 1.25rem;
}
.omni-admin__heading h1 {
  margin: 0;
  font-size: 1.625rem;
  font-weight: 650;
  letter-spacing: -.025em;
  line-height: 1.2;
}
.omni-admin__tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .125rem .625rem;
  border-bottom: 1px solid var(--omni-line);
  margin-block-end: 1.375rem;
}
.omni-admin__tab, .omni-admin__record, .omni-admin__button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.omni-admin__tab {
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: .625rem .45rem .75rem;
  min-height: 2.75rem;
  color: var(--omni-muted);
}
.omni-admin__tab:hover { color: var(--omni-ink); }
.omni-admin__tab[aria-current='true'] {
  color: var(--omni-accent);
  border-bottom-color: currentColor;
  font-weight: 650;
}
.omni-admin__button {
  border: 1px solid var(--omni-line);
  border-radius: .5rem;
  background: var(--omni-surface);
  font-size: .875rem;
  font-weight: 600;
  min-height: 2.5rem;
  padding: .5rem .85rem;
}
.omni-admin__button:hover { background: var(--omni-selected); }
.omni-admin__button--primary { color: #fff; background: var(--omni-accent); border-color: transparent; }
.omni-admin__button--primary:hover { background: var(--omni-accent-hover); }
.omni-admin[data-theme='dark'] .omni-admin__button--primary { color: #1d193f; }
.omni-admin__button:disabled { opacity: .65; cursor: wait; }
.omni-admin__tab:focus-visible, .omni-admin__button:focus-visible, .omni-admin__record:focus-visible,
.omni-admin__details summary:focus-visible { outline: 2px solid var(--omni-focus); outline-offset: 2px; }
.omni-admin__content { min-width: 0; }
.omni-admin__error { color: var(--omni-danger); font-size: .875rem; margin: 0 0 .75rem; }
.omni-admin__notice { display: grid; gap: .75rem; justify-items: start; }
.omni-admin__notice p { margin: 0; color: var(--omni-muted); }
.omni-admin__launch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .875rem 1rem;
  padding-block: .875rem;
}
.omni-admin__launch h2, .omni-admin__content h2.omni-admin__subtitle { margin: 0; font-size: 1rem; font-weight: 650; }
.omni-admin__launch p { color: var(--omni-muted); font-size: .875rem; margin: .25rem 0 0; }
.omni-admin__records {
  list-style: none;
  padding: 0;
  margin: .625rem 0 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  column-gap: 1rem;
}
.omni-admin__record {
  display: grid;
  align-content: center;
  gap: .2rem;
  width: 100%;
  min-height: 3.75rem;
  border: 0;
  border-bottom: 1px solid var(--omni-line);
  padding: .625rem .5rem;
  text-align: start;
  background: transparent;
}
.omni-admin__record:hover { background: var(--omni-selected); }
.omni-admin__record span { color: var(--omni-muted); font-size: .8125rem; }
.omni-admin__details summary { cursor: pointer; font-weight: 600; padding-block: .5rem; }
`;

export function AdminFrame({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const theme = useColorScheme();
  return <div className="omni-admin" data-theme={theme} data-compact={compact}>
    <style>{styles}</style>
    {children}
  </div>;
}

function useStandaloneNavigation() {
  const [pending, setPending] = useState<string | null>(null);
  const [navigationError, setNavigationError] = useState('');

  async function openPage(universalIdentifier: string, label: string) {
    setPending(universalIdentifier);
    setNavigationError('');
    try {
      const pageLayoutId = await findStandalonePageLayoutId(universalIdentifier);
      if (!pageLayoutId) throw new Error('STANDALONE_PAGE_UNAVAILABLE');
      await navigate(AppPath.PageLayoutPage, { pageLayoutId }, undefined, { surface: 'main' });
    } catch {
      setNavigationError(`No se pudo abrir ${label}. Comprueba que Omnichannel esté actualizado e inténtalo de nuevo.`);
    } finally {
      setPending(null);
    }
  }

  return { openPage, pending, navigationError, setNavigationError };
}

export function AdminWorkspace() {
  const [section, setSection] = useState<Section>('dashboards');
  const { openPage, pending, navigationError, setNavigationError } = useStandaloneNavigation();

  async function openObject(objectNamePlural: string) {
    setNavigationError('');
    try {
      await navigate(AppPath.RecordIndexPage, { objectNamePlural });
    } catch {
      setNavigationError('No se pudo abrir la vista nativa. Comprueba tus permisos en Twenty.');
    }
  }

  return <AdminFrame>
    <header className="omni-admin__heading">
      <h1>Administración Omnichannel</h1>
      <button className="omni-admin__button" type="button" disabled={pending !== null}
        onClick={() => void openPage(IDS.LAYOUT_CONVERSATION_INBOX, 'Conversaciones')}>
        {pending === IDS.LAYOUT_CONVERSATION_INBOX ? 'Abriendo…' : 'Abrir conversaciones'}
      </button>
    </header>
    <nav className="omni-admin__tabs" aria-label="Secciones de administración">
      {sections.map(([key, label]) => <button key={key} className="omni-admin__tab" type="button"
        aria-current={section === key} onClick={() => { setSection(key); setNavigationError(''); }}>
        {label}
      </button>)}
    </nav>
    {navigationError && <p className="omni-admin__error" role="alert">{navigationError}</p>}
    <div className="omni-admin__content">
      {section === 'dashboards' && <Dashboards embedded enableLinks={false} enableMigration />}
      {section === 'faqs' && <FaqManagerEntry />}
      {section === 'channels' && <ChannelSetup />}
      {section === 'policies' && <ChannelPolicies />}
      {section === 'shortcuts' && <>
        <div className="omni-admin__shortcut-heading">
          <h2 className="omni-admin__subtitle">Accesos de dashboards</h2>
          <button className="omni-admin__button" type="button" disabled={pending !== null}
            onClick={() => void openPage(IDS.LAYOUT_SUPPORT_HOME, 'Dashboards')}>
            {pending === IDS.LAYOUT_SUPPORT_HOME ? 'Abriendo…' : 'Abrir dashboards'}
          </button>
        </div>
        <DashboardNavigationManager />
      </>}
      {section === 'catalogs' && <>
        <h2 className="omni-admin__subtitle">Tablas de Twenty</h2>
        <ul className="omni-admin__records">
          {nativeObjects.map(item => <li key={item.plural}>
            <button className="omni-admin__record" type="button" onClick={() => void openObject(item.plural)}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          </li>)}
        </ul>
        <details className="omni-admin__details">
          <summary>Migración de accesos antiguos</summary>
          <NavigationPreflight/>
        </details>
      </>}
    </div>
  </AdminFrame>;
}

export function OmnichannelAdminCenter() {
  const selectedObject = useSelectedObjectMetadata();
  const { openPage, pending, navigationError } = useStandaloneNavigation();

  if (selectedObject?.nameSingular === 'supportFaq') return <FaqManagerEntry />;

  return <AdminFrame compact>
    <section className="omni-admin__launch">
      <div>
        <h2>Espacio de administración</h2>
        <p>Gestiona canales, FAQs, dashboards y accesos de Omnichannel.</p>
      </div>
      <button className="omni-admin__button omni-admin__button--primary" type="button" disabled={pending !== null}
        onClick={() => void openPage(IDS.LAYOUT_ADMIN_FULL, 'Administración Omnichannel')}>
        {pending ? 'Abriendo…' : 'Abrir administración'}
      </button>
    </section>
    {navigationError && <p className="omni-admin__error" role="alert">{navigationError}</p>}
  </AdminFrame>;
}

export default defineFrontComponent({
  universalIdentifier: IDS.FRONT_ADMIN_CENTER,
  name: 'omnichannel-admin-center',
  description: 'Entrada a la administración de Omnichannel desde los ajustes de Twenty.',
  component: OmnichannelAdminCenter,
});
