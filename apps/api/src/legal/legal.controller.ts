import { BadRequestException, Body, Controller, Get, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsString, Length } from 'class-validator';
import { ConsentInput, recordConsent } from '../common/privacy.js';
import { CurrentUser, type JwtUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { consultColombianLaw } from './provider.js';

class Question extends ConsentInput {
  @IsString() @Length(12,1800) question!: string;
}

const subjects={
  arriendo:'¿Qué requisitos deben revisarse para reajustar el canon de una vivienda urbana en Colombia?',
  compra:'¿Qué documentos públicos conviene revisar antes de comprar una vivienda en Colombia?',
  copropiedad:'¿Dónde se consultan las reglas de convivencia de una propiedad horizontal en Colombia?',
};
class Topic { @IsIn(Object.keys(subjects)) topic!: keyof typeof subjects; }

@Controller('consulta-ia')
export class LegalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('estado')
  status() { return {available:Boolean(process.env.OPENAI_API_KEY?.trim()),topics:Object.entries(subjects).map(([id,label])=>({id,label}))}; }

  @Post('ejemplo')
  @UseGuards(JwtAuthGuard)
  @Throttle({default:{limit:6,ttl:60000}})
  example(@Body() body:Topic) {return this.answer(subjects[body.topic]);}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async ask(@CurrentUser() user:JwtUser,@Body() body:Question) {
    const question=body.question.trim();
    if (question.length<12) throw new BadRequestException('Escribe una pregunta de al menos 12 caracteres.');
    await this.prisma.$transaction(tx=>recordConsent(tx,body,'consulta_inmobiliaria_openai',user.sub));
    return this.answer(question);
  }

  private async answer(question:string) {
    const key=process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new ServiceUnavailableException('La conexión con OpenAI está pendiente.');
    try {
      return await consultColombianLaw(key,question);
    } catch {
      throw new ServiceUnavailableException('No se obtuvo una respuesta con fuentes oficiales. Puedes reintentar o abrir ChatGPT.');
    }
  }
}
