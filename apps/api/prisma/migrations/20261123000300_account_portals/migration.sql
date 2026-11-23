CREATE TYPE "AccountPortal" AS ENUM ('TENANT','OWNER','SERVICES');
ALTER TABLE "User" ADD COLUMN "portal" "AccountPortal" NOT NULL DEFAULT 'TENANT';
ALTER TABLE "Property" ADD COLUMN "ownerCategory" TEXT, ADD COLUMN "ownerRevision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SaleOffer" ADD COLUMN "ownerAccountId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD COLUMN "bedrooms" INTEGER, ADD COLUMN "address" TEXT, ADD COLUMN "neighborhood" TEXT, ADD COLUMN "features" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "StoredFile" ADD COLUMN "serviceType" TEXT;
ALTER TABLE "Invoice" ALTER COLUMN "leaseId" DROP NOT NULL;
CREATE TABLE "PrivacyConsent" ("id" TEXT PRIMARY KEY, "subjectId" TEXT NOT NULL, "purpose" TEXT NOT NULL, "version" TEXT NOT NULL, "policyHref" TEXT NOT NULL, "policyText" TEXT NOT NULL, "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "PrivacyConsent_subjectId_purpose_idx" ON "PrivacyConsent"("subjectId","purpose");
-- Preserve editorial overrides. Migrate only the exact former default values.
UPDATE "SiteSection" SET "values"=jsonb_set("values",'{buy}','"Compra y vende"'), "revision"="revision"+1 WHERE "id"='portada' AND "values"->>'buy'='Comprar';
UPDATE "SiteSection" SET "values"=jsonb_set("values",'{buyTitle}','"Compra y vende"'), "revision"="revision"+1 WHERE "id"='catalogos' AND "values"->>'buyTitle'='Inmuebles en venta';
UPDATE "SiteSection" SET "values"=jsonb_set("values",'{buyIntro}','"Busca inmuebles, vehículos y otros bienes en venta, o publica tu inmueble."'), "revision"="revision"+1 WHERE "id"='catalogos' AND "values"->>'buyIntro'='Consulta las propiedades en venta, compara sus precios y abre sus fotografías.';
UPDATE "SiteSection" SET "values"=jsonb_set("values",'{contractHref}','"/arrendatarios"'), "revision"="revision"+1 WHERE "id"='accesos' AND "values"->>'contractHref'='/clientes';
UPDATE "SiteSection" SET "values"=jsonb_set("values",'{manageHref}','"/propietarios"'), "revision"="revision"+1 WHERE "id"='accesos' AND "values"->>'manageHref'='/servicios';
UPDATE "SiteSection" SET "values"=jsonb_set("values",'{links}',to_jsonb(replace("values"->>'links','Comprar | /comprar','Compra y vende | /comprar'))), "revision"="revision"+1 WHERE "id"='contacto' AND position('Comprar | /comprar' in "values"->>'links')>0;
