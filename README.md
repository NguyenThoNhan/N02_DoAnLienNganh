| **Môn học**              | **Đồ án liên ngành**                                      |
|--------------------------|-----------------------------------------------------|
| **Nhóm**                 | **Nhóm 2**                           |
| **Giảng viên hướng dẫn** | **Nguyễn Thị Vân**                                  |

### **Thành viên Nhóm**

| **STT** | **Họ và Tên**          | **Mã Sinh Viên** |
|---------|------------------------|------------------|
| 1       | Nguyễn Thọ Nhân        | 23010786         |
| 2       | Phạm Anh Thái          | 23010784         |
| 3       | Nguyễn Xuân Chức       | 23010452         |

# Giới thiệu
## Hệ thống quản lý khám ngoại trú cho 3 actor: Bệnh nhân, Bác sĩ, Quản trị viên. Xây dựng theo kiến trúc RESTful API với Node.js & Python backend và vanilla HTML/CSS/JS frontend.

Yêu cầu môi trường

Node.js ≥ 18
MySQL ≥ 8.0
Python ≥ 3.8 (cho module AI)

Cài đặt và chạy
1. Cài thư viện
npm install

2. Tạo file môi trường
cp .env.example .env
Điền DB_PASSWORD, JWT_SECRET vào .env

3. Tạo database
Tạo schema hospital_db trong MySQL Workbench

4. Chạy migration
npm run migrate

5. Seed dữ liệu mẫu
npm run seed
6. Huấn luyện mô hình AI
python train_model.py

7. Khởi động server
npm run dev
Truy cập: http://localhost:5000

# Tính năng nổi bật

- Chống trùng lịch 2 tầng (application + UNIQUE constraint DB)
- Quy trình khám 6 bước với gợi ý thuốc thông minh
- AI cảnh báo sinh hiệu (Random Forest, train từ heart.csv)
- Thanh toán QR chuẩn VietQR
- Chống phình database: ảnh lưu tại /uploads/, DB chỉ lưu đường dẫn
- Kiểm thử tải k6: p95 < 300ms với 50 VU đồng thời
