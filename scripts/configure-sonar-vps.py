#!/usr/bin/env python3
"""Initialize the private VPS project and least-privilege deployment tokens."""
import base64
import json
import os
import pathlib
import secrets
import time
import urllib.parse
import urllib.request
import urllib.error

ROOT = pathlib.Path('/opt/asesoria-inmobiliaria/sonar')
HOST = 'http://127.0.0.1:19002/sonar'
PUBLIC = 'https://dev.asesoriainmobiliariajb.com/sonar'
PROJECT = 'inmobiliaria-raiz-platform'
VAULT = ROOT / 'credentials.json'
os.umask(0o077)
state = json.loads(VAULT.read_text()) if VAULT.exists() else {}


def save():
    VAULT.write_text(json.dumps(state))
    VAULT.chmod(0o600)


def api(path, data=None, password=None):
    credential = password if password is not None else state.get('admin_password', 'admin')
    authorization = base64.b64encode(('admin:' + credential).encode()).decode()
    request = urllib.request.Request(HOST + '/api/' + path,
                                    data=urllib.parse.urlencode(data).encode() if data is not None else None,
                                    headers={'Authorization': 'Basic ' + authorization})
    with urllib.request.urlopen(request, timeout=20) as response:
        body = response.read()
        return json.loads(body) if body else {}


ready = False
for _ in range(120):
    try:
        if api('system/status').get('status') == 'UP':
            ready = True
            break
    except (urllib.error.URLError, TimeoutError):
        pass
    time.sleep(2)
if not ready:
    raise SystemExit('Sonar no está listo; consulte sus logs.')

if not state.get('admin_password') or not api('authentication/validate').get('valid'):
    if not api('authentication/validate', password='admin').get('valid'):
        raise SystemExit('Credenciales de administrador no válidas; no se modificó Sonar.')
    state['admin_password'] = 'Inmo-' + secrets.token_hex(24) + '!7'
    save()
    api('users/change_password', {'login': 'admin', 'previousPassword': 'admin', 'password': state['admin_password']}, password='admin')

api('settings/set', {'key': 'sonar.core.serverBaseURL', 'value': PUBLIC})
api('settings/set', {'key': 'sonar.forceAuthentication', 'value': 'true'})
projects = api('projects/search?' + urllib.parse.urlencode({'projects': PROJECT}))
if not any(item['key'] == PROJECT for item in projects.get('components', [])):
    api('projects/create', {'project': PROJECT, 'name': 'Asesoria Inmobiliaria JB', 'visibility': 'private', 'mainBranch': 'main'})

for login, permissions in [('inmo-github-ci', ['user', 'scan']), ('inmo-vps-verify', ['user'])]:
    users = api('users/search?' + urllib.parse.urlencode({'q': login})).get('users', [])
    if not any(user['login'] == login for user in users):
        api('users/create', {'login': login, 'name': login, 'local': 'true', 'password': 'Inmo-' + secrets.token_hex(24) + '!7'})
    for permission in permissions:
        api('permissions/add_user', {'login': login, 'projectKey': PROJECT, 'permission': permission})
    if not state.get(login):
        token = api('user_tokens/generate', {'login': login, 'name': 'inmobiliaria-deploy', 'type': 'USER_TOKEN'})
        state[login] = token['token']
        save()

for file, login in [(ROOT / 'github.env', 'inmo-github-ci'), (pathlib.Path('/etc/asesoria-inmobiliaria/sonar.env'), 'inmo-vps-verify')]:
    file.write_text('SONAR_HOST_URL=' + PUBLIC + '\nSONAR_PROJECT_KEY=' + PROJECT + '\nSONAR_TOKEN=' + state[login] + '\n')
    file.chmod(0o600)
print('Proyecto privado y tokens separados de análisis y consulta configurados. No se imprimieron secretos.')
