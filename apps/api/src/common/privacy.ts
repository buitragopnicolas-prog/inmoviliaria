import { BadRequestException, ConflictException } from '@nestjs/common';
import { Equals, IsString, Matches } from 'class-validator';
import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';

export class ConsentInput {
  @Equals(true, { message: 'Autoriza el tratamiento de datos para continuar.' })
  authorized!: boolean;
  @IsString() @Matches(/^[a-f0-9]{64}$/, {message:'Revisa la política publicada antes de continuar.'})
  policyVersion!: string;
}

export async function recordConsent(tx: Prisma.TransactionClient, consent: ConsentInput, purpose: string, subjectId: string) {
  const section = await tx.siteSection.findUnique({where:{id:'contacto'}});
  const values = section?.values as Record<string,string> | undefined;
  const policyText = values?.policyText?.trim() || '';
  const policyHref = values?.policyHref?.trim() || (policyText ? '/politica-de-datos' : '');
  if (!policyHref || consent.authorized !== true) throw new BadRequestException('Se requiere autorización y una política publicada.');
  const version = createHash('sha256').update(JSON.stringify([policyHref,policyText])).digest('hex');
  if (version !== consent.policyVersion) throw new ConflictException('La política ha cambiado. Recarga la página y lee la versión vigente.');
  await tx.privacyConsent.create({data:{subjectId,purpose,version,policyHref,policyText}});
}
