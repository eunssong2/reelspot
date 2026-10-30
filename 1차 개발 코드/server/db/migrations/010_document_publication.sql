ALTER TABLE consent_documents
  ADD COLUMN kind text NOT NULL DEFAULT 'consent' CHECK (kind IN ('consent','notice')),
  ADD COLUMN title text NOT NULL DEFAULT '',
  ADD COLUMN body text;
-- Only the known development examples change. Existing published consent records remain intact.
UPDATE consent_documents SET kind='notice',required=false,title='개인정보 처리방침'
WHERE item_key='privacy' AND version='dev-1';
UPDATE consent_documents SET title='서비스 이용약관' WHERE item_key='terms' AND version='dev-1';
ALTER TABLE consent_documents ADD CONSTRAINT notice_not_required CHECK (kind<>'notice' OR NOT required);
