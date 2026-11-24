"""Retire unused DEV application tags during one explicitly authorized release."""
import json
import re
import shutil
import subprocess
from pathlib import Path

NAMESPACE = "asesoria-inmobiliaria-dev"
TAG = re.compile(r"(?:docker\.io/library/)?asesoria-inmobiliaria-(api|web):dev-([0-9a-f]{40})")
STATE = Path("/var/lib/asesoria-inmobiliaria-dev")


def output(*args):
    return subprocess.check_output(args, text=True).strip()


def revisions(deployments, replicasets):
    active = {}
    protected = set()
    for deployment in deployments:
        app = deployment["metadata"]["name"]
        current = application_tag(deployment["spec"]["template"], app)
        history = sorted(
            (rs for rs in replicasets if any(owner["uid"] == deployment["metadata"]["uid"]
             for owner in rs["metadata"].get("ownerReferences", []))),
            key=lambda rs: int(rs["metadata"].get("annotations", {}).get("deployment.kubernetes.io/revision", 0)),
            reverse=True,
        )
        previous = None
        for rs in history:
            sha = application_tag(rs["spec"]["template"], app, required=False)
            if rs["spec"].get("replicas", 0) > 0:
                protected.add(sha)
            if sha != current and previous is None:
                previous = sha
        protected.update((current, previous))
        if previous:
            active[app] = current
    return active, protected


def application_tag(template, app, required=True):
    image = next(c["image"] for c in template["spec"]["containers"] if c["name"] == app)
    match = TAG.fullmatch(image)
    if not match or match[1] != app:
        if required:
            raise ValueError("Referencia de despliegue no reconocida en DEV")
        return None
    return match[2]


def retire(references, active, protected, remove):
    for ref in sorted(set(references)):
        match = TAG.fullmatch(ref)
        if not match or match[1] not in active or match[2] in protected:
            continue
        # Only older commits on the active application's own history qualify.
        code = subprocess.run(["git", "merge-base", "--is-ancestor", match[2], active[match[1]]],
                              stderr=subprocess.DEVNULL, check=False).returncode
        if code == 0:
            subprocess.run([*remove, ref], check=True)
            print("Referencia anterior de DEV retirada", ref, flush=True)


def main():
    nodes = json.loads(output("kubectl", "get", "nodes", "-o", "json"))["items"]
    if len(nodes) != 1:
        raise RuntimeError("La recuperación autorizada corresponde a un VPS de un solo nodo.")
    conditions = nodes[0]["status"]["conditions"]
    usage = shutil.disk_usage(STATE)
    disk_pressure = any(c["type"] == "DiskPressure" and c["status"] == "True" for c in conditions)
    if not disk_pressure and usage.free > usage.total * 0.15:
        print("DEV dispone de espacio. Se conservan todas las imágenes.")
        return
    kubectl = ["kubectl", "-n", NAMESPACE, "get"]
    deployments = json.loads(output(*kubectl, "deployment", "api", "web", "-o", "json"))["items"]
    replicasets = json.loads(output(*kubectl, "rs", "-o", "json"))["items"]
    active, protected = revisions(deployments, replicasets)
    protected.add((STATE / "verified-sha").read_text().strip())
    protected.add(output("git", "rev-parse", "HEAD"))
    live = output("kubectl", "get", "pods", "-A", "--field-selector=status.phase!=Failed,status.phase!=Succeeded",
                  "-o", "jsonpath={..image}").split()
    ctr = ["ctr", "-n", "k8s.io"]
    live += output(*ctr, "containers", "ls").split()
    live += output("docker", "ps", "-a", "--format", "{{.Image}}").split()
    protected.update(match[2] for name in live if (match := TAG.fullmatch(name)))
    retire(output(*ctr, "images", "ls", "-q").split(), active, protected, [*ctr, "images", "rm"])
    retire(output("docker", "image", "ls", "--format", "{{.Repository}}:{{.Tag}}").split(),
           active, protected, ["docker", "image", "rm", "--no-prune"])
    print("Espacio disponible tras revisar las referencias de DEV:", shutil.disk_usage(STATE).free, "bytes", flush=True)
    if disk_pressure:
        subprocess.run(["kubectl", "wait", "node/" + nodes[0]["metadata"]["name"],
                        "--for=condition=DiskPressure=False", "--timeout=360s"], check=True)


if __name__ == "__main__":
    main()
