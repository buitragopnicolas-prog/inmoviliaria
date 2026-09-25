# Pagos manuales verificables y automatización futura

## Separación arquitectónica

`PAYMENT_MODE` define el flujo operativo:

- `manual`: QR, Bre-B, transferencia o consignación fuera de la plataforma. El reporte queda en `AWAITING_VERIFICATION`.
- `gateway`: delega el cobro a la pasarela indicada por `PAYMENT_GATEWAY`.
- `mock`: simulación exclusiva de entornos locales. La API impide su aprobación con `NODE_ENV=production`.

`PAYMENT_PROVIDER` se conserva como compatibilidad temporal cuando `PAYMENT_MODE` no existe. No se interpreta `manual` como `mock`.

La compuerta `scripts/payment-config-policy.mjs` bloquea producción si detecta simulación, una pasarela vacía o un modo manual sin al menos un medio autorizado completo.

## Configuración manual

Los datos que el usuario debe ver se entregan desde `GET /api/payments/manual/config`. Se configuran en el backend mediante las variables `MANUAL_PAYMENT_*` documentadas en `.env.example`. Ningún componente contiene cuentas, titulares o llaves escritos en el código.

Para habilitar un método se requieren:

- QR: entidad, titular y URL pública autorizada del QR.
- Bre-B: entidad, titular, tipo de llave y valor público de la llave.
- Transferencia o consignación: entidad, titular, tipo de cuenta y número en el formato que la empresa autorice mostrar.

Si faltan datos, la interfaz muestra el método deshabilitado. Esto evita publicar valores de demostración como si fueran instrucciones reales.

## Flujo y seguridad

1. El usuario autenticado consulta una factura propia.
2. La API vuelve a calcular el saldo; ignora cualquier intento de cambiar el valor desde el navegador.
3. El usuario informa método, fecha y referencia. Puede adjuntar JPG, PNG o PDF de hasta `PAYMENT_RECEIPT_MAX_FILE_SIZE`.
4. La API verifica propiedad, método habilitado, fecha, monto, referencia duplicada y clave de idempotencia.
5. El comprobante se guarda en MinIO como `PAYMENT_RECEIPT` y solo el titular o un administrador pueden consultarlo.
6. El pago queda en `AWAITING_VERIFICATION`; la factura conserva su saldo.
7. Administración confirma, rechaza o pasa el reporte a revisión. Cada transición crea un `PaymentAuditEvent`.
8. Solo `APPROVED` participa en el saldo y puede cambiar la factura a `PAID`.

## Contrato para n8n

n8n nunca debe escribir en PostgreSQL. Debe consumir una API autenticada y dejar la decisión monetaria en el backend.

Flujo futuro recomendado:

```text
Pago reportado -> webhook controlado -> n8n obtiene evidencia
-> compara movimiento/correo/archivo -> envía recomendación
-> API valida reglas determinísticas -> revisión administrativa o confirmación autorizada
```

Workflows previstos:

1. **Payment reported:** recibe el identificador, consulta la API y registra el evento.
2. **Reconciliation:** compara valor, fecha, referencia, cuenta destino y contrato contra una fuente bancaria autorizada.
3. **Document analysis:** extrae datos del comprobante y devuelve `PROBABLE_MATCH`, `REVIEW_REQUIRED` o `NO_MATCH` con razones.
4. **Admin alert:** notifica inconsistencias sin incluir cuentas completas, documentos o tokens.
5. **Payment confirmed:** reacciona a la confirmación del backend y actualiza sistemas dependientes mediante APIs.

La integración existente de correo Bancolombia ya valida remitentes, idempotencia, cuenta receptora, valor y coincidencia de pagador. Debe evolucionar como fuente de evidencia autorizada; la IA puede recomendar, pero no aprobar dinero.

## Promoción entre entornos

Esta implementación se valida primero en local. DEV y producción requieren datos financieros autorizados, migración revisada y aprobación explícita. No se deben incluir secretos ni credenciales bancarias en Git, n8n o el navegador.
