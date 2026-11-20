import { RestApiClientError, type RestApiClient } from 'twenty-client-sdk/rest';
import { readRestCollection } from './rest-collections.ts';
import { sortMessagesChronologically } from './sort-support-messages.ts';

export { PROPOSAL_BODY_LIMIT } from './proposal-constants.ts';
export type ProposalStatus = 'PENDING' | 'CONFIRMED' | 'DISCARDED';

export type ConversationMessage = {
  id: string;
  body?: string | null;
  draftBody?: string | null;
  occurredAt?: string | null;
  senderType?: string | null;
  direction?: string | null;
  deliveryStatus?: string | null;
  proposalStatus?: ProposalStatus | null;
  replyDecision?: string | null;
  callTranscription?: string | null;
  callRecording?: { primaryLinkUrl?: string | null } | null;
};

export async function loadConversationMessages(client: Pick<RestApiClient, 'get'>, caseId: string, cursor?: string) {
  const response = await client.get('/rest/supportMessages', {
    query: {
      filter: 'supportCaseId[eq]:' + JSON.stringify(caseId),
      order_by: 'occurredAt[DescNullsLast],id[DescNullsLast]',
      starting_after: cursor,
      limit: 60,
      depth: 0,
      fields: 'id,body,draftBody,occurredAt,senderType,direction,deliveryStatus,proposalStatus,replyDecision,callTranscription,callRecording',
    },
  });
  return readRestCollection<ConversationMessage>(response, 'supportMessages');
}

export function mergeConversationMessages(current: ConversationMessage[], older: ConversationMessage[]): ConversationMessage[] {
  const unique = new Map(older.map(message => [message.id, message]));
  for (const message of current) unique.set(message.id, message);
  return sortMessagesChronologically([...unique.values()]);
}

export async function decideConversationProposal(
  client: Pick<RestApiClient, 'post'>, messageId: string, confirmed: boolean, message: string,
): Promise<Exclude<ProposalStatus, 'PENDING'>> {
  const proposalStatus = confirmed ? 'CONFIRMED' : 'DISCARDED';
  const response = await client.post<{ ok: boolean; messageId: string; proposalStatus: string }>(
    '/s/omnichannel/v1/proposals/decide',
    { messageId, confirmed, ...(confirmed ? { message } : {}) },
  );
  if (response?.ok !== true || response.messageId !== messageId || response.proposalStatus !== proposalStatus) {
    throw new Error('PROPOSAL_RESPONSE_INVALID');
  }
  return proposalStatus;
}

export function proposalDecisionError(error: unknown): string {
  if (error instanceof RestApiClientError) {
    const body = error.body as { error?: { code?: string } } | undefined;
    switch (body?.error?.code) {
      case 'PROPOSAL_DECISION_IN_PROGRESS': return 'La decisión se está enviando. Actualiza el historial en unos segundos.';
      case 'N8N_WAIT_RETRYABLE': return 'Wait rechazó la solicitud. Comprueba que la ejecución está en espera y reintenta la misma decisión.';
      case 'N8N_WAIT_UNCERTAIN': return 'n8n no confirmó la recepción. Comprueba la ejecución antes de intentar enviarla de nuevo.';
      case 'PROPOSAL_ALREADY_DECIDED': return 'Esta propuesta ya tiene una decisión. Actualiza el historial.';
    }
    if (error.status === 401 || error.status === 403) return 'Tu usuario necesita permiso para editar este mensaje.';
    if (error.status === 409) return 'La propuesta tiene otra decisión en curso o pendiente de verificar. Actualiza el hilo y comprueba la ejecución en n8n.';
    if (error.status === 404) return 'No se encontró la propuesta o su ejecución de n8n. Actualiza el hilo y comprueba el nodo Wait.';
    if (error.status === 422) return 'Revisa el texto de la propuesta y la configuración de n8n.';
  }
  return 'No se pudo verificar la decisión. Comprueba la ejecución en n8n antes de reintentar.';
}
