-- 1. BEFORE INSERT trigger to force recorded_at := now()
CREATE OR REPLACE FUNCTION public.force_voice_logs_recorded_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.recorded_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS voice_logs_force_recorded_at ON public.voice_logs;

CREATE TRIGGER voice_logs_force_recorded_at
BEFORE INSERT ON public.voice_logs
FOR EACH ROW
EXECUTE FUNCTION public.force_voice_logs_recorded_at();

-- 2. Backfill rows where recorded_at is clearly a local-midnight value.
-- A local-midnight value in any IANA timezone always lands on an exact hour
-- in UTC with 0 minutes / 0 seconds / 0 microseconds. Real recordings from
-- now() effectively never satisfy that. We additionally require that
-- created_at differs from recorded_at by more than 1 minute to avoid
-- touching legitimate on-the-hour recordings.
DO $$
DECLARE
  affected INT;
BEGIN
  WITH updated AS (
    UPDATE public.voice_logs
    SET recorded_at = created_at
    WHERE EXTRACT(MINUTE FROM recorded_at AT TIME ZONE 'UTC') = 0
      AND EXTRACT(SECOND FROM recorded_at AT TIME ZONE 'UTC') = 0
      AND ABS(EXTRACT(EPOCH FROM (created_at - recorded_at))) > 60
    RETURNING 1
  )
  SELECT COUNT(*) INTO affected FROM updated;
  RAISE NOTICE 'Backfilled % voice_logs rows', affected;
END $$;