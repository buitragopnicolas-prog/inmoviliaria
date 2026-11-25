import gzip
import hashlib
import json
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

    def test_verified_application_stream_registers_both_dev_images(self):
        sha = "a" * 40
        data = gzip.compress(b"paired image archive")
        digest = hashlib.sha256(data).hexdigest()
        record = {"head_repository":{"full_name":"buitragopnicolas-prog/inmoviliaria"},
                  "head_branch":"main", "path":".github/workflows/pipeline.yml", "event":"push",
                  "head_sha":sha, "run_attempt":1}
        receipt = {"artifacts":[{"name":f"jb-dev-images-{sha}-1-{digest}", "expired":False}]}
        packet = f"JB-DEV-APP-1\n123 1 {digest} {len(data)}\n".encode() + data
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/"curl").write_text('#!/bin/sh\ncase "$*" in *artifacts*) echo "$RECEIPT";; *) echo "$RUN";; esac\n')
            (root/"ctr").write_text('#!/bin/sh\ncase "$*" in *import*) cat > "$IMPORTED";; *ls*) '
                                    'printf "docker.io/library/asesoria-inmobiliaria-%s:dev-$SHA\\n" api web;; esac\n')
            for name in ("curl", "ctr"):
                (root/name).chmod(0o755)
            env = {**os.environ, "PATH":folder + os.pathsep + os.environ["PATH"], "RUN":json.dumps(record),
                   "RECEIPT":json.dumps(receipt), "IMPORTED":str(root/"import"), "SHA":sha}
            command = ["bash", str(SCRIPTS/"import-dev-storage-images.sh"), sha]
            for stream in (b"", packet[:-2], packet[:-2]+b"XX"):
                self.assertNotEqual(subprocess.run(command, input=stream, env=env, capture_output=True).returncode, 0)
                self.assertFalse((root/"import").exists())
            result = subprocess.run(command, input=packet, env=env, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((root/"import").read_bytes(), b"paired image archive")
