import hashlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("dev_application", Path(__file__).with_name("verify-dev-application.py"))
application = importlib.util.module_from_spec(spec)
spec.loader.exec_module(application)
SHA = "a" * 40
PAYLOAD = b"two application images"
DIGEST = hashlib.sha256(PAYLOAD).hexdigest()
RUN = {"head_repository": {"full_name": application.REPOSITORY}, "head_branch": "main",
       "head_sha": SHA, "path": ".github/workflows/pipeline.yml", "event": "push", "run_attempt": 2}
RECEIPT = {"name": f"jb-dev-images-{SHA}-2-{DIGEST}", "expired": False}


class DevApplicationTests(unittest.TestCase):
    def test_receipt_authorizes_exact_bytes_and_leaves_following_frame(self):
        stream = io.BytesIO(f"1234 2 {DIGEST} {len(PAYLOAD)}\n".encode() + PAYLOAD + b"JB-DEV-MINIO-1\n")
        with tempfile.TemporaryDirectory() as folder, patch.object(application, "github",
                side_effect=[RUN, {"artifacts": [RECEIPT]}]):
            destination = Path(folder, "images")
            application.receive(SHA, stream, destination)
            self.assertEqual(destination.read_bytes(), PAYLOAD)
            self.assertEqual(stream.read(), b"JB-DEV-MINIO-1\n")

    def test_only_the_reviewed_workflow_can_authorize_a_receipt(self):
        for change in ({"head_repository":{"full_name":"elsewhere/test"}}, {"head_branch":"test"},
                       {"path":"other.yml"}, {"event":"pull_request"}, {"head_sha":"b"*40}, {"run_attempt":1}):
            with self.subTest(change=change), patch.object(application, "github", return_value=RUN | change):
                with self.assertRaises(ValueError):
                    application.check_receipt(SHA, "1234", "2", DIGEST)
        for receipts in ([], [RECEIPT | {"expired":True}], [RECEIPT | {"name":"another"}]):
            with self.subTest(receipts=receipts), patch.object(application, "github",
                    side_effect=[RUN, {"artifacts":receipts}]), self.assertRaises(ValueError):
                application.check_receipt(SHA, "1234", "2", DIGEST)

    def test_manual_release_checks_the_workflow_revision_on_main(self):
        revision = "b"*40
        with patch.object(application, "github", side_effect=[
            RUN | {"event":"workflow_dispatch", "head_sha":revision}, {"artifacts":[RECEIPT]}
        ]), patch.object(application.subprocess, "run") as git:
            application.check_receipt(SHA, "1234", "2", DIGEST)
            self.assertEqual(git.call_args.args[0][-2:], [revision, "origin/main"])
            self.assertTrue(git.call_args.kwargs["check"])

    def test_truncation_tampering_oversize_and_invalid_header_fail(self):
        for header, data in ((b"bad\n", b""), (f"1 2 {DIGEST} 9999999999\n".encode(), b""),
                             (f"1 2 {DIGEST} 8\n".encode(), b"short"),
                             (f"1 2 {DIGEST} 7\n".encode(), b"altered")):
            with self.subTest(header=header), tempfile.TemporaryDirectory() as folder, \
                    patch.object(application, "check_receipt"):
                stream = io.BytesIO(header + data)
                destination = Path(folder, "images")
                with self.assertRaises(ValueError):
                    application.receive(SHA, stream, destination)
