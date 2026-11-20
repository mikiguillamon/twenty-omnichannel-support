import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { ConversationThread } from '../front-components/case-timeline.tsx';
import { openConversationRecord } from '../lib/conversation-inbox-navigation.ts';
import {
  conversationChannels, conversationFollowUps, conversationStatuses,
  conversationTagLabels, loadConversationDetails, updateConversationStatus,
  type ConversationCatalogItem, type ConversationChannel, type ConversationDetails, type ConversationRow, type ConversationStatus,
} from '../lib/conversation-inbox.ts';
import { stringTags } from '../lib/tag-values.ts';

const iconPaths = {
  search: 'M19 19l-4-4 M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
  refresh: 'M20 8a8 8 0 0 0-14-2L3 9m0-5v5h5m-4 7a8 8 0 0 0 14 2l3-3m-5 0h5v5',
  mail: 'M3 6h18v12H3z M3 7l9 7 9-7',
  chat: 'M20 15a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  call: 'M5 4h4l2 5-3 2a13 13 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z',
  close: 'm6 6 12 12M18 6 6 18',
  open: 'M13 5h6v6m0-6-9 9m7-1v6H5V7h6',
  left: 'm15 6-6 6 6 6',
  right: 'm9 6 6 6-6 6',
} as const;

export function InboxIcon({ name }: { name: keyof typeof iconPaths }) {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={iconPaths[name]} />
  </svg>;
}

export function InboxSelect({ label, value, options, onChange, allLabel, disabled }: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
  allLabel?: string;
  disabled?: boolean;
}) {
  return <label className="omni-inbox__field">
    <span>{label}</span>
    <select className="omni-inbox__select" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
      {allLabel && <option value="">{allLabel}</option>}
      {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </select>
  </label>;
}

export function InboxState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="omni-inbox__state" role="status"><strong>{title}</strong>{children}</div>;
}

function subjectOf(row: ConversationRow): string {
  return row.subject?.trim() || (row.channel === 'PHONE' ? 'Llamada telefónica' : 'Conversación sin asunto');
}

function originOf(row: ConversationRow): string | null {
  return (row.channel === 'EMAIL' ? row.originEmail || row.originPhone : row.originPhone || row.originEmail) ?? null;
}

function activityOf(row: ConversationRow): { dateTime: string; dateLabel: string } | null {
  const value = row.lastMessageAt ?? row.createdAt;
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const dateLabel = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  return { dateTime: date.toISOString(), dateLabel };
}

function ChannelLabel({ channel }: { channel?: ConversationChannel | null }) {
  if (!channel) return <span className="omni-inbox__muted">Sin canal</span>;
  const icon = channel === 'EMAIL' ? 'mail' : channel === 'PHONE' ? 'call' : 'chat';
  return <span className="omni-inbox__pill"><InboxIcon name={icon} />{conversationChannels[channel] ?? channel}</span>;
}

function StatusLabel({ status }: { status?: ConversationStatus | null }) {
  if (!status) return <span className="omni-inbox__muted">—</span>;
  const tone = status === 'HUMAN_REQUIRED' || status === 'WAITING_INTERNAL' ? 'warn'
    : status === 'RESOLVED' ? 'good' : status === 'IN_PROGRESS' ? 'accent' : undefined;
  return <span className="omni-inbox__pill" data-tone={tone}>{conversationStatuses[status] ?? status}</span>;
}

export function conversationCatalogLabel(item: ConversationCatalogItem): string {
  return item.name?.trim() || item.code?.trim() || 'Sin nombre';
}

function catalogName(items: ConversationCatalogItem[], id?: string | null): string | null {
  if (!id) return null;
  const item = items.find(row => row.id === id);
  return item ? conversationCatalogLabel(item) : null;
}

export type InboxCatalogs = {
  channels: ConversationCatalogItem[];
  categories: ConversationCatalogItem[];
  types: ConversationCatalogItem[];
};

function ConversationTags({ row, onFilter }: { row: ConversationRow; onFilter?: (field: 'tag' | 'customTag', tag: string) => void }) {
  const tags = [
    ...stringTags(row.tags).map(value => ({ field: 'tag' as const, value,
      label: Object.hasOwn(conversationTagLabels, value) ? conversationTagLabels[value] : value })),
    ...stringTags(row.customTags).map(value => ({ field: 'customTag' as const, value, label: value })),
  ];
  if (!tags.length) return null;
  return <div className="omni-inbox__tags" aria-label="Etiquetas de la conversación">
    {(onFilter ? tags.slice(0, 4) : tags).map(({ field, value, label }) => onFilter
      ? <button className="omni-inbox__pill omni-inbox__tag-action" key={field + value} type="button"
          onClick={() => onFilter(field, value)} aria-label={'Filtrar por ' + label}>{label}</button>
      : <span className="omni-inbox__pill" key={field + value}>{label}</span>)}
    {onFilter && tags.length > 4 && <span className="omni-inbox__note">+{tags.length - 4}</span>}
  </div>;
}

export function ConversationTable({ rows, catalogs, selectedId, loading, onSelect, onFilterTag }: {
  rows: ConversationRow[];
  catalogs: InboxCatalogs;
  selectedId: string | null;
  loading: boolean;
  onSelect: (row: ConversationRow, trigger: HTMLButtonElement) => void;
  onFilterTag: (field: 'tag' | 'customTag', tag: string) => void;
}) {
  return <div className="omni-inbox__table-scroll">
    <table className="omni-inbox__table" aria-label="Conversaciones" aria-busy={loading}>
      <thead><tr>
        <th scope="col" className="omni-inbox__primary-cell">Conversación</th>
        <th scope="col">Canal</th>
        <th scope="col">Estado</th>
        <th scope="col" className="omni-inbox__col-extra">Tipo y categoría</th>
        <th scope="col" className="omni-inbox__col-extra">Seguimiento</th>
        <th scope="col" className="omni-inbox__col-optional">Última actividad</th>
      </tr></thead>
      <tbody>
        {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} aria-hidden="true">
          <td><span className="omni-inbox__skeleton" /></td><td><span className="omni-inbox__skeleton" /></td>
          <td><span className="omni-inbox__skeleton" /></td><td className="omni-inbox__col-extra"><span className="omni-inbox__skeleton" /></td>
          <td className="omni-inbox__col-extra"><span className="omni-inbox__skeleton" /></td><td className="omni-inbox__col-optional"><span className="omni-inbox__skeleton" /></td>
        </tr>) : rows.map(row => {
          const origin = originOf(row);
          const accountName = catalogName(catalogs.channels, row.channelInstanceId);
          const activity = activityOf(row);
          const classification = [catalogName(catalogs.types, row.caseTypeId), catalogName(catalogs.categories, row.categoryId)].filter(Boolean).join(' · ');
          return <tr key={row.id} data-open={row.id === selectedId}>
            <td className="omni-inbox__primary-cell">
              <button className="omni-inbox__subject" type="button" aria-haspopup="dialog"
                onClick={event => onSelect(row, event.currentTarget)}>
                <strong>{subjectOf(row)}</strong>
              </button>
              {origin && <span className="omni-inbox__note" style={{ overflowWrap: 'anywhere' }}>{origin}</span>}
              <ConversationTags row={row} onFilter={onFilterTag} />
            </td>
            <td><ChannelLabel channel={row.channel} />{accountName && <div className="omni-inbox__note">{accountName}</div>}</td>
            <td><StatusLabel status={row.status} /></td>
            <td className="omni-inbox__col-extra">{classification || <span className="omni-inbox__muted">—</span>}</td>
            <td className="omni-inbox__col-extra">{row.followUp && row.followUp !== 'NONE' ? conversationFollowUps[row.followUp] : <span className="omni-inbox__muted">—</span>}</td>
            <td className="omni-inbox__col-optional">{activity ? <time className="omni-inbox__time" dateTime={activity.dateTime}>{activity.dateLabel}</time> : '—'}</td>
          </tr>;
        })}
      </tbody>
    </table>
    {loading && <span role="status" className="omni-inbox__visually-hidden">Cargando conversaciones</span>}
  </div>;
}

function secureRecording(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function ConversationPanel({ row, catalogs, onClose, onStatusChange }: {
  row: ConversationRow;
  catalogs: InboxCatalogs;
  onClose: () => void;
  onStatusChange: (status: ConversationStatus) => void;
}) {
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [contextError, setContextError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    let current = true;
    void loadConversationDetails(new RestApiClient(), row.id).then(data => {
      if (current) setDetails(data);
    }).catch(() => {
      if (current) setContextError(true);
    });
    return () => { current = false; };
  }, [row.id]);

  async function changeStatus(value: string) {
    if (saving || !Object.hasOwn(conversationStatuses, value) || value === row.status) return;
    const status = value as ConversationStatus;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateConversationStatus(new RestApiClient(), row.id, status);
      onStatusChange(status);
      setNotice('Estado actualizado.');
    } catch {
      setError('No se pudo cambiar el estado. Comprueba si puedes editar esta conversación.');
    } finally {
      setSaving(false);
    }
  }

  const recording = secureRecording(details?.recording?.primaryLinkUrl);
  const account = catalogName(catalogs.channels, row.channelInstanceId);
  const origin = originOf(row);
  const title = subjectOf(row);
  const classification = [catalogName(catalogs.types, row.caseTypeId), catalogName(catalogs.categories, row.categoryId)].filter(Boolean).join(' · ');

  async function openRecord() {
    setError('');
    try {
      await openConversationRecord(row.id);
    } catch {
      setError('No se pudo abrir la ficha de la conversación.');
    }
  }

  return <div className="omni-inbox__overlay" onClick={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="omni-inbox__detail" role="dialog" aria-labelledby={titleId} onKeyDown={event => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    }}>
      <header className="omni-inbox__detail-header">
        <div className="omni-inbox__thread-title">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeButton} className="omni-inbox__control" type="button" onClick={onClose}
            aria-label="Cerrar conversación" title="Cerrar conversación"><InboxIcon name="close" /></button>
        </div>
        <div className="omni-inbox__detail-meta">
          <div className="omni-inbox__thread-meta">
            <ChannelLabel channel={row.channel} />
            {account && <span className="omni-inbox__note">{account}</span>}
            {origin && <span className="omni-inbox__note">{origin}</span>}
          </div>
          {(classification || row.assignedTo) && <p className="omni-inbox__note">
            {[classification, row.assignedTo && `Responsable: ${row.assignedTo}`].filter(Boolean).join(' · ')}
          </p>}
          <ConversationTags row={row} />
          <div className="omni-inbox__controls">
            <InboxSelect label="Estado" value={row.status ?? ''} allLabel={row.status ? undefined : 'Seleccionar estado'}
              options={Object.entries(conversationStatuses)} onChange={value => void changeStatus(value)} disabled={saving} />
            <button type="button" className="omni-inbox__control" onClick={() => void openRecord()}><InboxIcon name="open" />Abrir ficha</button>
          </div>
          {error && <p role="alert" className="omni-inbox__alert">{error}</p>}
          {notice && <p role="status" className="omni-inbox__notice">{notice}</p>}
          {(details?.summary || details?.transcription || recording || contextError) && <div className="omni-inbox__context">
            {details?.summary && <details><summary>Resumen de la conversación</summary><p>{details.summary}</p></details>}
            {row.channel === 'PHONE' && details?.transcription && <details><summary>Transcripción</summary><p>{details.transcription}</p></details>}
            {row.channel === 'PHONE' && recording && <details><summary>Grabación</summary><audio aria-label="Grabación de la llamada" controls preload="none" src={recording} /></details>}
            {contextError && <p className="omni-inbox__note">Los detalles adicionales no están disponibles.</p>}
          </div>}
        </div>
      </header>
      <ConversationThread caseId={row.id} popup />
    </section>
  </div>;
}
