# Smart HR API

FastAPI backend cho ứng dụng Smart HR. API hỗ trợ đăng nhập, thống kê tổng quan, nhân viên, chấm công, nghỉ phép và nhật ký hoạt động. Backend kết nối trực tiếp Oracle Database bằng SQLAlchemy và `python-oracledb`; cấu hình SQLite đã được loại bỏ để các lần chạy không vô tình ghi dữ liệu sang database khác.

## Chạy local

Yêu cầu Python 3.10 trở lên.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Chỉ khi vừa tạo .env: mở file và điền thông tin Oracle của bạn.
python -m uvicorn app.main:app --reload
```

`DATABASE_URL` phải bắt đầu bằng `oracle+oracledb://`, ví dụ `oracle+oracledb://hr_app:password@127.0.0.1:1521/?service_name=FREEPDB1`. Backend không tự tạo database; nó tạo các bảng và sequence trong schema Oracle của user này. Tài khoản web `admin` được tạo lần đầu, mật khẩu lấy từ `ADMIN_PASSWORD` (mặc định `Admin@123`). API docs tại `http://127.0.0.1:8000/docs`.

## Kết nối Oracle

Điền URL kết nối thực tế vào `backend/.env`; ví dụ Oracle AI Database Free cài trên máy:

```env
DATABASE_URL=oracle+oracledb://hr_app:your_password@127.0.0.1:1521/?service_name=FREEPDB1
```

Nếu dùng service khác, thay `FREEPDB1` bằng service name của PDB trong SQL Developer. File `.env` không được commit.

Tài khoản DB cần quyền tạo bảng và sequence cho các khóa chính. Cấp quyền bổ sung bằng tài khoản quản trị trong SQL Developer:

```sql
GRANT CREATE SEQUENCE TO hr_app;
```

Dùng secret và mật khẩu riêng cho môi trường triển khai; không đưa file `.env` hoặc thông tin đăng nhập lên Git.

## Endpoint chính

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/dashboard`
- `GET|POST /api/employees`, `PATCH /api/employees/{id}`
- `GET|POST /api/attendance`
- `GET|POST /api/leaves`, `PATCH /api/leaves/{id}`
- `GET /api/activities`

Các endpoint nghiệp vụ yêu cầu bearer token từ endpoint đăng nhập. Sáu thẻ demo Oracle trên giao diện là phần giới thiệu kiến trúc; chính sách VPD, Data Redaction, Database Vault, TDE và RMAN cần được cấu hình riêng trên Oracle, chưa tự kích hoạt bởi ứng dụng này.



## Quay video demo SQL Injection ? form ??ng nh?p

Form ??ng nh?p v? API ch?nh `POST /api/auth/login` ???c d?ng cho c? hai tr?ng th?i. ??t `SQLI_DEMO_ENABLED=true` trong `backend/.env` r?i kh?i ??ng l?i backend ?? b?t ch? ?? c? ? c? l? h?ng; ch? ?? n?y ch? ch?p nh?n request t? localhost. C? th? ??ng nh?p b?nh th??ng b?ng t?i kho?n ??ng, ho?c nh?p payload `' OR '1'='1' -- ` v?o ? t?n ??ng nh?p v? m?t m?t kh?u b?t k? ?? minh h?a bypass.

Sau khi quay video, ??t `SQLI_DEMO_ENABLED=false` (ho?c x?a bi?n) v? kh?i ??ng l?i backend. C?ng endpoint s? quay v? truy v?n ORM c? bind variables v? x?c minh password hash. Ch? b?t ch? ?? d? b? l?i trong lab local; kh?ng ??a l?n m?y ch? c?ng khai.


## Bảng lương và migration Oracle

Bảng lương hiện đọc dữ liệu thật từ `HR_APP.EMPLOYEES`: `CARD_NUMBER` và `SALARY_AMOUNT`. Nhân viên mới có lương khởi điểm 10.000.000 VND; có thể cập nhật lương trên trang Bảng lương. Với schema Oracle đã có sẵn, kết nối SQL Developer bằng `HR_APP` vào PDB của ứng dụng, chạy `backend/oracle/06_payroll_employee_columns.sql` bằng F5 đúng một lần, rồi khởi động lại backend. Script gán mã thẻ `CARD-<mã nhân viên>` và mức 10.000.000 VND cho nhân viên hiện có.

## Demo Oracle Data Redaction

Trang **Bảng lương** đọc dữ liệu nhân viên thật từ `HR_APP.EMPLOYEES`. Script `backend/oracle/script.sql` tạo policy Data Redaction trên `CARD_NUMBER` và `SALARY_AMOUNT`; truy vấn từ kết nối `HR_APP` (bao gồm backend) sẽ được che mã thẻ và trả lương dạng `0`. Data Redaction che dữ liệu tại thời điểm truy vấn, không sửa giá trị lưu trong bảng.

1. Trong SQL Developer, mở worksheet của kết nối `SYS` với Role `SYSDBA` ở PDB `FREEPDB1` và chạy `backend/oracle/capquyen.sql` bằng **F5**.
2. Mở worksheet kết nối `HR_APP` ở cùng PDB và chạy `backend/oracle/script.sql` bằng **F5**.
3. Tải lại trang **Bảng lương** để xem giá trị đã che.
4. Để gỡ policy trong lúc kiểm tra, chạy `backend/oracle/goquyen.sql` bằng kết nối `HR_APP`.

Oracle yêu cầu quyền `EXECUTE` trên `DBMS_REDACT` và quyền quản trị policy để tạo redaction. Xem [Oracle Data Redaction Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbred/what-is-oracle-data-redaction.html) và [DBMS_REDACT privileges](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbred/DBMS_REDACT.html).

## Demo Oracle VPD theo phòng ban

VPD lọc dòng dữ liệu ở Oracle theo phòng ban của tài khoản Smart HR. Tài khoản `admin` xem toàn bộ; bốn tài khoản `hr`, `finance`, `tech`, `marketing` chỉ xem nhân viên, chấm công và đơn nghỉ thuộc phòng ban tương ứng. Các tài khoản phòng ban chỉ có quyền xem; thao tác thêm, sửa, xóa vẫn dành cho admin.

1. Đặt `DEMO_DEPARTMENT_PASSWORD` trong `backend/.env` thành mật khẩu demo bạn muốn dùng. Bốn tài khoản phòng ban dùng chung mật khẩu này. Bản local hiện đặt `SmartHR-VPD@2026`; đổi giá trị này nếu muốn. Đặt `VPD_ENABLED=false` trong lúc cài đặt.
2. Kết nối SQL Developer bằng `HR_APP` tới `FREEPDB1`, chạy `backend/oracle/07_vpd_user_department.sql` bằng **F5** để thêm cột phòng ban cho tài khoản.
3. Khởi động backend một lần. Backend tạo bốn tài khoản demo nếu chúng chưa tồn tại. Dừng backend sau khi thấy `Application startup complete`.
4. Kết nối SQL Developer bằng `SYS` với Role `SYSDBA` trong `FREEPDB1`, chạy `backend/oracle/capquyen_vpd.sql` bằng **F5**.
5. Kết nối `HR_APP` trong cùng PDB, chạy `backend/oracle/08_vpd_department_policy.sql` bằng **F5**.
6. Đổi `VPD_ENABLED=true` trong `backend/.env`, khởi động lại backend và đăng nhập web bằng `hr`, `finance`, `tech` hoặc `marketing`. Admin vẫn đăng nhập bằng tài khoản `admin` hiện có.

Để demo, mở cùng trang **Nhân viên** hoặc **Chấm công** bằng admin rồi bằng từng tài khoản phòng ban. VPD tự lọc các dòng ở tầng Oracle; tài khoản phòng ban không thể xem các dòng phòng khác. Vì backend dùng pool kết nối, mỗi request gắn context sau khi xác thực và xóa context trước khi trả kết nối về pool.

Khi trình diễn VPD, đặt `SQLI_DEMO_ENABLED=false`. VPD lọc dữ liệu theo tài khoản mà backend đã xác thực; chế độ SQLi cố ý làm yếu đăng nhập và có thể khiến ứng dụng cấp nhầm danh tính.

Để tắt VPD, đặt `VPD_ENABLED=false` rồi khởi động lại backend. Có thể gỡ riêng các policy bằng `backend/oracle/09_vpd_remove_policies.sql` trên kết nối `HR_APP`; script này không đụng tới policy Data Redaction trong `goquyen.sql`. Tài khoản demo vẫn còn trong bảng `USERS`.
