import os
from datetime import date, datetime

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Sequence, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Activity, Attendance, Employee, LeaveRequest, RedactionDemoRecord, User
from .schemas import AttendanceCreate, EmployeeCreate, EmployeeOut, EmployeeUpdate, LeaveCreate, LeaveDecision, LoginInput, SalaryUpdate
from .security import hash_password, issue_token, read_token, verify_password

app = FastAPI(title="Smart HR API", version="1.0.0", description="API quản lý nhân sự Smart HR")
origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in origins], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
bearer = HTTPBearer(auto_error=False)
VPD_ENABLED = os.getenv("VPD_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}

DEPARTMENT_DEMO_ACCOUNTS = (
    ("hr", "Tài khoản Hành chính - Nhân sự", "Phòng Hành chính - Nhân sự"),
    ("finance", "Tài khoản Tài chính - Kế toán", "Phòng Tài chính - Kế toán"),
    ("tech", "Tài khoản Công nghệ", "Phòng Công nghệ / Phát triển Sản phẩm"),
    ("marketing", "Tài khoản Kinh doanh - Tiếp thị", "Phòng Kinh doanh & Tiếp thị"),
)

DEPARTMENT_MIGRATION = {
    "Nhân sự": "Phòng Hành chính - Nhân sự",
    "Hành chính - Nhân sự": "Phòng Hành chính - Nhân sự",
    "Tài chính": "Phòng Tài chính - Kế toán",
    "Kế toán": "Phòng Tài chính - Kế toán",
    "Công nghệ": "Phòng Công nghệ / Phát triển Sản phẩm",
    "Sản phẩm": "Phòng Công nghệ / Phát triển Sản phẩm",
    "Product": "Phòng Công nghệ / Phát triển Sản phẩm",
    "Marketing": "Phòng Kinh doanh & Tiếp thị",
    "Kinh doanh": "Phòng Kinh doanh & Tiếp thị",
}


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    # create_all() does not add sequences when the tables already exist.
    # Ensure PK generators also exist for Oracle schemas created by an earlier run.
    if engine.dialect.name == "oracle":
        for table in Base.metadata.sorted_tables:
            for column in table.primary_key.columns:
                if isinstance(column.default, Sequence):
                    column.default.create(bind=engine, checkfirst=True)
    with next(get_db()) as db:
        if not db.scalar(select(User).where(User.username == "admin")):
            db.add(User(username="admin", password_hash=hash_password(os.getenv("ADMIN_PASSWORD", "Admin@123")), full_name="Lan Anh", role="admin"))
        db.flush()
        # Startup data checks must not be hidden by VPD after it is enabled.
        if VPD_ENABLED and engine.dialect.name == "oracle":
            db.execute(text("BEGIN HR_APP.SMART_HR_VPD_CTX_PKG.SET_USER('admin'); END;"))
        demo_password = os.getenv("DEMO_DEPARTMENT_PASSWORD", "").strip()
        if demo_password:
            for username, full_name, department in DEPARTMENT_DEMO_ACCOUNTS:
                if not db.scalar(select(User).where(User.username == username)):
                    db.add(User(
                        username=username,
                        password_hash=hash_password(demo_password),
                        full_name=full_name,
                        role="department",
                        department=department,
                    ))
        if db.scalar(select(func.count(Employee.id))) == 0:
            seed = [
                ("Minh Tuấn", "Phòng Công nghệ / Phát triển Sản phẩm", "Product Manager", date(2026, 10, 1)),
                ("Hà Trâm", "Phòng Kinh doanh & Tiếp thị", "Chuyên viên Tiếp thị", date(2026, 9, 28)),
                ("Quốc Nam", "Phòng Công nghệ / Phát triển Sản phẩm", "Kỹ sư phần mềm", date(2026, 9, 25)),
                ("Phương Linh", "Phòng Hành chính - Nhân sự", "Chuyên viên nhân sự", date(2026, 9, 23)),
                ("Ngọc Mai", "Phòng Tài chính - Kế toán", "Kế toán", date(2026, 7, 12)),
            ]
            for i, (name, dept, pos, joined) in enumerate(seed, 1):
                db.add(Employee(code=f"NV-{i:04d}", full_name=name, department=dept, position=pos, card_number=f"CARD-NV-{i:04d}", salary_amount=10_000_000, join_date=joined, status="active"))
            db.add(Activity(message="Dữ liệu Smart HR đã sẵn sàng", category="system"))
        # Convert department names used by earlier demo versions to the four canonical names.
        for old_name, new_name in DEPARTMENT_MIGRATION.items():
            db.query(Employee).filter(Employee.department == old_name).update(
                {Employee.department: new_name}, synchronize_session=False
            )
        db.commit()


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Vui lòng đăng nhập")
    username = read_token(credentials.credentials)
    user = db.scalar(select(User).where(User.username == username))
    if not user:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")
    if VPD_ENABLED and engine.dialect.name == "oracle":
        try:
            db.execute(
                text("BEGIN HR_APP.SMART_HR_VPD_CTX_PKG.SET_USER(:username); END;"),
                {"username": user.username},
            )
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=503, detail="Không thiết lập được VPD context. Kiểm tra các script Oracle VPD đã chạy chưa.") from exc
    return user


def admin_user(user: User = Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Tài khoản phòng ban chỉ có quyền xem dữ liệu")
    return user


def add_activity(db: Session, message: str, category: str):
    db.add(Activity(message=message, category=category))


def attendance_status(check_in: str | None, check_out: str | None) -> str:
    """Attendance is on time only when both required time thresholds are met."""
    if check_in and check_out and check_in <= "09:00" and check_out >= "17:00":
        return "on_time"
    return "late_or_early"


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Smart HR API"}


@app.post("/api/auth/login")
def login(payload: LoginInput, request: Request, db: Session = Depends(get_db)):
    sqli_demo = os.getenv("SQLI_DEMO_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
    # Lỗi SQLI
    if sqli_demo:
        
        if request.client is None or request.client.host not in {"127.0.0.1", "::1", "localhost", "testclient"}:
            raise HTTPException(status_code=403, detail="Ch? ?? SQLi demo ch? cho ph?p truy c?p t? m?y local")
        statement = text(
            'SELECT username AS "username" FROM users '
            f"WHERE username = '{payload.username}'"
        )
        result = db.execute(statement).mappings().first()
        user = db.scalar(select(User).where(User.username == result["username"])) if result else None
        if not user or (payload.username == user.username and not verify_password(payload.password, user.password_hash)):
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
    else:
        # Bind variable
        user = db.scalar(select(User).where(User.username == payload.username))
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
    return {"access_token": issue_token(user.username), "token_type": "bearer", "user": {"name": user.full_name, "username": user.username, "role": user.role, "department": user.department}}


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return {"name": user.full_name, "username": user.username, "role": user.role, "department": user.department}


@app.get("/api/dashboard", dependencies=[Depends(current_user)])
def dashboard(db: Session = Depends(get_db)):
    today = date.today()
    total = db.scalar(select(func.count(Employee.id)).where(Employee.status == "active")) or 0
    pending = db.scalar(select(func.count(LeaveRequest.id)).where(LeaveRequest.status == "pending")) or 0
    attendance = db.scalars(select(Attendance).where(Attendance.work_date == today)).all()
    on_time = sum(1 for row in attendance if attendance_status(row.check_in, row.check_out) == "on_time")
    late_or_early = len(attendance) - on_time
    return {"total_employees": total, "present": len(attendance), "on_time": on_time, "late_or_early": late_or_early, "not_recorded": max(total - len(attendance), 0), "pending_leaves": pending, "open_positions": 8, "today": today.isoformat()}


@app.get("/api/employees", response_model=list[EmployeeOut], dependencies=[Depends(current_user)])
def list_employees(q: str = Query(default="", max_length=120), department: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Employee).order_by(Employee.id.desc())
    if q:
        stmt = stmt.where(Employee.full_name.ilike(f"%{q}%") | Employee.code.ilike(f"%{q}%"))
    if department:
        stmt = stmt.where(Employee.department == department)
    return db.scalars(stmt).all()


@app.post("/api/employees", response_model=EmployeeOut, status_code=201, dependencies=[Depends(admin_user)])
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    next_id = (db.scalar(select(func.max(Employee.id))) or 0) + 1
    values = payload.model_dump()
    values["email"] = values["email"] or None
    values["salary_amount"] = 10_000_000
    employee = Employee(code=f"NV-{next_id:04d}", **values)
    db.add(employee)
    add_activity(db, f"{payload.full_name} đã được thêm vào phòng {payload.department}", "employee")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email hoặc mã số thẻ đã được sử dụng")
    db.refresh(employee)
    return employee


@app.patch("/api/employees/{employee_id}", response_model=EmployeeOut, dependencies=[Depends(admin_user)])
def update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    changes = payload.model_dump(exclude_unset=True)
    if "email" in changes:
        changes["email"] = changes["email"] or None
    if "card_number" in changes and not changes["card_number"]:
        raise HTTPException(status_code=422, detail="Mã số thẻ không được để trống")
    if "status" in changes and changes["status"] not in {"active", "inactive"}:
        raise HTTPException(status_code=422, detail="Trạng thái phải là active hoặc inactive")
    for key, value in changes.items():
        setattr(employee, key, value)
    add_activity(db, f"Đã cập nhật hồ sơ nhân viên {employee.full_name}", "employee")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email hoặc mã số thẻ đã được sử dụng")
    db.refresh(employee)
    return employee


@app.delete("/api/employees/{employee_id}", dependencies=[Depends(admin_user)])
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    employee_name = employee.full_name
    db.query(RedactionDemoRecord).filter(
        RedactionDemoRecord.employee_code == employee.code
    ).delete(synchronize_session=False)
    # Employee ORM cascades remove attendance and leave requests to avoid orphan rows.
    db.delete(employee)
    add_activity(db, f"Đã xóa hồ sơ nhân viên {employee_name}", "employee")
    db.commit()
    return {"message": "Đã xóa nhân viên"}


@app.patch("/api/employees/{employee_id}/salary", dependencies=[Depends(admin_user)])
def update_employee_salary(employee_id: int, payload: SalaryUpdate, db: Session = Depends(get_db)):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    employee.salary_amount = payload.salary_amount
    add_activity(db, f"Đã cập nhật lương cho nhân viên {employee.full_name}", "payroll")
    db.commit()
    return {"employee_id": employee.id, "salary_amount": employee.salary_amount}


@app.get("/api/attendance", dependencies=[Depends(current_user)])
def list_attendance(work_date: date = Query(default_factory=date.today), db: Session = Depends(get_db)):
    rows = db.scalars(select(Attendance).where(Attendance.work_date == work_date).order_by(Attendance.id.desc())).all()
    return [{"id": r.id, "employee_id": r.employee_id, "employee_name": r.employee.full_name, "employee_code": r.employee.code, "work_date": r.work_date, "check_in": r.check_in, "check_out": r.check_out, "status": attendance_status(r.check_in, r.check_out), "note": r.note} for r in rows]


@app.post("/api/attendance", status_code=201, dependencies=[Depends(admin_user)])
def create_attendance(payload: AttendanceCreate, db: Session = Depends(get_db)):
    if not db.get(Employee, payload.employee_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    values = payload.model_dump()
    values["status"] = attendance_status(values["check_in"], values["check_out"])
    row = Attendance(**values)
    db.add(row)
    add_activity(db, f"Đã cập nhật chấm công cho nhân viên NV-{payload.employee_id:04d}", "attendance")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Nhân viên đã có dữ liệu chấm công ngày này")
    db.refresh(row)
    return {"id": row.id, "employee_id": row.employee_id, "work_date": row.work_date, "status": row.status}


@app.get("/api/leaves", dependencies=[Depends(current_user)])
def list_leaves(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(LeaveRequest).order_by(LeaveRequest.id.desc())
    if status:
        stmt = stmt.where(LeaveRequest.status == status)
    return [{"id": r.id, "employee_id": r.employee_id, "employee_name": r.employee.full_name, "employee_code": r.employee.code, "start_date": r.start_date, "end_date": r.end_date, "reason": r.reason, "status": r.status} for r in db.scalars(stmt).all()]


@app.post("/api/leaves", status_code=201, dependencies=[Depends(admin_user)])
def create_leave(payload: LeaveCreate, db: Session = Depends(get_db)):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="Ngày kết thúc phải sau ngày bắt đầu")
    employee = db.get(Employee, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    row = LeaveRequest(**payload.model_dump())
    db.add(row)
    add_activity(db, f"{employee.full_name} gửi yêu cầu nghỉ phép", "leave")
    db.commit()
    db.refresh(row)
    return {"id": row.id, "status": row.status, "employee_name": employee.full_name}


@app.patch("/api/leaves/{leave_id}", dependencies=[Depends(admin_user)])
def decide_leave(leave_id: int, payload: LeaveDecision, db: Session = Depends(get_db)):
    if payload.status not in {"approved", "rejected"}:
        raise HTTPException(status_code=422, detail="Trạng thái phải là approved hoặc rejected")
    row = db.get(LeaveRequest, leave_id)
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu nghỉ phép")
    row.status = payload.status
    add_activity(db, f"Yêu cầu nghỉ phép của {row.employee.full_name} đã được {'duyệt' if payload.status == 'approved' else 'từ chối'}", "leave")
    db.commit()
    return {"id": row.id, "status": row.status}


@app.get("/api/activities")
def list_activities(limit: int = Query(default=10, ge=1, le=50), user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        return []
    rows = db.scalars(select(Activity).order_by(Activity.id.desc()).limit(limit)).all()
    return [{"id": row.id, "message": row.message, "category": row.category, "created_at": row.created_at or datetime.now()} for row in rows]


@app.get("/api/payroll", dependencies=[Depends(current_user)])
def list_payroll(db: Session = Depends(get_db)):
    employees = db.scalars(select(Employee).order_by(Employee.id)).all()
    return [{
        "id": employee.id,
        "employee_code": employee.code,
        "full_name": employee.full_name,
        "department": employee.department,
        "card_number": employee.card_number,
        "salary_amount": employee.salary_amount,
    } for employee in employees]
