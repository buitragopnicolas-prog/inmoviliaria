CREATE TABLE "SiteSection" (
  "id" TEXT PRIMARY KEY,
  "values" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "SaleOffer" (
  "id" TEXT PRIMARY KEY,
  "catalog" TEXT NOT NULL CHECK ("catalog" IN ('comprar','vehiculos-y-bienes')),
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "city" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL,
  "price" DECIMAL(14,0) NOT NULL CHECK ("price" > 0),
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "published" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SaleOffer_catalog_published_createdAt_idx" ON "SaleOffer"("catalog","published","createdAt");
