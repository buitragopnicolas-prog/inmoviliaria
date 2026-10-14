#!/usr/bin/env python3
"""Encrypt the CI token on its VPS using GitHub's repository public key."""
import base64
import ctypes
import json
import os
import pathlib
import sys

os.umask(0o077)
key = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
config = dict(line.split('=', 1) for line in pathlib.Path('/opt/asesoria-inmobiliaria/sonar/github.env').read_text().splitlines() if '=' in line)
message = config['SONAR_TOKEN'].encode()
public_key = base64.b64decode(key['key'], validate=True)
sodium = ctypes.CDLL('libsodium.so.23')
if sodium.sodium_init() < 0:
    raise SystemExit('No se pudo inicializar libsodium.')
if len(public_key) != sodium.crypto_box_publickeybytes():
    raise SystemExit('Clave pública inválida.')
ciphertext = ctypes.create_string_buffer(len(message) + sodium.crypto_box_sealbytes())
sodium.crypto_box_seal.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulonglong, ctypes.c_void_p]
sodium.crypto_box_seal.restype = ctypes.c_int
if sodium.crypto_box_seal(ciphertext, message, len(message), public_key) != 0:
    raise SystemExit('No se pudo cifrar el secreto.')
output = {'key_id': key['key_id'], 'encrypted_value': base64.b64encode(ciphertext.raw).decode()}
pathlib.Path(sys.argv[2]).write_text(json.dumps(output))
print('Token cifrado para GitHub; la credencial original permanece en el VPS.')
