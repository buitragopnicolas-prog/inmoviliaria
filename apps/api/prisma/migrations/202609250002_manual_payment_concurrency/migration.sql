CREATE UNIQUE INDEX "Payment_one_active_manual_per_invoice_key"
ON "Payment" ("invoiceId")
WHERE "provider" = 'MANUAL' AND "status" IN ('AWAITING_VERIFICATION', 'UNDER_REVIEW');

CREATE UNIQUE INDEX "Payment_manual_bank_reference_key"
ON "Payment" (UPPER("bankReference"))
WHERE "provider" = 'MANUAL' AND "bankReference" IS NOT NULL;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount_check" CHECK ("amount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currency_check" CHECK ("currency" = 'COP');
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_manual_reference_normalized_check"
CHECK ("provider" <> 'MANUAL' OR "bankReference" IS NULL OR "bankReference" = UPPER("bankReference"));
ALTER TABLE "PaymentAuditEvent" ADD CONSTRAINT "PaymentAuditEvent_transition_check"
CHECK ("fromStatus" IS NULL OR "fromStatus" <> "toStatus");

CREATE OR REPLACE FUNCTION prevent_payment_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'PaymentAuditEvent is append-only';
END;
$$;

CREATE TRIGGER "PaymentAuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "PaymentAuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_payment_audit_mutation();
