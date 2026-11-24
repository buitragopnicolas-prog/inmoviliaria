BEGIN;
ALTER TABLE "Property"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD CONSTRAINT "Property_location_check" CHECK (
    num_nonnulls("latitude", "longitude") = 0 OR
    (num_nonnulls("latitude", "longitude") = 2 AND
     "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  );
ALTER TABLE "SaleOffer"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD CONSTRAINT "SaleOffer_location_check" CHECK (
    num_nonnulls("latitude", "longitude") = 0 OR
    ("catalog" = 'comprar' AND num_nonnulls("latitude", "longitude") = 2 AND
     "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  );
COMMIT;
