import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  portal?: 'TENANT' | 'OWNER' | 'SERVICES';
  sub: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUser =>
    context.switchToHttp().getRequest<{ user: JwtUser }>().user,
);
