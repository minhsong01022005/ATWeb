# Thuyết trình: Sao lưu và khôi phục dữ liệu bằng Oracle RMAN

Mỗi slide gồm **nội dung trên slide** (ngắn, để dán vào PowerPoint) và **lời nói** (đọc hoặc nói theo ý). Tổng thời gian khoảng 6 đến 7 phút.

---

## Slide 1: Vì sao cần sao lưu? (30 giây)

**Trên slide**
- Dữ liệu nhân viên là tài sản quan trọng của hệ thống
- Rủi ro: xóa nhầm, hỏng đĩa, bị tấn công
- Mục tiêu: sao lưu tự động + khôi phục về đúng thời điểm trước sự cố

**Lời nói**
"Hệ thống quản lý nhân viên của nhóm em lưu dữ liệu trong Oracle. Nếu ai đó xóa nhầm, ổ đĩa hỏng hoặc bị tấn công thì dữ liệu có thể mất. Vì vậy nhóm em làm hai việc: sao lưu tự động định kỳ, và chứng minh được rằng có thể khôi phục dữ liệu về đúng thời điểm trước sự cố."

---

## Slide 2: Giải pháp RMAN + ARCHIVELOG (1 phút)

**Trên slide**
- RMAN: công cụ sao lưu/khôi phục chính thức của Oracle
- ARCHIVELOG: lưu lại mọi thay đổi (redo log)
- Nhờ đó khôi phục được về thời điểm bất kỳ (PITR), không chỉ về lúc backup
- Nơi lưu backup: `D:\RMAN_BACKUP`

**Lời nói**
"RMAN là công cụ sao lưu chuẩn của Oracle. Để dùng được, database phải bật chế độ ARCHIVELOG. Chế độ này giữ lại mọi thay đổi sau lần backup, nên ta khôi phục được về một thời điểm bất kỳ chứ không chỉ về đúng lúc backup. Nếu thiếu ARCHIVELOG thì RMAN từ chối sao lưu khi database đang mở, và nhóm em đã gặp đúng lỗi này khi cấu hình."

---

## Slide 3: Sao lưu tự động hàng tuần (1,5 phút)

**Trên slide**
- `weekly.rman`: backup Level 0 + archivelog + control file
- Task Scheduler: chạy 2:00 sáng Chủ nhật, chạy bù nếu máy tắt
- Giữ 28 ngày, backup cũ tự bị xóa
- Ghi log mỗi lần chạy

**Lời nói**
"Việc sao lưu gồm ba phần. Thứ nhất là file lệnh RMAN, thực hiện backup Level 0 tức là toàn bộ database, kèm archivelog và control file. Thứ hai là Windows Task Scheduler, đặt lịch chạy lúc 2 giờ sáng Chủ nhật hằng tuần, và tự chạy bù nếu máy tắt đúng giờ đó. Thứ ba là chính sách giữ 28 ngày: backup cũ hơn sẽ tự bị xóa để không đầy ổ đĩa. Mỗi lần chạy đều ghi log để kiểm tra."

**Thao tác:** mở file log `logs\weekly_20261021_1724.log`, chỉ vào dòng `Finished backup` và bảng `LIST BACKUP SUMMARY` có 6 bản ở trạng thái `A` (available).

---

## Slide 4: Demo khôi phục (2 đến 3 phút)

**Trên slide**
1. Web hiển thị danh sách nhân viên
2. Sự cố: xóa toàn bộ nhân viên
3. RMAN khôi phục PDB `FREEPDB1` về thời điểm trước sự cố
4. Tải lại web: dữ liệu quay lại

**Lời nói**
"Bây giờ em demo. Đây là danh sách nhân viên trên web. Em giả lập sự cố bằng cách xóa toàn bộ nhân viên, tải lại thì danh sách trống. Em dùng RMAN khôi phục PDB FREEPDB1 về thời điểm ngay trước sự cố. Sau khi khôi phục xong, em tải lại web và dữ liệu đã quay trở lại."

**Thao tác:** làm theo [RMAN_DEMO.md](../RMAN_DEMO.md) mục 4 và 4b. Ghi SCN trước khi gây sự cố. Chạy thử toàn bộ kịch bản một lần trước buổi trình bày.

---

## Slide 5: Kết luận và hướng phát triển (30 giây)

**Trên slide**
- Đã tự động hóa sao lưu và chứng minh khôi phục được
- Hướng phát triển:
  - Backup Level 1 hằng ngày để tiết kiệm dung lượng
  - Copy backup sang ổ/máy khác
  - Gửi thông báo khi backup lỗi

**Lời nói**
"Tóm lại, nhóm em đã tự động hóa việc sao lưu và chứng minh được khả năng khôi phục. Hiện backup nằm cùng máy nên nhóm em đề xuất copy sang nơi khác, thêm backup tăng dần hằng ngày và cảnh báo khi backup lỗi. Em xin cảm ơn."

---

## Câu hỏi có thể gặp

- **Vì sao Level 0 mà không phải backup thường?** Level 0 là bản nền để sau này chạy các bản tăng dần (Level 1), vừa nhanh vừa tiết kiệm.
- **Backup cùng ổ `D:` có an toàn không?** Chưa hoàn toàn. Nếu hỏng cả ổ thì mất cả hai, nên cần copy ra nơi khác.
- **Khôi phục về thời điểm nào được?** Thời điểm bất kỳ trong phạm vi còn archivelog, chỉ định bằng SCN hoặc thời gian.
- **Backup có làm gián đoạn người dùng không?** Không, vì RMAN sao lưu khi database đang mở.
- **Nếu máy tắt đúng giờ backup thì sao?** Task Scheduler cấu hình `StartWhenAvailable` nên sẽ chạy bù khi máy bật lại.
- **Làm sao biết backup chạy thành công?** Xem log trong `logs\` và chạy `LIST BACKUP SUMMARY;` trong RMAN.
