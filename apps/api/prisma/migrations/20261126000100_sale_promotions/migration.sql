ALTER TABLE "SaleOffer"
  ADD COLUMN "promotion" TEXT,
  ADD COLUMN "estimatedMonthlyRent" DECIMAL(14,0),
  ADD CONSTRAINT "SaleOffer_promotion_check" CHECK (
    ("promotion" IS NULL OR ("catalog" = 'comprar' AND "promotion" IN ('premium','new-project')))
    AND ("estimatedMonthlyRent" IS NULL OR ("catalog" = 'comprar' AND "estimatedMonthlyRent" > 0))
  );
