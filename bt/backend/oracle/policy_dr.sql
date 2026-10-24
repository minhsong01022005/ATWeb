
BEGIN
  DBMS_REDACT.ADD_POLICY(
    object_schema       => 'HR_APP',
    object_name         => 'EMPLOYEES',
    column_name         => 'CARD_NUMBER',
    policy_name         => 'HR_EMPLOYEE_PAYROLL_REDACTION',
    function_type       => DBMS_REDACT.FULL,
    expression          => 'SYS_CONTEXT(''USERENV'',''SESSION_USER'') = ''HR_APP''',
    policy_description  => 'Redact HR employee card number and salary'
  );

  DBMS_REDACT.ALTER_POLICY(
    object_schema       => 'HR_APP',
    object_name         => 'EMPLOYEES',
    policy_name         => 'HR_EMPLOYEE_PAYROLL_REDACTION',
    action              => DBMS_REDACT.ADD_COLUMN,
    column_name         => 'SALARY_AMOUNT',
    function_type       => DBMS_REDACT.FULL
  );
END;
/
