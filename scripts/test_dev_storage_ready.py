import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().with_name("dev-storage-ready.sh")


@unittest.skipUnless(os.name == "posix", "Requiere el shell del despliegue Linux")
class DevStorageTest(unittest.TestCase):
    def probe(self, replicas="1", ready="yes", endpoint="yes", args=()):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            kubectl = root / "kubectl"
            kubectl.write_text("""#!/bin/sh
[ "$1 $2" = '-n asesoria-inmobiliaria-dev' ] || exit 90
shift 2
echo "$*" >> "$CALLS"
case "$1 $2 $3" in
  'get deployment/minio -o') printf '%s' "$REPLICAS" ;;
  'scale deployment/minio --current-replicas=0') [ "$4" = '--replicas=1' ] ;;
  'rollout status deployment/minio') [ "$READY" = yes ] ;;
  'get endpoints/minio-service -o') if [ "$ENDPOINT" = yes ]; then echo '127.0.0.1'; fi ;;
  'get deploy/minio -o'|'get pods -l'|'get pvc/minio-pvc -o') ;;
  *) exit 91 ;;
esac
""")
            kubectl.chmod(0o755)
            sleeper = root / "sleep"
            sleeper.write_text("#!/bin/sh\nexit 0\n")
            sleeper.chmod(0o755)
            calls = root / "calls"
            result = subprocess.run(
                ["bash", str(SCRIPT), *args], capture_output=True, text=True, timeout=5,
                env={**os.environ, "PATH": tmp + os.pathsep + os.environ["PATH"],
                     "CALLS": str(calls), "REPLICAS": replicas, "READY": ready, "ENDPOINT": endpoint},
            )
            return result.returncode, calls.read_text().splitlines()

    def test_existing_storage_keeps_replica_count(self):
        code, calls = self.probe()
        self.assertEqual(code, 0)
        self.assertFalse(any(call.startswith("scale ") for call in calls))

    def test_suspended_dev_resumes_before_checking_the_endpoint(self):
        code, calls = self.probe(replicas="0")
        self.assertEqual(code, 0)
        self.assertEqual(calls[1], "scale deployment/minio --current-replicas=0 --replicas=1")
        self.assertTrue(calls[-1].startswith("get endpoints/minio-service "))

    def test_unready_pods_and_missing_endpoints_stop_initialization(self):
        for options in ({"ready": "no"}, {"endpoint": "no"}):
            with self.subTest(options=options):
                code, calls = self.probe(**options)
                self.assertNotEqual(code, 0)
                self.assertTrue(any(call.startswith("get pvc/minio-pvc ") for call in calls))

    def test_status_only_reads_namespaced_resources(self):
        code, calls = self.probe(replicas="0", args=("--status",))
        self.assertEqual(code, 0)
        self.assertTrue(all(call.startswith("get ") for call in calls))
