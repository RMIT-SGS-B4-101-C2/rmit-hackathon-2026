-- This timestamp can sort before the schema migration on a fresh checkout.
-- Guard the column change so either migration order is safe.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'ConsentGrant' AND column_name = 'researcherTideKey'
  ) THEN
    ALTER TABLE "ConsentGrant" ALTER COLUMN "researcherTideKey" DROP DEFAULT;
  END IF;
END $$;
