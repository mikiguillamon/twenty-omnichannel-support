import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedObjectMetadata, useUserId } from 'twenty-sdk/front-component';
import { IDS } from '../constants/ids.ts';
import { canManageApplications } from '../lib/admin-navigation.ts';
import { FaqManagerEntry } from '../ui/faq-manager-page.tsx';
import { AdminFrame, AdminWorkspace } from './admin-center.tsx';

function AdminFull() {
  const userId = useUserId();
  const selectedObject = useSelectedObjectMetadata();
  const [attempt, setAttempt] = useState(0);
  const [check, setCheck] = useState<{ userId: string; status: 'allowed' | 'denied' | 'failed' }>();
  const status = !userId ? 'denied' : check?.userId === userId ? check.status : 'loading';

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void canManageApplications()
      .then(allowed => {
        if (active) setCheck({ userId, status: allowed ? 'allowed' : 'denied' });
      })
      .catch(() => {
        if (active) setCheck({ userId, status: 'failed' });
      });
    return () => { active = false; };
  }, [userId, attempt]);

  if (status === 'allowed') {
    return selectedObject?.nameSingular === 'supportFaq' ? <FaqManagerEntry /> : <AdminWorkspace />;
  }

  return (
    <AdminFrame>
      <section className="omni-admin__notice">
        {status === 'loading' && <p role="status">Comprobando permisos de administración…</p>}
        {status === 'denied' && <p>Esta página requiere el permiso de Twenty «Aplicaciones del workspace».</p>}
        {status === 'failed' && <>
          <p role="alert">No se pudo comprobar el permiso de administración.</p>
          <button className="omni-admin__button" type="button" onClick={() => {
            setCheck(undefined);
            setAttempt(attempt + 1);
          }}>Reintentar</button>
        </>}
      </section>
    </AdminFrame>
  );
}

export default defineFrontComponent({
  universalIdentifier: IDS.FRONT_ADMIN_FULL,
  name: 'omnichannel-admin-full',
  description: 'Administración de Omnichannel a página completa.',
  component: AdminFull,
});
