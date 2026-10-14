import { pathToFileURL } from 'node:url';

export function sonarConfig(env = process.env) {
  for (const name of ['SONAR_HOST_URL', 'SONAR_PROJECT_KEY', 'SONAR_TOKEN']) {
    if (!env[name]?.trim()) throw new Error(`Falta ${name}; despliegue bloqueado.`);
  }
  const host = new URL(env.SONAR_HOST_URL);
  const localHttp = host.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(host.hostname);
  if ((host.protocol !== 'https:' && !localHttp) || host.username || host.password || host.search || host.hash) {
    throw new Error('SONAR_HOST_URL exige HTTPS, excepto en localhost, y no admite credenciales ni parámetros.');
  }
  if (!/^[a-zA-Z0-9_.:-]+$/.test(env.SONAR_PROJECT_KEY.trim())) throw new Error('SONAR_PROJECT_KEY inválida.');
  if (env.SONAR_ORGANIZATION && !/^[a-zA-Z0-9_.-]+$/.test(env.SONAR_ORGANIZATION)) throw new Error('SONAR_ORGANIZATION inválida.');
  if (['sonarcloud.io', 'sonarqube.us'].includes(host.hostname) && !env.SONAR_ORGANIZATION?.trim()) {
    throw new Error('SonarCloud exige SONAR_ORGANIZATION.');
  }
  return {
    host: host.href.replace(/\/$/, ''),
    project: env.SONAR_PROJECT_KEY.trim(),
    token: env.SONAR_TOKEN.trim(),
  };
}

// Query analysis history rather than the project's current gate: another commit
// may have been analyzed while this deployment was awaiting approval.
export async function verifySonarGate(sha, config, request = fetch) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Se exige un SHA completo.');
  async function get(path, params) {
    const url = new URL(`${config.host}/api/${path}`);
    url.search = new URLSearchParams(params).toString();
    const response = await request(url, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Sonar respondió HTTP ${response.status}; despliegue bloqueado.`);
    return response.json();
  }

  let analysis;
  // Bounded search; an absent or excessively old analysis fails closed.
  for (let page = 1; page <= 10; page++) {
    const result = await get('project_analyses/search', { project: config.project, p: page, ps: 100 });
    if (!Array.isArray(result.analyses)) throw new Error('Historial de Sonar inválido.');
    analysis = result.analyses.find((item) => item.revision === sha);
    if (analysis || result.analyses.length < 100) break;
  }
  if (!analysis?.key) throw new Error('No existe un análisis de Sonar para este SHA; despliegue bloqueado.');
  const gate = await get('qualitygates/project_status', { analysisId: analysis.key });
  if (gate.projectStatus?.status !== 'OK' || gate.projectStatus?.ignoredConditions !== false) {
    throw new Error('Sonar no aprobó todas las condiciones de este SHA; corrija los errores y repita las pruebas y el análisis.');
  }
  return analysis.key;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = sonarConfig();
    if (process.argv[2] === '--check-config') {
      console.log('Configuración de Sonar presente.');
    } else {
      await verifySonarGate(process.argv[2], config);
      console.log(`Sonar aprobó el commit ${process.argv[2]}.`);
    }
  } catch (error) {
    // Do not print response bodies, request URLs or tokens.
    console.error(`Validación Sonar fallida: ${error.message}`);
    process.exitCode = 1;
  }
}
