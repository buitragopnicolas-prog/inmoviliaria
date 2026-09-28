export function isPublicRegistrationEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  const runtime = (environment.APP_ENV ?? (environment.NODE_ENV === 'production' ? '' : 'local')).trim().toLowerCase();
  return runtime === 'local' && (environment.PUBLIC_REGISTRATION_ENABLED ?? 'true').trim().toLowerCase() === 'true';
}
