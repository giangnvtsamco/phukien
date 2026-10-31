# Lắp đặt phụ kiện · SAMCO Bình Tân

Web app quản lý ra vào và thu phí của đơn vị lắp đặt phụ kiện.
Địa chỉ: https://phukien.vinfastsamcobinhtan.com

## Kiến trúc

Giao diện `index.html` (GitHub Pages) → Apps Script `Code.gs` (API, link `/exec`) → Google Sheet.

| File | Vai trò |
| --- | --- |
| `index.html` | Toàn bộ giao diện. Dòng `API_URL` chứa link `/exec` của Apps Script. |
| `Code.gs` | Bản lưu của code Apps Script (dán vào trình chỉnh sửa Apps Script, không chạy trên GitHub). |
| `CNAME` | Tên miền `phukien.vinfastsamcobinhtan.com`. |
| `logo.png`, `favicon.*`, `apple-touch-icon.png` | Nhận diện SAMCO (giống app KSCL). |

## Google Sheet

| Sheet | Nội dung |
| --- | --- |
| `DANG_KY` | Mỗi phiếu 1 dòng. Cột A = ID `PK-YYYYMMDD-NNN`. 3 cột cuối: Tạo lúc / Người tạo / Cập nhật lúc. |
| `_DanhMuc` | Loại xe, Màu, Phụ kiện, Sale phụ trách, đơn vị lắp đặt (Mã ĐV, Tên, Mã đăng nhập 6 số). |
| `_CauHinh` | PHI_MOI_PHU_KIEN, PIN_QUAN_LY, PIN_BAO_VE, NHAC_TRUOC_PHUT. |
| `BC_YYYY-MM` | Báo cáo tháng, tạo khi bấm "Xuất ra Sheet". |

## Quy định trong app

- Đơn vị vào bằng mã 6 số, chỉ thấy phiếu của mình.
- Phí = số phụ kiện × PHI_MOI_PHU_KIEN, thu tiền mặt.
- Đăng ký trước 30 phút: chỉ nhắc, không chặn.
- Sale phụ trách bắt buộc, chọn từ `_DanhMuc`.
- Sai mã / PIN 5 lần trên 1 trình duyệt → khóa trình duyệt đó 15 phút; toàn hệ thống sai 30 lần trong 10 phút → tạm khóa đăng nhập 15 phút.

## Phiên bản

- **v1.0** (31/10/2026): bản đầu theo quy chuẩn web app SAMCO. Mã đơn vị 6 số tách khỏi Mã ĐV nội bộ; phí tính theo từng phụ kiện; bàn phím số trên điện thoại; chế độ Sáng / Tối / Tự động; chống dò mã; chống chèn công thức vào Sheet.
