# 🏗️ TÀI LIỆU 05: KIẾN TRÚC PHẦN MỀM & QUY TRÌNH ĐÓNG GÓI OFFLINE

Tài liệu này trình bày kiến trúc module hóa, luồng dữ liệu trung tâm (Data Flow Pipeline) và quy trình biên dịch tệp HTML độc lập chạy offline (Standalone Bundle) của QIT Scanner v2.

---

## 1. SƠ ĐỒ KIẾN TRÚC TỔNG THỂ (SYSTEM ARCHITECTURE)

```
                            NGƯỜI DÙNG / SÚNG QUÉT MÃ VẠCH / TỆP LOG KLIPPEL
                                                   │
                                                   ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                   LỚP GIAO DIỆN (UI LAYER - HTML5)                               │
 │                                                                                                  │
 │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌──────────┐  │
 │  │ 1. SCAN LIVE    │  │ 2. ĐỐI SOÁT     │  │ 3. CHẤT LƯỢNG    │  │ 4. THÔNG SỐ  │  │ 5. TỆP & │  │
 │  │ (Súng quét mã)  │  │ (Audit Target)  │  │ (3 Workspaces)   │  │    & Cpk     │  │  TRẠM ĐO │  │
 │  └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘  └──────┬───────┘  └────┬─────┘  │
 └───────────┼────────────────────┼────────────────────┼───────────────────┼───────────────┼────────┘
             │                    │                    │                   │               │
 ┌───────────┼────────────────────┼────────────────────┼───────────────────┼───────────────┼────────┐
 │           ▼                    ▼                    ▼                   ▼               ▼        │
 │  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
 │  │                     LỚP ĐIỀU KHIỂN & RENDER GIAO DIỆN (UI CONTROLLER MODULES)              │  │
 │  │  • 07-ui-common.js: Theme, Phông chữ, Zoom, Table Density, Web Audio API, Speech TTS, Excel│  │
 │  │  • 08-ui-scan.js:   Bảng FIFO 8 cột, Banner Phán định Khổng lồ (Verdict Band)              │  │
 │  │  • 09-ui-audit.js:  Bảng đối soát 6 cột, Thanh tiến độ thời gian thực                      │  │
 │  │  • 10-ui-analysis.js: 3 Workspaces (Pareto 80/20, Ma trận Đa lượt & Lỗi chéo, Ca kíp)     │  │
 │  │  • 11-ui-parametric.js: Biểu đồ Histogram Gauss, Thẻ Cpk, Bảng Cảnh báo Cận biên          │  │
 │  │  • 12-ui-files.js:  Quản lý danh sách tệp & Toggle bật/tắt trạm đo                         │  │
 │  │  • 13-ui-settings.js: Modal Cài đặt 6 danh mục, Quản lý Alias tên lỗi & Sao lưu JSON      │  │
 │  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
 │                                                 │                                                │
 │  ┌──────────────────────────────────────────────┴─────────────────────────────────────────────┐  │
 │  │                           LỚP TÍNH TOÁN & XỬ LÝ NGHIỆP VỤ (CORE ENGINES)                   │  │
 │  │  • 04-parser.js:   Auto Delimiter, Schema Detector, Bóc tách Record & Thư viện Metric      │  │
 │  │  • 05-matcher.js:  Bộ so khớp 3 tầng (Full Clean, Pure Serial, Substring) - O(1) Lookup   │  │
 │  │  • 06-stats.js:    Tính FPY, Final Yield, Retest, Time Gap Clustering, Ma trận, Cpk        │  │
 │  │  • 03-util.js:     Hàm định dạng, Thoát HTML, Xử lý Toán học, Độ lệch chuẩn, Gauss Bins    │  │
 │  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
 │                                                 │                                                │
 │  ┌──────────────────────────────────────────────┴─────────────────────────────────────────────┐  │
 │  │                         LỚP TRẠNG THÁI TRUNG TÂM (CENTRAL STATE STORE)                     │  │
 │  │  • 02-state.js:    loadedFilesMap, dictLookupClean, dictLookupSeri, timelineData,          │  │
 │  │                    analysisData, matrixData, correlationData, parametricAnalysisMap        │  │
 │  │  • 01-config.js:   Hằng số cấu hình hệ thống & Khóa LocalStorage                           │  │
 │  │  • 00-i18n-dict.js: Từ điển Đa ngôn ngữ (Tiếng Việt, English, 日本語, 中文)                │  │
 │  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DANH SÁCH 17 MODULE NGUỒN TRONG `src/`

Các tệp được đánh số thứ tự để xác định chính xác thứ tự phụ thuộc (Dependency Order) khi nạp vào trình duyệt hoặc khi biên dịch:

| Thứ Tự | Tên Module | Vai Trò Kỹ Thuật |
| :---: | :--- | :--- |
| **00** | `00-i18n-dict.js` | Từ điển đa ngôn ngữ (VI, EN, JA, ZH) cho toàn bộ hệ thống. |
| **01** | `01-config.js` | Hằng số cấu hình, ngưỡng Cpk mặc định, cờ LocalStorage. |
| **01b**| `01b-i18n.js` | Động cơ chuyển ngữ thời gian thực `_t(key)`. |
| **02** | `02-state.js` | Trạng thái trung tâm (State Store) lưu trữ toàn bộ dữ liệu phiên. |
| **03** | `03-util.js` | Các hàm tiện ích toán học, xử lý chuỗi an toàn, tính $C_{pk}$, Histogram. |
| **04** | `04-parser.js` | Phân tích file log Klippel, nhận diện delimiter và bóc tách dữ liệu. |
| **05** | `05-matcher.js` | Động cơ so khớp mã vạch 3 tầng thời gian thực $O(1)$. |
| **06** | `06-stats.js` | Động cơ tính toán chất lượng: FPY, Pareto, Ma trận, Tương quan, Cpk. |
| **07** | `07-ui-common.js` | Điều hướng Tab chính, Theme, Zoom, Âm thanh Web Audio, Xuất Excel. |
| **08** | `08-ui-scan.js` | Giao diện Quét mã vạch trực tiếp & Bảng lịch sử 8 cột. |
| **09** | `09-ui-audit.js` | Giao diện Đối soát danh sách sản phẩm & Bảng 6 cột. |
| **10** | `10-ui-analysis.js`| Giao diện 3 Không gian làm việc phân tích chất lượng chuyên sâu. |
| **11** | `11-ui-parametric.js`| Giao diện Phân tích năng lực quy trình Cpk & Danh sách Cận biên. |
| **12** | `12-ui-files.js` | Giao diện Quản lý danh sách file nạp & Bật/Tắt từng trạm đo. |
| **13** | `13-ui-settings.js`| Modal Cài đặt hệ thống 6 danh mục, Quản lý Alias & Sao lưu JSON. |
| **14** | `14-egg.js` | Đếm số lượng sản phẩm trọn đời & Hiệu ứng pháo hoa Confetti. |
| **99** | `99-boot.js` | Lắng nghe sự kiện DOMContentLoaded, khởi động ứng dụng và phím nóng ESC. |

---

## 3. QUY TRÌNH BIÊN DỊCH BẢN ĐỘC LẬP (OFFLINE STANDALONE BUNDLE)

Để ứng dụng có thể chạy hoàn toàn độc lập trên các máy tính trong phân xưởng không có kết nối Internet:
1. Script `build-bundle.js` tự động đọc:
   - Toàn bộ phông chữ CSS nhúng sẵn (`fonts.css`).
   - Stylesheet hoàn chỉnh (`scanner.css`).
   - Các thư viện JS độc lập trong thư mục `lib/` (Chart.js, ExcelJS, Canvas-confetti).
   - 17 file mã nguồn JavaScript trong `src/`.
2. Hợp nhất tất cả vào trong 1 tệp HTML duy nhất:
   👉 **`scanner-v2-standalone.html`** (Dung lượng: ~1.39 MB).

### Lệnh thực hiện biên dịch lại Bundle khi sửa code:
```bash
node build-bundle.js
```

### Lệnh chạy kiểm thử tự động toàn diện 7 tầng:
```bash
node test_parser.js
```
