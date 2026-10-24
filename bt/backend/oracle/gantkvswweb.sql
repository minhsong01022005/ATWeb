-- Run as HR_APP in FREEPDB1 before starting the updated backend.
-- Adds department scope to web accounts so the VPD context can resolve each login.
DECLARE
  column_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO column_count
  FROM user_tab_columns
  WHERE table_name = 'USERS' AND column_name = 'DEPARTMENT';

  IF column_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE users ADD (department VARCHAR2(100))';
  END IF;
END;
/

COMMIT;

SELECT column_name, data_type, nullable
FROM user_tab_columns
WHERE table_name = 'USERS' AND column_name = 'DEPARTMENT';
