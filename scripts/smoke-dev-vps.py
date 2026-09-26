"""Prueba privada del entorno dev desde el VPS; no imprime credenciales."""

import json
import sys
import urllib.error
import urllib.request
from uuid import uuid4

BASE = "http://127.0.0.1:30080"
HOST = "dev.asesoriainmobiliariajb.com"
with open("/root/asesoria-inmobiliaria-dev-secrets.env", encoding="utf-8") as source:
    secrets = dict(line.rstrip("\n").split("=", 1) for line in source if "=" in line)


def request(path, *, method="GET", data=None, content_type=None, token=None):
    headers = {"Host": HOST}
    if content_type:
        headers["Content-Type"] = content_type
    if token:
        headers["Authorization"] = f"Bearer {token}"
    query = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(query, timeout=10) as response:
        return response.status, response.read()


status, ready = request("/api/health/ready")
assert status == 200 and json.loads(ready)["status"] == "ok"
status, catalog = request("/api/properties")
assert status == 200 and json.loads(catalog)
status, home = request("/")
assert status == 200 and b"<html" in home

credentials = json.dumps(
    {
        "email": secrets["ADMIN_INITIAL_EMAIL"],
        "password": secrets["ADMIN_INITIAL_PASSWORD"],
    }
).encode()
status, login = request(
    "/api/auth/login", method="POST", data=credentials, content_type="application/json"
)
token = json.loads(login)["accessToken"]
status, profile = request("/api/auth/me", token=token)
assert status == 200 and json.loads(profile)["role"] == "ADMIN"

if "--upload" in sys.argv:
    boundary = uuid4().hex
    payload = b"dev storage smoke test\n"
    body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="files"; filename="smoke.txt"\r\n'
        "Content-Type: text/plain\r\n\r\n"
    ).encode() + payload + f"\r\n--{boundary}--\r\n".encode()
    status, uploaded = request(
        "/api/admin/files",
        method="POST",
        data=body,
        content_type=f"multipart/form-data; boundary={boundary}",
        token=token,
    )
    item = json.loads(uploaded)[0]
    assert item["scanStatus"] == "CLEAN"
    status, content = request(f"/api/files/{item['id']}/content")
    assert status == 200 and content == payload
    eicar = rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    boundary = uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="files"; filename="eicar-{uuid4().hex}.com"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + eicar + f"\r\n--{boundary}--\r\n".encode()
    try:
        request(
            "/api/admin/files",
            method="POST",
            data=body,
            content_type=f"multipart/form-data; boundary={boundary}",
            token=token,
        )
        raise AssertionError("EICAR no fue bloqueado")
    except urllib.error.HTTPError as error:
        assert error.code == 400
    print("Dev API, web, login, MinIO y EICAR: OK")
else:
    print("Dev API, web y login: OK")
