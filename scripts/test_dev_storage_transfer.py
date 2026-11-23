import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPTS = Path(__file__).resolve().parent


@unittest.skipUnless(os.name == "posix", "El despliegue usa Bash en Linux")
class DevTransferTest(unittest.TestCase):
    def receive(self, script, data=b"", **environment):
        with tempfile.TemporaryDirectory() as folder:
            return subprocess.run(
                ["bash", str(SCRIPTS / script)], cwd=folder, input=data,
                capture_output=True, timeout=5,
                env={"PATH": os.defpath, "RUNNER_TEMP": folder, **environment},
                check=False,
            )

    def test_deployment_with_no_transfer(self):
        for script in ("import-dev-storage-images.sh", "receive-dev-storage-transfer.sh"):
            with self.subTest(script=script):
                self.assertEqual(self.receive(script).returncode, 0)

    def test_unknown_or_truncated_stream_is_rejected_before_import(self):
        for stream in (b"other\n", b"JB-DEV-MINIO-1", b"JB-DEV-MINIO-1\nshort"):
            with self.subTest(stream=stream):
                result = self.receive("import-dev-storage-images.sh", stream)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn(b"kubectl", result.stderr)
                self.assertNotIn(b"ctr:", result.stderr)

    def test_foreign_download_host_is_rejected(self):
        transfer = '{"url":"https://example.invalid/a","passphrase":"private-test-value"}'
        result = self.receive("receive-dev-storage-transfer.sh", JB_DEV_MINIO_TRANSFER=transfer)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(b"private-test-value", result.stdout + result.stderr)
