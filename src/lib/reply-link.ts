/**
 * External reply links are navigation shortcuts, not CRM sends.
 * Never use WhatsApp LIDs, opaque provider IDs or unvalidated addresses as recipients.
 */
export type ReplyCase = {
  id: string;
  channel?: string | null;
  originPhone?: string | null;
  originEmail?: string | null;
  subject?: string | null;
  externalIdentityId?: string | null;
};

export type ReplyIdentity = { externalUserId?: string | null };
export type ReplyAlias = { aliasType?: string | null; aliasValue?: string | null };

export type ReplyLink = {
  href: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'TELEGRAM' | 'INSTAGRAM' | 'PHONE';
  destination: string;
  newTab: boolean;
};

const validEmail = (raw: string | null | undefined): string | null => {
  const value = (raw ?? '').trim();
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}$/i.test(value) && value.length <= 254 ? value : null;
};

const internationalPhone = (raw: string | null | undefined): string | null => {
  const value = (raw ?? '').trim();
  if (!/^\+[0-9 ()-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null;
};

const whatsappPnJid = (raw: string | null | undefined): string | null => {
  const match = /^(\d{8,15})@s\.whatsapp\.net$/i.exec((raw ?? '').trim());
  return match && /^[1-9]/.test(match[1]) ? match[1] : null;
};

const telegramUsername = (raw: string | null | undefined): string | null => {
  const match = /^@?([A-Za-z][A-Za-z0-9_]{4,31})$/.exec((raw ?? '').trim());
  return match ? match[1] : null;
};

const instagramUsername = (raw: string | null | undefined): string | null => {
  const match = /^@?([A-Za-z0-9._]{1,30})$/.exec((raw ?? '').trim());
  if (!match || /^\d+$/.test(match[1]) || /^\./.test(match[1]) ||
    /\.$/.test(match[1]) || /\.\./.test(match[1])) return null;
  return match[1];
};

function whatsappNumber(record: ReplyCase, identity: ReplyIdentity | null, aliases: readonly ReplyAlias[]): string | null {
  // The case-level contact number is tied to this conversation, not the sending account.
  const phone = internationalPhone(record.originPhone);
  if (phone) return phone;
  const pns = new Set(aliases
    .filter(alias => alias.aliasType === 'WHATSAPP_PN')
    .map(alias => whatsappPnJid(alias.aliasValue))
    .filter((value): value is string => Boolean(value)));
  // Multiple PN aliases are ambiguous without a case-level phone number.
  if (pns.size > 1) return null;
  if (pns.size === 1) return [...pns][0];
  return whatsappPnJid(identity?.externalUserId);
}

export function replyLinkFor(
  record: ReplyCase,
  identity: ReplyIdentity | null = null,
  aliases: readonly ReplyAlias[] = [],
): ReplyLink | null {
  switch (record.channel) {
    case 'EMAIL': {
      const recipient = validEmail(record.originEmail) ?? validEmail(identity?.externalUserId);
      if (!recipient) return null;
      const subject = (record.subject ?? '').replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
      const title = subject ? (/^(?:re|aw|sv):/i.test(subject) ? subject : 'Re: ' + subject) : '';
      return {
        channel: 'EMAIL',
        href: 'mailto:' + recipient + (title ? '?subject=' + encodeURIComponent(title) : ''),
        destination: recipient,
        newTab: false,
      };
    }
    case 'WHATSAPP': {
      const phone = whatsappNumber(record, identity, aliases);
      return phone ? {
        channel: 'WHATSAPP', href: 'https://wa.me/' + phone,
        destination: '+' + phone, newTab: true,
      } : null;
    }
    case 'TELEGRAM': {
      const user = telegramUsername(identity?.externalUserId);
      return user ? {
        channel: 'TELEGRAM', href: 'https://t.me/' + user,
        destination: '@' + user, newTab: true,
      } : null;
    }
    case 'INSTAGRAM': {
      // Instagram numeric IDs are not usernames. ig.me DM links require a handle
      // and may only work in the mobile app.
      const user = instagramUsername(identity?.externalUserId);
      return user ? {
        channel: 'INSTAGRAM', href: 'https://ig.me/m/' + user,
        destination: '@' + user, newTab: true,
      } : null;
    }
    case 'PHONE': {
      const phone = internationalPhone(record.originPhone);
      return phone ? {
        channel: 'PHONE', href: 'tel:+' + phone,
        destination: '+' + phone, newTab: false,
      } : null;
    }
    default:
      return null;
  }
}

export function replyUnavailableReason(channel: string | null | undefined): string {
  switch (channel) {
    case 'WHATSAPP': return 'No hay un número internacional fiable para abrir WhatsApp. Revisa el teléfono o los alias PN de esta identidad.';
    case 'EMAIL': return 'No hay un email válido del interlocutor en la conversación.';
    case 'TELEGRAM': return 'Hace falta el nombre de usuario público de Telegram; un ID numérico no permite abrir el chat.';
    case 'INSTAGRAM': return 'Hace falta el nombre de usuario de Instagram; el identificador numérico del proveedor no sirve como enlace.';
    case 'PHONE': return 'No hay un teléfono internacional válido para iniciar una llamada.';
    default: return 'Este canal no tiene una forma de respuesta externa configurada.';
  }
}
