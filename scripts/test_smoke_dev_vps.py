"""Pruebas sin red para los controles de pagos ejecutados antes de promover dev."""

import builtins
import copy
import io
import json
import pathlib
import runpy
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit


class Response(io.BytesIO):
    status = 200


class ManualPaymentSmokeTests(unittest.TestCase):
    def setUp(self):
        self.qr = b"\xff\xd8\xffauthorized-qr"
        self.served_qr = self.qr
        self.config = {
            "mode": "manual",
            "enabled": True,
            "methods": [
                {"code": code, "enabled": True, **({"qrImageUrl": "/payments/bancolombia-breb.jpeg"} if code == "QR" else {})}
                for code in ("QR", "BREB", "BANK_TRANSFER", "BANK_DEPOSIT")
            ],
        }
        self.paths = []
        self.payment_error = False
        self.failures = {}
        self.delays = []
        for method in self.config["methods"]:
            method["details"] = [{"label": "Entidad", "value": "Banco autorizado"}, {"label": "Titular", "value": "Titular autorizado"}]
            if method["code"] == "BREB":
                method["details"] += [{"label": "Tipo de llave", "value": "Alfanumérica"}, {"label": "Llave", "value": "@test"}]
            elif method["code"] in ("BANK_TRANSFER", "BANK_DEPOSIT"):
                method["details"] += [{"label": "Tipo de cuenta", "value": "Ahorros"}, {"label": "Cuenta", "value": "123456"}]

    def run_smoke(self):
        actual_open = builtins.open

        def open_file(path, *args, **kwargs):
            if str(path) == "/root/asesoria-inmobiliaria-dev-secrets.env":
                return io.StringIO("ADMIN_INITIAL_EMAIL=admin@example.test\nADMIN_INITIAL_PASSWORD=test-password\n")
            if str(path) == "/opt/asesoria-inmobiliaria/payments/bancolombia-breb.jpeg":
                return io.BytesIO(self.qr)
            return actual_open(path, *args, **kwargs)

        def urlopen(query, **kwargs):
            url = query if isinstance(query, str) else query.full_url
            path = urlsplit(url).path
            self.paths.append(path)
            failures = self.failures.get(path, [])
            if failures:
                raise failures.pop(0)
            responses = {
                "/api/health/ready": {"status": "ok"},
                "/api/properties": [{"id": "test-property"}],
                "/api/auth/login": {"accessToken": "test-token"},
                "/api/auth/me": {"role": "ADMIN"},
                "/api/payments/manual/config": self.config,
            }
            if path == "/api/payments/manual/config":
                self.assertEqual(query.get_header("Authorization"), "Bearer test-token")
                if self.payment_error:
                    raise HTTPError(url, 503, "Unavailable", {}, None)
            if path == "/":
                return Response(b"<html>dev</html>")
            if path.startswith("/payments/"):
                self.assertEqual(urlsplit(url).scheme, "https")
                return Response(self.served_qr)
            return Response(json.dumps(responses[path]).encode())

        with patch("builtins.open", open_file), patch("urllib.request.urlopen", urlopen), \
             patch("sys.argv", ["smoke-dev-vps.py"]), patch("sys.stdout", io.StringIO()), \
             patch("time.sleep", self.delays.append):
            runpy.run_path(str(pathlib.Path(__file__).with_name("smoke-dev-vps.py")), run_name="__main__")

    def test_accepts_complete_manual_methods_and_original_qr(self):
        self.run_smoke()
        self.assertIn("/api/payments/manual/config", self.paths)
        self.assertIn("/payments/bancolombia-breb.jpeg", self.paths)

    def test_rejects_non_manual_or_disabled_configuration(self):
        original = copy.deepcopy(self.config)
        for change in ({"mode": "mock"}, {"enabled": False}):
            with self.subTest(change=change):
                self.config = {**original, **change}
                with self.assertRaises(AssertionError):
                    self.run_smoke()

    def test_rejects_each_disabled_payment_method(self):
        for method in self.config["methods"]:
            with self.subTest(method=method["code"]):
                method["enabled"] = False
                with self.assertRaises(AssertionError):
                    self.run_smoke()
                method["enabled"] = True

    def test_rejects_unexpected_qr_location(self):
        self.config["methods"][0]["qrImageUrl"] = "https://untrusted.example/qr.jpeg"
        with self.assertRaises(AssertionError):
            self.run_smoke()

    def test_rejects_non_image_response_and_changed_qr(self):
        for body in (b"<html>Unavailable</html>", b"\xff\xd8\xffdifferent-qr"):
            with self.subTest(body=body):
                self.served_qr = body
                with self.assertRaises(AssertionError):
                    self.run_smoke()

    def test_rejects_unavailable_payment_configuration(self):
        self.payment_error = True
        with self.assertRaises(HTTPError):
            self.run_smoke()

    def test_rejects_incomplete_or_inconsistent_banking_details(self):
        original = copy.deepcopy(self.config)
        invalid_details = (
            [],
            [{"label": "Entidad", "value": ""}],
            [{"label": "", "value": "Banco"}],
            [{"label": "Entidad", "value": "Banco"}, {"label": "Entidad", "value": "Otro"}],
            [{"label": "Entidad", "value": "Otro banco"}, {"label": "Titular", "value": "Otro titular"}],
        )
        for fields in invalid_details:
            with self.subTest(fields=fields):
                self.config = copy.deepcopy(original)
                self.config["methods"][1]["details"] = fields
                with self.assertRaises(AssertionError):
                    self.run_smoke()

    def test_rejects_transfer_without_account_number(self):
        self.config["methods"][2]["details"].pop()
        with self.assertRaises(AssertionError):
            self.run_smoke()

    def test_rejects_deposit_with_a_different_account(self):
        self.config["methods"][3]["details"][-1]["value"] = "999999"
        with self.assertRaises(AssertionError):
            self.run_smoke()

    def test_recovers_from_transient_gateway_errors_on_reads(self):
        for status in (502, 503, 504):
            with self.subTest(status=status):
                self.paths = []
                self.delays = []
                self.failures = {"/": [HTTPError("http://localhost/", status, "Gateway", {}, None)] * 2}
                self.run_smoke()
                self.assertEqual(self.paths.count("/"), 3)
                self.assertEqual(self.delays, [2, 2])

    def test_recovers_from_transient_connection_errors_on_reads(self):
        for error in (URLError("Connection reset"), TimeoutError("Timeout")):
            with self.subTest(error=type(error).__name__):
                self.paths = []
                self.failures = {"/": [error]}
                self.run_smoke()
                self.assertEqual(self.paths.count("/"), 2)

    def test_persistent_gateway_errors_still_block_verification(self):
        self.failures = {"/": [HTTPError("http://localhost/", 502, "Gateway", {}, None)] * 20}
        with self.assertRaises(HTTPError):
            self.run_smoke()
        self.assertEqual(self.paths.count("/"), 10)
        self.assertEqual(self.delays, [2] * 9)

    def test_persistent_connection_errors_still_block_verification(self):
        self.failures = {"/": [URLError("Connection reset")] * 20}
        with self.assertRaises(URLError):
            self.run_smoke()
        self.assertEqual(self.paths.count("/"), 10)

    def test_does_not_retry_application_or_authorization_errors(self):
        for status in (401, 403, 404, 500):
            with self.subTest(status=status):
                self.paths = []
                self.failures = {"/": [HTTPError("http://localhost/", status, "Rejected", {}, None)] * 20}
                with self.assertRaises(HTTPError):
                    self.run_smoke()
                self.assertEqual(self.paths.count("/"), 1)
        self.assertEqual(self.delays, [])

    def test_never_retries_writes_even_on_gateway_failure(self):
        self.failures = {"/api/auth/login": [HTTPError("http://localhost/", 503, "Gateway", {}, None)] * 20}
        with self.assertRaises(HTTPError):
            self.run_smoke()
        self.assertEqual(self.paths.count("/api/auth/login"), 1)
        self.assertEqual(self.delays, [])


if __name__ == "__main__":
    unittest.main()
