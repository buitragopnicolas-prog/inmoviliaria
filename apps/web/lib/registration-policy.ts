export function isLocalRegistrationEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.APP_ENV === 'local' && (environment.PUBLIC_REGISTRATION_ENABLED ?? 'true').trim().toLowerCase() === 'true';
}
