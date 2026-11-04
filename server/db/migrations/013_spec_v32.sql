BEGIN;
SET LOCAL search_path=atp,pg_catalog;
-- Preserve existing records and applied migrations; relax time precision to one minute.
ALTER TABLE visits DROP CONSTRAINT visits_planned_time_check;
ALTER TABLE visits ADD CONSTRAINT visits_planned_time_check CHECK(
  planned_time<'24:00'::time AND extract(second FROM planned_time)=0);
COMMENT ON COLUMN visits.planned_time IS '00:00~23:59 또는 NULL. 추가 시 미정, planUpdate에서 1분 단위 변경';
COMMENT ON COLUMN day_plans.title IS 'UI38: 1~100 graphemes. UI12 변경: 0~30, 기존 긴 제목 보존. 부모 일정 제목과 독립';
-- Old submissions can contain up to 120 records. Keep them intact; enforce 10 on new API requests.
COMMIT;
