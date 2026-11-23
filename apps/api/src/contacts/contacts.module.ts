import { SuggestionsController } from './suggestions.controller.js';
import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';

@Module({ controllers: [ContactsController, SuggestionsController], providers: [ContactsService] })
export class ContactsModule {}
