-- Run as HR_APP to disable the payroll redaction policies.
BEGIN
  DBMS_REDACT.DROP_POLICY(
    object_schema => 'HR_APP',
    object_name   => 'EMPLOYEES',
    policy_name   => 'HR_EMPLOYEE_PAYROLL_REDACTION'
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -28068 THEN RAISE; END IF;
END;
/

-- Remove the older isolated demo policy too, if it exists.
BEGIN
  DBMS_REDACT.DROP_POLICY(
    object_schema => 'HR_APP',
    object_name   => 'REDACTION_DEMO',
    policy_name   => 'HR_PAYROLL_REDACTION'
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -28068 THEN RAISE; END IF;
END;
/
