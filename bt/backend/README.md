

## Quay video demo SQL Injection ? form ??ng nh?p

Form ??ng nh?p v? API ch?nh `POST /api/auth/login` ???c d?ng cho c? hai tr?ng th?i. ??t `SQLI_DEMO_ENABLED=true` trong `backend/.env` r?i kh?i ??ng l?i backend ?? b?t ch? ?? c? ? c? l? h?ng; ch? ?? n?y ch? ch?p nh?n request t? localhost. C? th? ??ng nh?p b?nh th??ng b?ng t?i kho?n ??ng, ho?c nh?p payload `' OR '1'='1' -- ` v?o ? t?n ??ng nh?p v? m?t m?t kh?u b?t k? ?? minh h?a bypass.

Sau khi quay video, ??t `SQLI_DEMO_ENABLED=false` (ho?c x?a bi?n) v? kh?i ??ng l?i backend. C?ng endpoint s? quay v? truy v?n ORM c? bind variables v? x?c minh password hash. Ch? b?t ch? ?? d? b? l?i trong lab local; kh?ng ??a l?n m?y ch? c?ng khai.


## Demo Oracle Data Redaction

1. Trong SQL Developer, mở worksheet của kết nối `SYS` với Role `SYSDBA` ở PDB `FREEPDB1` và chạy `backend/oracle/capquyen.sql` bằng **F5**.
2. Mở worksheet kết nối `HR_APP` ở cùng PDB và chạy `script.sql` bằng **F5**.
3. Tải lại trang **Bảng lương** để xem giá trị đã che.
4. Để gỡ policy trong lúc kiểm tra, chạy `goquyen.sql` bằng kết nối `HR_APP`.


## Demo Oracle VPD theo phòng ban

1. Đặt `DEMO_DEPARTMENT_PASSWORD` trong `backend/.env` thành mật khẩu demo bạn muốn dùng. Bốn tài khoản phòng ban dùng chung mật khẩu này. Bản local hiện đặt `SmartHR-VPD@2026`; đổi giá trị này nếu muốn. Đặt `VPD_ENABLED=false` trong lúc cài đặt.
2. Kết nối SQL Developer bằng `HR_APP` tới `FREEPDB1`, chạy `backend/oracle/07_vpd_user_department.sql` bằng **F5** để thêm cột phòng ban cho tài khoản.
3. Khởi động backend một lần. Backend tạo bốn tài khoản demo nếu chúng chưa tồn tại. Dừng backend sau khi thấy `Application startup complete`.
4. Kết nối SQL Developer bằng `SYS` với Role `SYSDBA` trong `FREEPDB1`, chạy `backend/oracle/capquyen_vpd.sql` bằng **F5**.
5. Kết nối `HR_APP` trong cùng PDB, chạy `backend/oracle/08_vpd_department_policy.sql` bằng **F5**.
6. Đổi `VPD_ENABLED=true` trong `backend/.env`, khởi động lại backend và đăng nhập web bằng `hr`, `finance`, `tech` hoặc `marketing`. Admin vẫn đăng nhập bằng tài khoản `admin` hiện có.

## rman

1. Lịch tự động (1 phút): mở taskschd.msc, chọn RMAN Weekly Backup, chỉ vào Triggers (Chủ nhật 02:00) và Actions.

3. Ghi mốc (1 phút): web hiện 12 nhân viên. :
sqlplus / as sysdba
ALTER SYSTEM ARCHIVE LOG CURRENT;
SELECT current_scn FROM v$database;

4. Gây sự cố (1 phút): xóa vài nhân viên trên web
5. Khôi phục (3 phút): Ctrl+C dừng backend, ngắt các kết nối HR_APP và SYS_FREEPDB1 trong SQL Developer, rồi:

rman target /
ALTER PLUGGABLE DATABASE FREEPDB1 CLOSE IMMEDIATE;
RUN {
  SET UNTIL SCN <SCN-da-ghi>;
  RESTORE PLUGGABLE DATABASE FREEPDB1;
  RECOVER PLUGGABLE DATABASE FREEPDB1;
  ALTER PLUGGABLE DATABASE FREEPDB1 OPEN RESETLOGS;
}



2. Chạy task (2 phút):
Start-ScheduledTask "RMAN Weekly Backup"