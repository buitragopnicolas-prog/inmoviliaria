import { BadRequestException } from '@nestjs/common';

export type PaymentMode = 'manual' | 'gateway' | 'mock';
export type ManualMethodCode = 'QR' | 'BREB' | 'BANK_TRANSFER' | 'BANK_DEPOSIT';

export interface PublicManualPaymentMethod {
  code: ManualMethodCode;
  title: string;
  description: string;
  enabled: boolean;
  details: Array<{ label: string; value: string }>;
  qrImageUrl?: string;
  instructions?: string;
}

export function resolvePaymentMode(environment: NodeJS.ProcessEnv = process.env): PaymentMode {
  const configured = environment.PAYMENT_MODE?.trim().toLowerCase();
  if (configured) {
    if (configured === 'manual' || configured === 'gateway' || configured === 'mock') return configured;
    throw new BadRequestException('PAYMENT_MODE no es válido. Use manual, gateway o mock.');
  }
  const legacy = (environment.PAYMENT_PROVIDER ?? 'mock').trim().toLowerCase();
  return legacy === 'mock' ? 'mock' : 'gateway';
}

export function resolveGateway(environment: NodeJS.ProcessEnv = process.env): 'wompi' | 'cybervestigio' | 'none' {
  const configured = (environment.PAYMENT_GATEWAY ?? environment.PAYMENT_PROVIDER ?? 'none').trim().toLowerCase();
  if (configured === 'wompi' || configured === 'cybervestigio' || configured === 'none') return configured;
  throw new BadRequestException('PAYMENT_GATEWAY no es válido. Use none, wompi o cybervestigio.');
}

export function publicManualPaymentConfig(environment: NodeJS.ProcessEnv = process.env) {
  const bank = text(environment.MANUAL_PAYMENT_BANK_NAME);
  const holder = text(environment.MANUAL_PAYMENT_ACCOUNT_HOLDER);
  const accountType = text(environment.MANUAL_PAYMENT_ACCOUNT_TYPE);
  const accountDisplay = text(environment.MANUAL_PAYMENT_ACCOUNT_DISPLAY);
  const qrImageUrl = safePublicUrl(environment.MANUAL_PAYMENT_QR_IMAGE_URL);
  const brebKeyType = text(environment.MANUAL_PAYMENT_BREB_KEY_TYPE);
  const brebKeyDisplay = text(environment.MANUAL_PAYMENT_BREB_KEY_DISPLAY);
  const transferDetails = compactDetails([
    ['Entidad', bank], ['Titular', holder], ['Tipo de cuenta', accountType], ['Cuenta', accountDisplay],
  ]);
  const methods: PublicManualPaymentMethod[] = [
    {
      code: 'QR', title: 'Código QR', description: 'Realiza el pago desde la aplicación de tu entidad financiera.',
      enabled: Boolean(qrImageUrl && bank && holder), qrImageUrl,
      details: compactDetails([['Entidad', bank], ['Titular', holder]]),
      instructions: text(environment.MANUAL_PAYMENT_QR_INSTRUCTIONS),
    },
    {
      code: 'BREB', title: 'Bre-B / llave', description: 'Transfiere con la llave autorizada por la empresa.',
      enabled: Boolean(bank && holder && brebKeyType && brebKeyDisplay),
      details: compactDetails([['Entidad', bank], ['Titular', holder], ['Tipo de llave', brebKeyType], ['Llave', brebKeyDisplay]]),
      instructions: text(environment.MANUAL_PAYMENT_BREB_INSTRUCTIONS),
    },
    {
      code: 'BANK_TRANSFER', title: 'Transferencia bancaria', description: 'Transfiere desde tu banco a la cuenta autorizada.',
      enabled: Boolean(bank && holder && accountType && accountDisplay), details: transferDetails,
      instructions: text(environment.MANUAL_PAYMENT_TRANSFER_INSTRUCTIONS),
    },
    {
      code: 'BANK_DEPOSIT', title: 'Consignación', description: 'Realiza una consignación y conserva el comprobante.',
      enabled: Boolean(bank && holder && accountType && accountDisplay), details: transferDetails,
      instructions: text(environment.MANUAL_PAYMENT_DEPOSIT_INSTRUCTIONS),
    },
  ];
  return {
    mode: resolvePaymentMode(environment),
    methods,
    enabled: resolvePaymentMode(environment) === 'manual' && methods.some((method) => method.enabled),
    notice: 'El reporte no confirma el pago. Será validado por Asesoría Inmobiliaria JB.',
  };
}

function compactDetails(values: Array<[string, string | undefined]>) {
  return values.filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => ({ label, value }));
}

function text(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function safePublicUrl(value?: string): string | undefined {
  const normalized = text(value);
  if (!normalized) return undefined;
  if (normalized.startsWith('/')) return normalized;
  try {
    const url = new URL(normalized);
    return ['http:', 'https:'].includes(url.protocol) ? normalized : undefined;
  } catch {
    return undefined;
  }
}
