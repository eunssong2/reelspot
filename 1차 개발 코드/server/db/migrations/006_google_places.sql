-- Preserve existing Kakao/manual places; add Google as the requested provider.
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='places'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%provider%'
  LOOP EXECUTE format('ALTER TABLE places DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
ALTER TABLE places ADD CONSTRAINT places_provider_check CHECK(provider IN ('google','kakao','manual'));
ALTER TABLE places ADD CONSTRAINT places_provider_id_check CHECK((provider='manual' AND provider_place_id IS NULL) OR (provider IN ('google','kakao') AND provider_place_id IS NOT NULL));
