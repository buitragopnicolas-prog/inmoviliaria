"""Wait for Kubernetes to admit DEV workloads after importing a release."""
import json
import subprocess
import time


def node_blocks(node):
    conditions = {c["type"]: c["status"] for c in node["status"]["conditions"]}
    reasons = []
    if conditions.get("Ready") != "True":
        reasons.append("Ready=" + conditions.get("Ready", "Unknown"))
    for kind in ("DiskPressure", "MemoryPressure", "PIDPressure", "NetworkUnavailable"):
        if conditions.get(kind) in ("True", "Unknown"):
            reasons.append(kind + "=" + conditions[kind])
    if node["spec"].get("unschedulable"):
        reasons.append("programación deshabilitada (cordon)")
    for taint in node["spec"].get("taints", []):
        if taint["effect"] in ("NoExecute", "NoSchedule"):
            reasons.append(taint["key"] + " (" + taint["effect"] + ")")
    return reasons


def scheduling_status():
    result = subprocess.check_output(["kubectl", "get", "nodes", "--request-timeout=15s", "-o", "json"])
    states = [node_blocks(n) for n in json.loads(result)["items"]]
    if not states:
        return "sin nodos"
    if any(not state for state in states):
        return ""
    return " / ".join(", ".join(state) for state in states)


def wait_for_node():
    previous = None
    # Kubelet's pressure transition may outlast a short-lived initialization job.
    for _ in range(30):
        status = scheduling_status()
        if not status:
            print("DEV dispone de un nodo que admite las cargas.", flush=True)
            return
        if status != previous:
            print("Kubernetes bloquea la programación de DEV:", status, flush=True)
            previous = status
        time.sleep(15)
    raise RuntimeError("El nodo continúa restringido: " + previous)


if __name__ == "__main__":
    wait_for_node()
