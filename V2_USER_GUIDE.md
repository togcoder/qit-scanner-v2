# SỔ TAY HƯỚNG DẪN SỬ DỤNG HỆ THỐNG SCANNER V2

---

## 🚀 1. Khởi Động & Nạp Tệp Nhật Ký

1. Mở tệp `index.html` (hoặc tệp đóng gói `scanner-v2-standalone.html`) trên trình duyệt bất kỳ (Google Chrome, Microsoft Edge, Firefox).
2. Tại màn hình **NẠP DỮ LIỆU NHẬT KÝ**:
   - Kéo và thả 1 hoặc nhiều tệp nhật ký `.log`, `.txt`, `.csv` vào khung nạp.
   - Hoặc bấm vào khung để chọn tệp từ máy tính.
3. Bấm nút **TIẾN HÀNH XỬ LÝ DỮ LIỆU**. Hệ thống sẽ tự động nhận diện định dạng từng file và chuyển sang màn hình chính.

---

## ⚡ 2. Hướng Dẫn Các Không Gian Làm Việc Chính (5 Core Workspaces)

### Tab 1: ⚡ QUÉT SẢN XUẤT (Live Scan & Match)
- **Mục đích**: Dành cho công nhân kiểm tra tại trạm đóng gói / kiểm định cuối.
- **Cách dùng**: Cắm máy quét mã vạch USB. Con trỏ chuột tự động đứng sẵn ở ô nhập liệu. Quét mã vạch trên sản phẩm:
  - Nếu **PASS**: Thẻ xanh lớn hiển thị `SẢN PHẨM ĐẠT CHUẨN`, phát âm thanh vui tai / đọc giọng nói "Đạt".
  - Nếu **FAIL (NG)**: Thẻ đỏ lớn hiển thị `SẢN PHẨM LỖI`, hiển thị danh sách các thông số bị lỗi (ví dụ: `Rub & Buzz`, `THD`, `Re`), phát âm thanh cảnh báo trầm / đọc giọng nói "Lỗi".
  - Hiển thị bảng chi tiết các giá trị thông số đo ($R_e, f_s$, Level...) so với giới hạn min/max.
  - Lưu lịch sử các lần quét gần nhất ở bảng bên dưới.

### Tab 2: 🎯 KIỂM TRA DANH SÁCH (Audit Reconciliation)
- **Mục đích**: Đối soát nhanh một danh sách mã vạch được yêu cầu (ví dụ danh sách xuất kho).
- **Cách dùng**:
  1. Dán danh sách mã vạch (mỗi mã 1 dòng) vào khung danh sách.
  2. Bấm **NẠP DANH SÁCH**.
  3. Quét mã vạch thực tế trên từng sản phẩm. Thanh tiến độ sẽ tăng dần và đánh dấu mã đã quét / mã còn thiếu / mã thừa.
  4. Bấm **XUẤT BÁO CÁO AUDIT** để tải file Excel kết quả đối soát.

### Tab 3: 📊 PHÂN TÍCH CHẤT LƯỢNG (Quality & Pareto)
- Xem các chỉ số chất lượng tổng quan: **FPY (First Pass Yield)**, **Tỷ lệ Pass thực tế**, **Số lần Retest**, **Tổng số lỗi**.
- **Biểu đồ Pareto 80/20**: Xem các nguyên nhân lỗi chiếm tỷ trọng lớn nhất để kỹ sư tập trung cải tiến.
- **Drilldown chi tiết**: Bấm vào bất kỳ dòng lỗi nào trên bảng Pareto để mở danh sách chi tiết các Serial Number bị dính lỗi đó, thời gian đo và trạm đo.
- **Biểu đồ phân bổ theo ca/giờ**: Xem sản lượng và tỷ lệ lỗi theo từng khung giờ và từng ca làm việc (Ca 1, Ca 2, Ca 3).

### Tab 4: 📈 THÔNG SỐ ĐO & Cpk (Parametric & Process Capability - MỚI V2)
- Chọn thông số kỹ thuật muốn phân tích từ menu thả xuống (ví dụ: $R_e, f_s, Q_{ts}$, Độ nhạy SPL...).
- Xem bảng thống kê: **Mean ($\mu$)**, **Độ lệch chuẩn ($\sigma$)**, **Min**, **Max**, **Chỉ số $C_p$**, **Chỉ số $C_{pk}$**.
- Quan sát biểu đồ **Phân phối Histogram**: Xem sự phân bố của sản phẩm thực tế so với 2 đường giới hạn $LSL$ (MinLimit) và $USL$ (MaxLimit) cùng đường cong phân phối chuẩn Gauss.
- **Bảng Cảnh Báo Cận Biên (Near-Fail)**: Danh sách các sản phẩm đạt PASS nhưng giá trị đo nằm sát mép dung sai (trong biên $10\%$).

### Tab 5: 📁 QUẢN LÝ TỆP & TRẠM ĐO (File & Station Manager - MỚI V2)
- Xem danh sách toàn bộ các file log đang nạp trong hệ thống.
- Xem thông tin trạm đo (`SAS208-01`, `SFS203-01`...), số lượng mẫu của từng tệp, điều kiện đo kích thích ($4\text{V}$, $16\text{V}$, $32\text{W}$).
- Bật/tắt checkbox của từng tệp để lọc và xem báo cáo cho riêng một trạm đo cụ thể hoặc toàn bộ nhà máy.

---

## ⚙️ 3. Cửa Sổ Cài Đặt Hệ Thống Đa Năng (Settings Modal)

Bấm nút **⚙️ CÀI ĐẶT** trên thanh tiêu đề (hoặc nhấn phím `ESC` để đóng) để mở bảng điều khiển cài đặt đa năng với 6 danh mục:

1. 🎨 **Hiển Thị & Thu Phóng (Display & Zoom)**: Chuyển đổi Dark/Light theme, thanh trượt thu phóng giao diện (UI Zoom Scale 80% - 150%), chỉnh mật độ dòng bảng dữ liệu (Thu gọn / Vừa phải / Rộng rãi).
2. 🔍 **Quét Mã & Matcher**: Độ dài mã quét tối thiểu, tự động cắt khoảng trắng đầu/cuối, cho phép khớp ngược (Reverse Match), tự động lọc tiền tố/hậu tố cố định.
3. 🔊 **Âm Thanh & Giọng Nói**: Âm lượng thông báo (0% - 200%), bật/tắt giọng nói đọc Tiếng Việt (Web Speech API "Đạt" / "Lỗi" / "Trùng"), nghe thử 4 loại âm thanh hệ thống.
4. 📈 **Chu Kỳ & Ngưỡng Cpk**: Ngưỡng thời gian tách chu kỳ sản xuất (phút), tiêu chuẩn $C_{pk}$ Đạt và $C_{pk}$ Xuất sắc (6-Sigma), biên độ cảnh báo cận biên sai số Near-Fail (%), chế độ gộp Combo lỗi ($A + B$).
5. 🏷️ **Tên Gọi Lỗi (Aliases & Hiding)**: Đổi tên mã lỗi kỹ thuật phức tạp thành tên tiếng Việt dễ hiểu, tìm kiếm nhanh tên lỗi, ẩn/hiện lỗi khỏi đánh giá FPY, Xuất/Nạp tệp Alias `.json`.
6. 💾 **Sao Lưu & Dữ Liệu**: Tải bản sao lưu toàn bộ cấu hình hệ thống ra tệp `.json`, khôi phục cấu hình từ tệp `.json`, xóa lịch sử quét phiên, khôi phục cài đặt gốc.
