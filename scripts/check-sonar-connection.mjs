import { sonarConfig, verifySonarGate } from './sonar-gate.mjs';

const config = sonarConfig();
const url = new URL(`${config.host}/api/project_analyses/search`);
url.searchParams.set('project', config.project);
url.searchParams.set('ps', '1');
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${config.token}` },
  redirect: 'error', signal: AbortSignal.timeout(15000),
});
if (!response.ok || !Array.isArray((await response.json()).analyses)) {
  throw new Error('GitHub no puede consultar el proyecto privado de Sonar.');
}
try {
  await verifySonarGate('0'.repeat(40), config);
  throw new Error('Un commit inexistente recibió aprobación.');
} catch (error) {
  if (!error.message.startsWith('No existe un análisis')) throw error;
}
console.log('Conexión autenticada con Sonar verificada; un commit sin análisis está bloqueado.');
