ALTER TYPE "StoredFilePurpose" ADD VALUE 'MANAGED_PDF';
ALTER TABLE "StoredFile" ADD COLUMN "recipientId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "newsPostId" TEXT REFERENCES "NewsPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StoredFile_recipientId_createdAt_idx" ON "StoredFile"("recipientId", "createdAt");
CREATE INDEX "StoredFile_newsPostId_idx" ON "StoredFile"("newsPostId");
CREATE TABLE "RentalTemplate" (
  "key" TEXT PRIMARY KEY CHECK ("key" IN ('solicitud', 'contrato')),
  "fileId" TEXT NOT NULL REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RentalTemplate_fileId_key" ON "RentalTemplate"("fileId");
ALTER TABLE "NewsPost" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Noticia';
CREATE TABLE "Suggestion" ("id" TEXT PRIMARY KEY, "message" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
-- Conserva los títulos personalizados y actualiza las etiquetas iniciales ya guardadas.
UPDATE "SiteSection" SET "values" = jsonb_set("values", '{navNews}', to_jsonb('Boletín jurídico y noticias'::text)),
  "revision" = "revision" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE id='identidad' AND "values"->>'navNews'='Artículos';
UPDATE "SiteSection" SET "values" = jsonb_set("values", '{articleTitle}', to_jsonb('Boletín jurídico y noticias'::text)),
  "revision" = "revision" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE id='catalogos' AND "values"->>'articleTitle'='Artículos de la inmobiliaria';
