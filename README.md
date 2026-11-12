# Lắp đặt phụ kiện · VinFast SAMCO Bình Tân

https://phukien.vinfastsamcobinhtan.com · bản **v1.0.2** (tạm ngưng dùng, giữ để dùng lại)

## Kiến trúc
Giao diện (GitHub Pages) → Apps Script (link `/exec` trong `config.js`) → Google Sheet + Drive.
Code Apps Script (`.gs`) **không** để ở repo này; bản lưu nằm ở repo riêng tư `samco-apps-script`.
App một file (`index.html`), không dùng samco-core.

## Đường dẫn
| Link | Ai dùng | Nội dung |
|---|---|---|
| `/` | Đơn vị lắp đặt | Vào bằng mã 6 số, đăng ký xe, chỉ thấy phiếu của mình |
| `/quanly` | Quản lý · Bảo vệ | Ra vào, thu phí, báo cáo tháng (chuyển về `/?page=admin`) |

## File
| File | Vai trò |
|---|---|
| `index.html` | Toàn bộ giao diện |
| `config.js` | Link `/exec` của Apps Script |
| `icon.svg`, `icon-180.png`, `favicon.ico`, `logo.png` | Nhận diện SAMCO |
| `quanly.html` | Trang chuyển hướng |
| `CNAME` | Tên miền |

## Google Sheet
`DANG_KY` (mỗi phiếu 1 dòng, ID `PK-YYYYMMDD-NNN`) · `_DanhMuc` (loại xe, màu, phụ kiện, sale, đơn vị) · `_CauHinh` (phí mỗi phụ kiện, PIN, phút nhắc) · `BC_YYYY-MM`

## Quy định
- Phí = số phụ kiện × phí mỗi phụ kiện, thu tiền mặt. Đăng ký trước 30 phút: chỉ nhắc.
- Sai mã 5 lần trên 1 trình duyệt → khóa 15 phút; toàn hệ thống sai 30 lần / 10 phút → tạm khóa đăng nhập 15 phút.

## Cập nhật
1. Sửa Apps Script → Lưu → Triển khai → Quản lý các bản triển khai → bút chì → **Phiên bản mới** → Triển khai. Link `/exec` giữ nguyên.
2. Tải file giao diện lên repo này (nhánh `main`). GitHub Pages cập nhật sau 1–2 phút.
3. Đổi link Apps Script: chỉ sửa `config.js`.

## Phiên bản
- v1.0.2: link Apps Script chuyển sang `config.js`; thêm đường dẫn `/quanly`.
- v1.0.1 (31/10/2026): link chuyển giữa trang Đơn vị và Quản lý.
- v1.0 (31/10/2026): bản đầu.
