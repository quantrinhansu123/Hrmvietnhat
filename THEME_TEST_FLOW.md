# Luồng kiểm thử giao diện theme đỏ

## 1. Khởi động

```bash
npm ci
npm run dev
```

Mở `http://localhost:5173`.

## 2. Kiểm tra đăng nhập và đăng xuất

Tài khoản seed dùng để kiểm thử:

- Email: `admin@company.local`
- Mật khẩu: `123456`

Thực hiện:

1. Khi chưa đăng nhập, mở thẳng `/dashboard`.
2. Xác nhận hệ thống tự chuyển về `/login`.
3. Nhập tài khoản admin và chọn **Đăng nhập**.
4. Xác nhận hệ thống chuyển tới `/dashboard` và header hiển thị đúng tên người dùng.
5. Chọn khu vực avatar ở góc phải, sau đó chọn **Đăng xuất**.
6. Xác nhận phiên đăng nhập bị xóa và hệ thống quay lại `/login`.
7. Nhấn nút Back hoặc mở lại `/dashboard`; hệ thống vẫn phải yêu cầu đăng nhập.

> `123456` chỉ là mật khẩu seed phục vụ thiết lập ban đầu. Phải đổi mật khẩu trước khi dùng môi trường thật.

## 3. Kiểm tra khung giao diện chung

Thực hiện trên màn hình desktop từ 1366 px trở lên:

1. Mở `/dashboard`.
2. Kiểm tra header nền trắng, logo Việt Nhật bên trái, chuông và avatar đỏ bên phải.
3. Kiểm tra sidebar nền trắng, mục đang chọn có nền đỏ và chữ trắng.
4. Di chuột qua từng mục sidebar: nền chuyển đỏ nhạt, chữ/icon chuyển đỏ.
5. Chuyển qua từng trang và xác nhận sidebar luôn đánh dấu đúng mục đang mở.

Kết quả mong đợi:

- Nền nội dung xám rất nhạt, card màu trắng và có viền mảnh.
- Nút chính, nút xuất/nhập dữ liệu, icon trang trí, tab active, focus input và loading spinner dùng màu đỏ.
- Không còn màu xanh hoặc tím dùng làm màu trang trí.
- Xanh lá và vàng/cam chỉ xuất hiện ở trạng thái thành công hoặc cảnh báo.

## 4. Kiểm tra từng module

| Bước | Đường dẫn | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | `/dashboard` | Quan sát vòng menu trong ít nhất 30 giây, sau đó chọn một chức năng | 8 card/icon lớn dùng các sắc đỏ, tận dụng gần trọn vùng nội dung; vòng menu đứng yên hoàn toàn; không cắt nội dung |
| 2 | `/employees` | Dùng bộ lọc, chuyển tab, mở form thêm/sửa | Card, tab, nút và focus input theo theme đỏ; modal hiển thị đầy đủ |
| 3 | `/recruitment` | Chuyển các tab và mở form tuyển dụng | Nút chính màu đỏ; vùng thông tin dùng nền đỏ nhạt |
| 4 | `/salary` | Chuyển các bảng lương, mở chi tiết | Header bảng trung tính; nút thao tác chính màu đỏ; trạng thái vẫn dễ phân biệt |
| 5 | `/competency` | Mở khung năng lực và form đánh giá | Icon/nút chủ đạo màu đỏ; form không còn màu trang trí xanh/tím |
| 6 | `/kpi` | Chuyển tab KPI, mở chi tiết hoặc import | Tab active, nút và khối thông tin dùng đỏ/đỏ nhạt |
| 7 | `/tasks` | Mở danh sách và modal công việc | Nút, focus, khối hướng dẫn theo theme đỏ |
| 8 | `/approvals` | Chuyển danh sách, mở chi tiết đề xuất | Bố cục giữ nguyên; pending/approved/rejected vẫn có màu ngữ nghĩa rõ ràng |
| 9 | `/attendance` | Chuyển tab, mở import chấm công | Nút chính và liên kết theo theme đỏ; cảnh báo vẫn dùng vàng/cam |

## 5. Kiểm tra responsive

Mở DevTools, bật chế độ thiết bị và thử hai kích thước:

- `390 × 844`
- `500 × 932`

Thực hiện:

1. Mở `/dashboard`: menu điều hướng chuyển thành hàng ngang có thể cuộn; vòng chức năng nằm trọn trong card.
2. Mở `/employees`: header không tràn; bộ lọc xếp cột; bảng có thể cuộn ngang.
3. Mở `/approvals`: sidebar desktop được ẩn theo bố cục riêng của trang; nội dung không tạo thanh cuộn ngang toàn trang.
4. Cuộn trang và xác nhận header/menu vẫn dễ truy cập.

## 6. Kiểm tra build

```bash
npm run build
```

Kết quả mong đợi: Vite build thành công, không có lỗi biên dịch.
