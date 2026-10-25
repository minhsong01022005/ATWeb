# Demo RMAN với Smart HR (Oracle AI Database 26ai Free)

Kịch bản: backup full -> "sự cố" xóa nhầm toàn bộ nhân viên trên web -> RMAN khôi phục PDB `FREEPDB1` về thời điểm trước sự cố -> tải lại web, dữ liệu quay lại.

Môi trường: CDB `FREE`, PDB `FREEPDB1`, schema `HR_APP`. Chạy mọi lệnh trong PowerShell **Run as Administrator**.

## 0. Chuẩn bị (làm một lần, trước buổi demo)

```powershell
mkdir D:\rman_backup
$env:ORACLE_SID = "FREE"        # nếu chưa có biến này
sqlplus / as sysdba
```

Trong SQL*Plus (CDB$ROOT), bật ARCHIVELOG và trỏ vùng backup:

```sql
ALTER SYSTEM SET db_recovery_file_dest_size = 20G SCOPE=BOTH;
ALTER SYSTEM SET db_recovery_file_dest = 'D:\rman_backup' SCOPE=BOTH;
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;
ALTER PLUGGABLE DATABASE ALL OPEN;
ARCHIVE LOG LIST;               -- phải thấy "Archive Mode"
SELECT name, open_mode FROM v$pdbs;
```

> Nếu `db_recovery_file_dest` đã có sẵn (mặc định Oracle Free tự đặt) thì bỏ qua 2 lệnh `ALTER SYSTEM` đầu và dùng luôn.

## 1. Backup full (trình diễn trước khán giả)

```powershell
rman target /
```

```
CONFIGURE CONTROLFILE AUTOBACKUP ON;
CONFIGURE RETENTION POLICY TO REDUNDANCY 2;
SHOW ALL;

BACKUP DATABASE PLUS ARCHIVELOG;
LIST BACKUP SUMMARY;
```

Giải thích: `BACKUP DATABASE` sao lưu CDB + mọi PDB (có `FREEPDB1` chứa `HR_APP`), `PLUS ARCHIVELOG` kèm redo đã archive để recover được.

## 2. Ghi lại mốc thời gian an toàn

Mở web (đăng nhập `admin`), cho khán giả thấy **Tổng nhân viên = 12**. Rồi:

```sql
-- sqlplus / as sysdba (hoặc SQL Developer, kết nối SYS)
ALTER SYSTEM ARCHIVE LOG CURRENT;
SELECT current_scn, TO_CHAR(SYSDATE,'YYYY-MM-DD HH24:MI:SS') AS thoi_diem FROM v$database;
```

**Ghi lại `CURRENT_SCN`** (ví dụ `1234567`) - dùng ở bước 4.

## 3. Giả lập sự cố

Kết nối `HR_APP` tới `FREEPDB1` (SQL Developer):

```sql
DELETE FROM hr_app.leave_requests;  -- bảng con (FK -> employees) phải xóa trước
DELETE FROM hr_app.attendance;
DELETE FROM hr_app.employees;
COMMIT;
```

> Tên bảng lấy từ `backend/app/models.py`. Giữ nguyên `users` để vẫn đăng nhập web được.

Tải lại web: **Tổng nhân viên = 0**, danh sách nhân viên trống. Đây là "dữ liệu bị mất".

## 4. Khôi phục bằng RMAN (PDB point-in-time recovery)

Dừng backend FastAPI (Ctrl+C) và **Disconnect** các kết nối `HR_APP`, `SYS_FREEPDB1` trong SQL Developer (chuột phải vào kết nối ở panel Connections) để đóng session tới PDB, rồi:

```powershell
rman target /
```

```
ALTER PLUGGABLE DATABASE FREEPDB1 CLOSE IMMEDIATE;

RUN {
  SET UNTIL SCN <SCN-da-ghi>;     # thay bằng SCN đã ghi ở bước 2
  RESTORE PLUGGABLE DATABASE FREEPDB1;
  RECOVER PLUGGABLE DATABASE FREEPDB1;
  ALTER PLUGGABLE DATABASE FREEPDB1 OPEN RESETLOGS;
}
```

Kiểm tra:

```sql
SELECT name, open_mode FROM v$pdbs;      -- FREEPDB1 READ WRITE
SELECT COUNT(*) FROM hr_app.employees;   -- 12
```

Khởi động lại backend (`python -m uvicorn app.main:app --reload`), tải lại web: **Tổng nhân viên = 12**.

Sau khi khôi phục, chạy ngay một bản backup mới (PITR với `OPEN RESETLOGS` đã tạo incarnation mới cho PDB):

```
BACKUP DATABASE PLUS ARCHIVELOG;
```

## 4b. Chạy lại demo (các lần sau)

ARCHIVELOG và `CONFIGURE` đã lưu trong DB nên **không làm lại bước 0 và 1**. Chỉ cần:

**Trước buổi demo** (nếu chưa có backup mới sau lần PITR trước):

```
rman target /
BACKUP DATABASE PLUS ARCHIVELOG;
```

**Lúc demo:**

1. Bật backend (`python -m uvicorn app.main:app --reload`), đăng nhập `admin`, cho khán giả thấy **12 nhân viên**.
2. Ghi mốc SCN mới (SCN mỗi lần một khác, phải lớn hơn thời điểm backup gần nhất):
   ```sql
   -- sqlplus / as sysdba
   ALTER SYSTEM ARCHIVE LOG CURRENT;
   SELECT current_scn FROM v$database;
   ```
3. Gây sự cố (kết nối `HR_APP`, SQL Developer):
   ```sql
   DELETE FROM hr_app.leave_requests;
   DELETE FROM hr_app.attendance;
   DELETE FROM hr_app.employees;
   COMMIT;
   ```
   Tải lại web: **0 nhân viên**.
4. Dừng backend (Ctrl+C), **Disconnect** `HR_APP` và `SYS_FREEPDB1` trong SQL Developer.
5. Khôi phục:
   ```
   rman target /
   ALTER PLUGGABLE DATABASE FREEPDB1 CLOSE IMMEDIATE;
   RUN {
     SET UNTIL SCN <SCN-moi>;
     RESTORE PLUGGABLE DATABASE FREEPDB1;
     RECOVER PLUGGABLE DATABASE FREEPDB1;
     ALTER PLUGGABLE DATABASE FREEPDB1 OPEN RESETLOGS;
   }
   ```
6. Kiểm tra: `SELECT COUNT(*) FROM hr_app.employees;` ra 12, bật lại backend, tải lại web thấy **12 nhân viên**.
7. **Sau buổi demo:** chạy `BACKUP DATABASE PLUS ARCHIVELOG;` để buổi sau có backup sẵn.

> Dùng `SET UNTIL TIME "TO_DATE('2026-10-14 00:14:18','YYYY-MM-DD HH24:MI:SS')"` thay cho SCN cũng được, nhưng SCN chính xác hơn.

## 5. Phương án B: mất datafile (ấn tượng hơn, nhưng rủi ro hơn)

Chỉ dùng nếu muốn demo "hỏng file vật lý":

```sql
SELECT file_name FROM cdb_data_files WHERE con_id = (SELECT con_id FROM v$pdbs WHERE name='FREEPDB1');
ALTER PLUGGABLE DATABASE FREEPDB1 CLOSE IMMEDIATE;
```

Xóa datafile `USERS` của PDB bằng Explorer, rồi trong RMAN:

```
RESTORE PLUGGABLE DATABASE FREEPDB1;
RECOVER PLUGGABLE DATABASE FREEPDB1;
ALTER PLUGGABLE DATABASE FREEPDB1 OPEN;
```

Phương án này recover tới thời điểm hiện tại (không mất giao dịch nào), khác với PITR ở bước 4 (quay về quá khứ).

## 6. Lệnh minh họa thêm (nếu còn thời gian)

```
LIST BACKUP SUMMARY;
LIST ARCHIVELOG ALL;
REPORT SCHEMA;
VALIDATE DATABASE;
BACKUP INCREMENTAL LEVEL 0 DATABASE;
BACKUP INCREMENTAL LEVEL 1 DATABASE;
REPORT OBSOLETE;
DELETE OBSOLETE;
```

## Lưu ý

- **Chạy thử toàn bộ một lần trước khi quay/trình bày**; PITR đổi incarnation của PDB nên muốn làm lại kịch bản thì phải backup mới (xem mục 4b).
- Sau PITR, nên chạy `BACKUP DATABASE PLUS ARCHIVELOG;` mới để có bản sao lưu cho incarnation mới.
- Oracle Free có giới hạn tài nguyên (2 CPU, 2 GB RAM, 12 GB dữ liệu) nhưng RMAN và ARCHIVELOG vẫn dùng được.
- Nên tắt `VPD_ENABLED` và `SQLI_DEMO_ENABLED` khi demo RMAN để tránh nhiễu kết quả.

## 7. Sao lưu tự động hàng tuần

Các file trong thư mục `backup/`:

- `weekly.rman`: Level 0 + archivelog, xóa bản cũ quá 28 ngày, liệt kê kết quả.
- `weekly.bat`: gọi RMAN và ghi log vào `backup/logs/`.
- `register_task.ps1`: đăng ký Task Scheduler "RMAN Weekly Backup" (Chủ nhật 02:00, chạy bù nếu máy tắt).

Cài đặt (PowerShell **Run as Administrator**):

```powershell
.\backend\oracle\backup\register_task.ps1
Start-ScheduledTask -TaskName "RMAN Weekly Backup"   # chạy thử ngay
```

Kiểm tra: xem log mới nhất trong `backup/logs/` và chạy `LIST BACKUP SUMMARY;` trong RMAN. Đổi giờ/ngày bằng cách sửa `-DaysOfWeek` và `-At` trong `register_task.ps1`. Tài khoản chạy task cần thuộc nhóm `ORA_DBA`.

### 7.1 Sửa cấu hình để lịch không bị bỏ lỡ (làm một lần)

`register_task.ps1` mặc định chặn chạy khi máy dùng pin và không đánh thức máy. Nếu máy là laptop, lần 02:00 có thể bị bỏ qua. Chạy PowerShell **Run as Administrator**:

```powershell
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Set-ScheduledTask -TaskName "RMAN Weekly Backup" -Settings $s
```

Cần cắm sạc và để máy sleep (không shutdown) vào đêm Chủ nhật, và tài khoản `Admin` phải đang đăng nhập.

### 7.2 Chứng minh sao lưu tự động hoạt động

Chạy mọi lệnh PowerShell dưới đây trong PowerShell **Run as Administrator**.

**a) Bật lịch sử Task Scheduler (trước khi chạy)**

Tab History trong `taskschd.msc` trống nếu lịch sử đang tắt, và chỉ ghi các lần chạy sau khi bật.

```powershell
wevtutil set-log Microsoft-Windows-TaskScheduler/Operational /enabled:true
```

Hoặc mở `taskschd.msc` (Windows + R), ở khung Actions chọn **Enable All Tasks History**.

**b) Chứng minh lịch hằng tuần**

```powershell
Get-ScheduledTask "RMAN Weekly Backup" | Get-ScheduledTaskInfo | Format-List TaskName, LastRunTime, LastTaskResult, NextRunTime
(Get-ScheduledTask "RMAN Weekly Backup").Triggers | Format-List StartBoundary, DaysOfWeek
```

`NextRunTime` phải là một Chủ nhật lúc 02:00. Trong `taskschd.msc`: Task Scheduler Library -> **RMAN Weekly Backup** -> các tab *Triggers*, *Actions*, *Settings*.

**c) Chứng minh task tự chạy được**

Cách A (nhanh): chạy ngay bằng Task Scheduler.

```powershell
Start-ScheduledTask "RMAN Weekly Backup"
Get-ScheduledTask "RMAN Weekly Backup" | Get-ScheduledTaskInfo | Format-List State, LastRunTime, LastTaskResult
```

Khi đang chạy `State` là `Running`, xong là `Ready` và `LastTaskResult = 0` (mất vài phút). Có thêm một file log mới trong `backup/logs/`, và tab *History* (bấm F5) có các sự kiện *Task Started* -> *Task completed*.

Cách B (chứng minh đúng giờ): thêm trigger thử 3 phút sau.

```powershell
$task = Get-ScheduledTask "RMAN Weekly Backup"
$test = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(3)
Set-ScheduledTask "RMAN Weekly Backup" -Trigger ($task.Triggers + $test)
```

Đến giờ task tự chạy mà không ai bấm. Demo xong, đăng ký lại để bỏ trigger thử, rồi chạy lại mục 7.1:

```powershell
cd D:\BTL\ATWeb\bt\backend\oracle\backup
.\register_task.ps1
```

**d) Chứng minh bản backup dùng được**

```
set ORACLE_SID=FREE
rman target /
LIST BACKUP SUMMARY;
RESTORE DATABASE VALIDATE;
```

`LIST BACKUP SUMMARY` cho thấy bản backup mới nhất khớp thời điểm chạy. `RESTORE DATABASE VALIDATE` chỉ kiểm tra, không ghi đè dữ liệu.

**Thứ tự gợi ý khi trình bày:** mở `taskschd.msc` chỉ *Triggers* và *Settings* -> chạy cách A -> mở thư mục `logs` và tab *History* -> `LIST BACKUP SUMMARY` -> (nếu còn thời gian) demo khôi phục ở mục 4.
