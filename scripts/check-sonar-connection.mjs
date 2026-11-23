import { sonarConfig, verifySonarGate } from './sonar-gate.mjs';

const config = sonarConfig();
async function read(path, query) {
  const url = new URL(config.host + '/api/' + path);
  url.search = new URLSearchParams(query).toString();
  const response = await fetch(url, {
    headers: {Authorization: 'Bearer ' + config.token},
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Sonar no pudo consultar el análisis. HTTP ' + response.status);
  return response.json();
}

const latest = await read('project_analyses/search', {project:config.project, ps:'1'});
if (!Array.isArray(latest.analyses)) throw new Error('GitHub no puede consultar el proyecto privado de Sonar.');
const analysis = latest.analyses[0];
if (analysis) {
  const {projectStatus} = await read('qualitygates/project_status', {analysisId:analysis.key});
  console.log('Análisis', analysis.revision, 'estado', projectStatus.status);
  for (const item of projectStatus.conditions) console.log(item.metricKey, item.status, item.actualValue, 'umbral', item.errorThreshold);
  if (projectStatus.status === 'ERROR') {
    const {issues} = await read('issues/search', {componentKeys:config.project, inNewCodePeriod:'true', issueStatuses:'OPEN,CONFIRMED', ps:'100'});
    for (const item of issues) console.log(item.rule, item.component, 'línea', item.line ?? 0);
    const {hotspots} = await read('hotspots/search', {projectKey:config.project, inNewCodePeriod:'true', status:'TO_REVIEW', ps:'100'});
    for (const item of hotspots) console.log('Revisión de seguridad', item.component, 'línea', item.line ?? 0);
  }
}

try {
  await verifySonarGate('0'.repeat(40), config);
  throw new Error('Un commit inexistente recibió aprobación.');
} catch (error) {
  if (!error.message.startsWith('No existe un análisis')) throw error;
}
console.log('Conexión autenticada con Sonar verificada; un commit sin análisis está bloqueado.');
