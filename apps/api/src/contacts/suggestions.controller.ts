import { ConsentInput, recordConsent } from '../common/privacy.js';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

class SuggestionInput extends ConsentInput {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(10,4000) message!: string;
}

@Controller()
export class SuggestionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('suggestions')
  @Throttle({ default: { limit: Number(process.env.RATE_LIMIT_CONTACT ?? 5), ttl: 60*60_000 } })
  create(@Body() input: SuggestionInput) {
    return this.prisma.$transaction(async tx=>{
      const row=await tx.suggestion.create({data:{message:input.message},select:{id:true}});
      await recordConsent(tx,input,'suggestion',row.id);
      return row;
    });
  }

  @Get('admin/suggestions')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  list() {
    return this.prisma.suggestion.findMany({orderBy:[{createdAt:'desc'},{id:'asc'}]});
  }
}
