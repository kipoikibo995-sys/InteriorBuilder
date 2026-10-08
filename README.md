# InteriorBuilder

Công cụ tạo **ruột sách và bìa low-content** (notebook, journal, planner, log book…) chuẩn **Amazon KDP**, chạy ngay trong trình duyệt. Không cần cài đặt, không cần internet, không gửi dữ liệu đi đâu.

## Cách dùng

1. Tải repo về và mở file `index.html` bằng Chrome, Edge hoặc Firefox.
   Hoặc chạy máy chủ tĩnh: `python3 -m http.server 8000` rồi mở <http://localhost:8000>.
2. Tab **Ruột sách**: chọn khổ sách, số trang, mẫu trang → xem trước → **Tải PDF ruột sách**.
3. Tab **Bìa sách**: nhập tiêu đề, màu sắc, ảnh (tuỳ chọn) → tắt đường hướng dẫn → **Tải PDF bìa**.
4. Tải hai file PDF lên KDP (Paperback → đánh dấu *Low-content book*).

## Tính năng

- **16 khổ sách KDP** (5x8, 6x9, 8.5x11, A4, khổ vuông, khổ ngang…), tuỳ chọn bleed.
- **Tự tính lề gáy** theo số trang, đúng quy định KDP; báo lỗi khi sai số trang hoặc lề.
- **16 mẫu trang**: trắng, kẻ dòng (wide/college/narrow), chấm bi, ô vuông, luyện viết, khuông nhạc, sổ vẽ, nhật ký biết ơn, kế hoạch ngày, kế hoạch tuần, theo dõi thói quen, log book tuỳ biến cột (mileage, visitor, budget, workout…), sổ mật khẩu, công thức nấu ăn, to-do, ghi chép Cornell.
- Trang "This book belongs to", chế độ chỉ in mặt phải, đánh số trang.
- Tuỳ chỉnh màu nét, độ dày, phông chữ (hỗ trợ tải phông `.ttf` để in **tiếng Việt có dấu**).
- **Máy tính bìa**: độ dày gáy theo loại giấy, kích thước bìa và kích thước ảnh 300 dpi.
- **Tạo bìa**: màu nền, tiêu đề, phụ đề, chữ gáy (khi trên 79 trang), ảnh mặt trước, đường hướng dẫn vùng an toàn và vùng mã vạch.
- PDF dạng vector, file nhẹ (sách 300 trang chấm bi khoảng 2 MB).

## Cấu trúc mã nguồn

| File | Vai trò |
|---|---|
| `js/kdp.js` | Thông số KDP: khổ sách, lề, độ dày giấy, kiểm tra hợp lệ |
| `js/painter.js` | Lớp vẽ chung cho canvas (xem trước) và jsPDF (xuất file) |
| `js/templates.js` | Các mẫu trang. Thêm mẫu mới: thêm một mục `T.push({...})` |
| `js/book.js` | Dựng từng trang, dựng bìa, xuất PDF (không phụ thuộc DOM) |
| `js/app.js` | Giao diện |
| `vendor/jspdf.umd.min.js` | Thư viện jsPDF 2.5.2 (MIT) |

## Kiểm thử

```bash
node test/build-all.js            # dựng PDF cho mọi mẫu và kiểm tra kích thước, số trang
node test/build-all.js out/       # ...và lưu các PDF mẫu vào out/
```
