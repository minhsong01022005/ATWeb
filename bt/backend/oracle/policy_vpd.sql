CREATE OR REPLACE PACKAGE smart_hr_vpd_ctx_pkg AS
  PROCEDURE set_user(p_username IN VARCHAR2);
  PROCEDURE clear_context;
END smart_hr_vpd_ctx_pkg;
/

CREATE OR REPLACE PACKAGE BODY smart_hr_vpd_ctx_pkg AS
  PROCEDURE set_user(p_username IN VARCHAR2) IS
    v_role       users.role%TYPE;
    v_department users.department%TYPE;
  BEGIN
    SELECT UPPER(role), department
      INTO v_role, v_department
      FROM users
     WHERE username = p_username;

    IF v_role NOT IN ('ADMIN', 'DEPARTMENT') THEN
      RAISE_APPLICATION_ERROR(-20081, 'Unsupported Smart HR account role');
    END IF;
    IF v_role = 'DEPARTMENT' AND v_department IS NULL THEN
      RAISE_APPLICATION_ERROR(-20082, 'Department account has no department');
    END IF;

    DBMS_SESSION.SET_CONTEXT('SMART_HR_VPD_CTX', 'ROLE', v_role);
    DBMS_SESSION.SET_CONTEXT('SMART_HR_VPD_CTX', 'DEPARTMENT', v_department);
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      DBMS_SESSION.SET_CONTEXT('SMART_HR_VPD_CTX', 'ROLE', NULL);
      DBMS_SESSION.SET_CONTEXT('SMART_HR_VPD_CTX', 'DEPARTMENT', NULL);
      RAISE_APPLICATION_ERROR(-20083, 'Smart HR account was not found');
  END set_user;

  PROCEDURE clear_context IS
  BEGIN
    DBMS_SESSION.SET_CONTEXT('SMART_HR_VPD_CTX', 'ROLE', NULL);
    DBMS_SESSION.SET_CONTEXT('SMART_HR_VPD_CTX', 'DEPARTMENT', NULL);
  END clear_context;
END smart_hr_vpd_ctx_pkg;
/

CREATE OR REPLACE FUNCTION smart_hr_department_predicate(
  p_schema IN VARCHAR2,
  p_object IN VARCHAR2
) RETURN VARCHAR2 AUTHID DEFINER IS
  v_role       VARCHAR2(40) := SYS_CONTEXT('SMART_HR_VPD_CTX', 'ROLE');
  v_department VARCHAR2(100) := SYS_CONTEXT('SMART_HR_VPD_CTX', 'DEPARTMENT');
BEGIN
  IF v_role = 'ADMIN' THEN
    RETURN '1=1';
  END IF;

  IF v_role <> 'DEPARTMENT' OR v_department IS NULL THEN
    RETURN '1=0';
  END IF;

  IF UPPER(p_object) = 'EMPLOYEES' THEN
    RETURN 'department = SYS_CONTEXT(''SMART_HR_VPD_CTX'', ''DEPARTMENT'')';
  ELSIF UPPER(p_object) IN ('ATTENDANCE', 'LEAVE_REQUESTS') THEN
    RETURN 'employee_id IN (SELECT id FROM HR_APP.EMPLOYEES '
      || 'WHERE department = SYS_CONTEXT(''SMART_HR_VPD_CTX'', ''DEPARTMENT''))';
  END IF;

  RETURN '1=0';
END smart_hr_department_predicate;
/

BEGIN
  DBMS_RLS.DROP_POLICY('HR_APP', 'EMPLOYEES', 'HR_EMPLOYEE_DEPT_VPD');
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -28102 THEN RAISE; END IF;
END;
/
BEGIN
  DBMS_RLS.DROP_POLICY('HR_APP', 'ATTENDANCE', 'HR_ATTENDANCE_DEPT_VPD');
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -28102 THEN RAISE; END IF;
END;
/
BEGIN
  DBMS_RLS.DROP_POLICY('HR_APP', 'LEAVE_REQUESTS', 'HR_LEAVE_DEPT_VPD');
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -28102 THEN RAISE; END IF;
END;
/

BEGIN
  DBMS_RLS.ADD_POLICY(
    object_schema   => 'HR_APP',
    object_name     => 'EMPLOYEES',
    policy_name     => 'HR_EMPLOYEE_DEPT_VPD',
    function_schema => 'HR_APP',
    policy_function => 'SMART_HR_DEPARTMENT_PREDICATE',
    statement_types => 'SELECT,INSERT,UPDATE,DELETE',
    update_check    => TRUE,
    enable          => TRUE
  );

  DBMS_RLS.ADD_POLICY(
    object_schema   => 'HR_APP',
    object_name     => 'ATTENDANCE',
    policy_name     => 'HR_ATTENDANCE_DEPT_VPD',
    function_schema => 'HR_APP',
    policy_function => 'SMART_HR_DEPARTMENT_PREDICATE',
    statement_types => 'SELECT,INSERT,UPDATE,DELETE',
    update_check    => TRUE,
    enable          => TRUE
  );

  DBMS_RLS.ADD_POLICY(
    object_schema   => 'HR_APP',
    object_name     => 'LEAVE_REQUESTS',
    policy_name     => 'HR_LEAVE_DEPT_VPD',
    function_schema => 'HR_APP',
    policy_function => 'SMART_HR_DEPARTMENT_PREDICATE',
    statement_types => 'SELECT,INSERT,UPDATE,DELETE',
    update_check    => TRUE,
    enable          => TRUE
  );
END;
/

COMMIT;

SELECT object_name, policy_name, enable, sel, ins, upd, del
FROM user_policies
WHERE policy_name IN (
  'HR_EMPLOYEE_DEPT_VPD',
  'HR_ATTENDANCE_DEPT_VPD',
  'HR_LEAVE_DEPT_VPD'
)
ORDER BY object_name;
