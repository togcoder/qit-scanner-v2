# 📚 TỔNG QUAN TÀI LIỆU KỸ THUẬT & GIẢI PHẪU DỮ LIỆU QIT SCANNER V2

Hệ thống tài liệu này được biên soạn nhằm lưu trữ, chuẩn hóa và chuyển giao toàn bộ tri thức kỹ thuật về **Giải phẫu cấu trúc tệp log Klippel QC**, **Từ điển các thông số âm học**, **Thuật toán chất lượng (FPY, Cpk, Ma trận, Tương quan)** và **Kiến trúc phần mềm QIT Scanner v2**.

---

## 📑 DANH MỤC TÀI LIỆU CHI TIẾT

| STT | Tên Tài Liệu | Nội Dung Chính | Liên Kết |
| :---: | :--- | :--- | :---: |
| **01** | **Giải Phẫu Cấu Trúc File Log Klippel QC** | Định dạng Header, phân tích Delimiter (Tab/Comma/Semicolon), bóc tách Metadata, phân loại cột Phán định vs Cột thông số liên tục. | [Xem 01_LOG_FILE_ANATOMY.md](./01_LOG_FILE_ANATOMY.md) |
| **02** | **Từ Điển Task Đo & Thông Số Âm Học** | Định nghĩa chuẩn Klippel.de: Đáp tần (`resp`), Méo hài (`thd`), Rè màng (`Rub & Buzz`), Điện trở $R_e$, Tần số cộng hưởng $f_s$, Độ nhạy SPL, Thiele-Small. | [Xem 02_KLIPPEL_TASKS_AND_METRICS_DICTIONARY.md](./02_KLIPPEL_TASKS_AND_METRICS_DICTIONARY.md) |
| **03** | **Giải Thuật Toán Học & Thống Kê Chất Lượng** | Công thức FPY, Final Yield, Retest, Gom nhóm theo chu kỳ thời gian (Time Gap), Năng lực quy trình $C_p / C_{pk}$, Ma trận tương quan $N \times N$, Cảnh báo Cận biên (Near-Fail). | [Xem 03_MATHEMATICAL_AND_QUALITY_ALGORITHMS.md](./03_MATHEMATICAL_AND_QUALITY_ALGORITHMS.md) |
| **04** | **Đặc Tả Bóc Tách Serial & Bộ Khớp Mã Vạch** | Thuật toán bóc tách Serial từ DUT ID, chuẩn hóa chuỗi loại trừ ký tự đặc biệt (`/`, `&`, `_`, `-`), cơ chế so khớp 3 tầng (Multi-tier Matcher). | [Xem 04_BARCODE_MATCHER_AND_CLEANING_SPEC.md](./04_BARCODE_MATCHER_AND_CLEANING_SPEC.md) |
| **05** | **Kiến Trúc Phần Mềm & Đóng Gói Offline** | Sơ đồ luồng dữ liệu 17 module, Quản lý State trung tâm, Cơ chế nhúng toàn bộ CSS/JS/Fonts thành tệp HTML Standalone 100% Offline. | [Xem 05_SYSTEM_ARCHITECTURE_AND_STANDALONE_BUILD.md](./05_SYSTEM_ARCHITECTURE_AND_STANDALONE_BUILD.md) |

---

## 🎯 PHẠM VI ỨNG DỤNG
- Dành cho Kỹ sư Đảm bảo Chất lượng (QA/QE), Kỹ sư Sản phẩm (PE/TE), Kỹ sư Tự động hóa và Lập trình viên duy trì, mở rộng hệ thống kiểm âm Klippel trong nhà máy sản xuất loa & thiết bị âm thanh.
