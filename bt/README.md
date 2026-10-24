# Smart HR

Ứng dụng quản lý nhân sự có frontend và backend tách riêng.

## Frontend

Mở terminal:

```powershell
cd frontend
python -m http.server 5500
cd backend
python -m uvicorn app.main:app --reload

Mở `http://127.0.0.1:5500`. Frontend gọi API tại `http://127.0.0.1:8000/api`; có thể đổi địa chỉ bằng `window.SMART_HR_API` trong `frontend/app.js`.

## Backend

Xem [backend/README.md](backend/README.md) để cài dependencies và chạy FastAPI. Backend kết nối trực tiếp Oracle theo `backend/.env`, rồi tạo bảng trong schema `HR_APP`. Tài khoản web khởi tạo là `admin` / `Admin@123`, trừ khi bạn đã đặt `ADMIN_PASSWORD` khác trước lần khởi tạo đầu tiên.

Chức năng hiện có: đăng nhập, dashboard, tìm kiếm và thêm nhân viên, ghi nhận chấm công, tạo và duyệt đơn nghỉ phép, xem hoạt động. Các demo bảo mật Oracle cần cấu hình policy riêng trong database trước khi trình diễn.
