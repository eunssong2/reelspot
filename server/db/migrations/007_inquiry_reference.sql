ALTER TABLE reports_and_cases ADD COLUMN reference_id text;
COMMENT ON COLUMN reports_and_cases.reference_id IS '문의자가 지정한 신고·작업·요청 식별값. 외부 공개하지 않음';
