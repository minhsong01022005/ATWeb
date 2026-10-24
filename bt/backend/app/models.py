from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, Sequence, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, Sequence("users_id_seq"), primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    full_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(40), default="admin")
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)


class Employee(Base):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(Integer, Sequence("employees_id_seq"), primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160), index=True)
    email: Mapped[str | None] = mapped_column(String(160), unique=True, nullable=True)
    department: Mapped[str] = mapped_column(String(100), default="Phòng Hành chính - Nhân sự")
    position: Mapped[str] = mapped_column(String(100), default="Nhân viên")
    card_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    salary_amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=Decimal("10000000"), nullable=False)
    join_date: Mapped[date] = mapped_column(Date, default=date.today)
    status: Mapped[str] = mapped_column(String(30), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    attendance: Mapped[list["Attendance"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    leaves: Mapped[list["LeaveRequest"]] = relationship(back_populates="employee", cascade="all, delete-orphan")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("employee_id", "work_date", name="uq_attendance_employee_day"),)
    id: Mapped[int] = mapped_column(Integer, Sequence("attendance_id_seq"), primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    work_date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    check_in: Mapped[str | None] = mapped_column(String(8), nullable=True)
    check_out: Mapped[str | None] = mapped_column(String(8), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="late_or_early")
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    employee: Mapped[Employee] = relationship(back_populates="attendance")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id: Mapped[int] = mapped_column(Integer, Sequence("leave_requests_id_seq"), primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    employee: Mapped[Employee] = relationship(back_populates="leaves")


class Activity(Base):
    __tablename__ = "activities"
    id: Mapped[int] = mapped_column(Integer, Sequence("activities_id_seq"), primary_key=True)
    message: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(40), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)


class RedactionDemoRecord(Base):
    """Synthetic payroll data used only to demonstrate Oracle Data Redaction."""
    __tablename__ = "redaction_demo"
    id: Mapped[int] = mapped_column(Integer, Sequence("redaction_demo_id_seq"), primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    national_id: Mapped[str] = mapped_column(String(12))
    salary_amount: Mapped[Decimal] = mapped_column(Numeric(12, 0))
