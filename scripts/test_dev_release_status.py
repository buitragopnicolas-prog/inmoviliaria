import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().with_name("dev-release-status.sh")


@unittest.skipUnless(os.name == "posix", "El diagnóstico se ejecuta en Linux")
class ReleaseStatusTest(unittest.TestCase):
    def inspect(self, job):
        with tempfile.TemporaryDirectory() as folder:
            for name, script in {
                "df": "printf 'cabecera\\nvol 100 90 10 90%% path\\n'",
                "kubectl": """[ "$1 $2 $3" = '-n asesoria-inmobiliaria-dev get' ] || exit 2
case "$4" in
 events) echo 'minio-app-policy-1-x FailedScheduling Node had disk-pressure private-detail'
         echo 'postgres-app-role-1-y Evicted low on resource: memory private-detail'
         echo 'web-z Failed pull image private-detail' ;;
 *) echo "$4" ;;
esac""",
            }.items():
                command = Path(folder) / name
                command.write_text("#!/bin/sh\n" + script + "\n")
                command.chmod(0o755)
            return subprocess.run(
                ["bash", str(SCRIPT), job], capture_output=True, text=True, timeout=5,
                env={"PATH": folder + os.pathsep + os.defpath}, check=False,
            )

    def test_only_public_status_and_recognized_causes_are_printed(self):
        result = self.inspect("minio-app-policy-1")
        self.assertEqual(result.returncode, 0)
        for detail in ("disco", "memoria", "descarga de imagen", "job/minio-app-policy-1", "pods"):
            self.assertIn(detail, result.stdout)
        self.assertNotIn("private-detail", result.stdout)

    def test_unrelated_job_is_rejected_before_kubectl(self):
        result = self.inspect("other/deployment")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
