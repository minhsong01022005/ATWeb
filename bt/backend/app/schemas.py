from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Department = Literal[
    "Phòng Hành chính - Nhân sự",
    "Phòng Tài chính - Kế toán",
    "Phòng Công nghệ / Phát triển Sản phẩm",
    "Phòng Kinh doanh & Tiếp thị",
]
DEFAULT_DEPARTMENT: Department = "Phòng Hành chính - Nhân sự"


class LoginInput(BaseModel):
    username: str
    password: str


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: str | None = None
    card_number: str = Field(min_length=3, max_length=40)
    department: Department = DEFAULT_DEPARTMENT
    position: str = "Nhân viên"
    join_date: date = Field(default_factory=date.today)


class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    email: str | None = None
    card_number: str | None = Field(default=None, min_length=3, max_length=40)
    department: Department | None = None
    position: str | None = None
    join_date: date | None = None
    status: Literal["active", "inactive"] | None = None


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    full_name: str
    email: str | None
    card_number: str
    salary_amount: Decimal
    department: str
    position: str
    join_date: date
    status: str


class SalaryUpdate(BaseModel):
    salary_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=0)


class AttendanceCreate(BaseModel):
    employee_id: int
    work_date: date = Field(default_factory=date.today)
    check_in: str
    check_out: str
    note: str | None = None

    @field_validator("check_in", "check_out")
    @classmethod
    def validate_time(cls, value: str) -> str:
        try:
            return datetime.strptime(value, "%H:%M").strftime("%H:%M")
        except ValueError as exc:
            raise ValueError("Giờ phải có định dạng HH:MM") from exc


class LeaveCreate(BaseModel):
    employee_id: int
    start_date: date
    end_date: date
    reason: str = Field(min_length=2, max_length=2000)


class LeaveDecision(BaseModel):
    status: Literal["approved", "rejected"]
