"""Receive DEV application images after independently verifying the runner's receipt."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

REPOSITORY = "buitragopnicolas-prog/inmoviliaria"
RUNS = f"https://api.github.com/repos/{REPOSITORY}/actions/runs"
MAX_ARCHIVE = 2 * 1024**3
HEADER = re.compile(rb"([1-9][0-9]{0,17}) ([1-9][0-9]{0,6}) ([0-9a-f]{64}) ([1-9][0-9]{0,9})\n")


def github(url):
    result = subprocess.check_output([
        "curl", "--proto", "=https", "--fail", "--silent", "--show-error",
        "--max-time", "20", "--retry", "2", url,
    ])
    return json.loads(result)


def check_receipt(release, run, attempt, digest):
    url = f"{RUNS}/{run}"
    record = github(url)
    if (record["head_repository"]["full_name"] != REPOSITORY
            or record["head_branch"] != "main" or record["path"] != ".github/workflows/pipeline.yml"
            or record["event"] not in ("push", "workflow_dispatch")
            or record["run_attempt"] != int(attempt)):
        raise ValueError("La ejecución no corresponde al lanzamiento de DEV.")
    if record["event"] == "push" and record["head_sha"] != release:
        raise ValueError("El commit de GitHub no coincide con el del VPS.")
    if record["event"] == "workflow_dispatch":
        subprocess.run(["git", "-C", str(Path(__file__).resolve().parents[1]), "merge-base",
                        "--is-ancestor", record["head_sha"], "origin/main"], check=True)
    name = f"jb-dev-images-{release}-{attempt}-{digest}"
    artifacts = github(f"{url}/artifacts?name={name}")["artifacts"]
    if not any(item["name"] == name and not item["expired"] for item in artifacts):
        raise ValueError("GitHub no acredita este paquete para el SHA aprobado.")


def receive(release, stream, destination):
    header = HEADER.fullmatch(stream.readline(150))
    if not header or not re.fullmatch(r"[a-f0-9]{40}", release):
        raise ValueError("Cabecera de imágenes DEV inválida.")
    run, attempt, digest, size = (value.decode("ascii") for value in header.groups())
    remaining = int(size)
    if remaining > MAX_ARCHIVE:
        raise ValueError("El paquete excede el tamaño admitido.")
    check_receipt(release, run, attempt, digest)
    checksum = hashlib.sha256()
    with destination.open("wb") as archive:
        while remaining:
            block = stream.read(min(1024 * 1024, remaining))
            if not block:
                raise ValueError("El paquete de imágenes está incompleto.")
            archive.write(block)
            checksum.update(block)
            remaining -= len(block)
    if checksum.hexdigest() != digest:
        raise ValueError("La huella de las imágenes no coincide con GitHub.")


if __name__ == "__main__":
    # Unbuffered reads leave the optional following MinIO frame on the pipe.
    receive(sys.argv[1], sys.stdin.buffer.raw, Path(sys.argv[2]))
