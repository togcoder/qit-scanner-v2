# 🔬 TÀI LIỆU 01: GIẢI PHẪU CẤU TRÚC FILE LOG KLIPPEL QC SUMMARY

## 1. TỔNG QUAN HỆ THỐNG GHI LOG KLIPPEL QC (KLIPPEL.DE)
Phần mềm đo kiểm âm học chuyên dụng **Klippel QC (Quality Control)** của Klippel GmbH (Đức) tự động xuất file log tổng hợp dạng văn bản thuần túy (`.log`, `.txt`, `.csv`) sau mỗi chu kỳ đo loa trên dây chuyền sản xuất.

Dữ liệu log summary của Klippel không phải lúc nào cũng đồng nhất, mà biến thiên phụ thuộc vào:
1. Phiên bản phần mềm Klippel QC (dB-Lab / QC Release 4, 5, 6, 7).
2. Cấu hình kịch bản đo (*Test Script / Test Structure*) của kỹ sư âm thanh (số lượng Task đo, điện áp kích thích 4V, 16V, 32W...).
3. Cách thức đặt tên trạm đo (*Station Identifier*) và định dạng ký tự phân tách (*Delimiter*).

---

## 2. PHÂN LOẠI 2 CẤU TRÚC FILE LOG CHÍNH

### 🟢 Loại 1: Log Đầy Đủ Metadata Header (Full Klippel Summary Log)
*Ví dụ điển hình*: `Summary 659841 2026-06-05 12-41-43-0 UTC+0700.log`
- **Khối Header (Metadata Block)**: 5 - 15 dòng đầu chứa thông tin môi trường đo:
  ```text
  KLIPPEL QC - Summary Log File
  Test Structure: Production Line 1 - Woofer Acoustic Check
  Station Name: SAS208-01
  Operator: QIT_Engineer
  Start Date: 2026-06-05 12:41:43
  Delimiter: TAB
  ```
- **Dòng Tiêu Đề Cột (Column Headers Line)**: Bắt đầu bằng tên trường:
  `ID	Time	Result	resp - 16V 1/12 (Result)	re - 4V 1/12 (Value)	...`
- **Khối Bản Ghi Dữ Liệu (Data Matrix Rows)**: Mỗi dòng tương ứng với 1 lần bấm máy đo của 1 sản phẩm.

### 🟡 Loại 2: Log Rút Gọn / Xuất Trực Tiếp Dạng Bảng (Direct Tabular Log)
*Ví dụ điển hình*: `100%.log.txt`, `200%.log.txt`, `300%.log.txt`, `400%.log.txt`
- Không có khối Header mở đầu mà đi thẳng vào dòng tiêu đề cột hoặc dữ liệu có cấu trúc.
- Trạm đo thường được suy diễn từ tên file hoặc cấu hình kịch bản (ví dụ: `SFS203-01`).

---

## 3. THUẬT TOÁN TỰ ĐỘNG NHẬN DIỆN KÝ TỰ PHÂN TÁCH (AUTO DELIMITER DETECTION)

Do nhà máy có thể lưu log ở nhiều định dạng, parser quét qua 20 dòng đầu tiên và tính điểm tần suất xuất hiện của các ký tự phân tách:

$$\text{Delimiter Score} = \sum_{i=1}^{K} \text{Count}(\text{char}, \text{line}_i) \times \left(1 - \frac{\sigma_{\text{count}}}{\mu_{\text{count}}}\right)$$

Các ký tự được hỗ trợ tự động:
1. `\t` (**Tab Delimiter** - Chuẩn mặc định Klippel QC).
2. `,` (**Comma Delimiter** - Chuẩn CSV quốc tế).
3. `;` (**Semicolon Delimiter** - Chuẩn CSV vùng Châu Âu / Excel).
4. `|` (**Pipe Delimiter** - Một số hệ thống MES trung gian).

---

## 4. BẢNG PHÂN LOẠI & GIẢI PHẪU TỪNG LOẠI CỘT TRONG LOG

Mỗi cột trong file log Klippel được bóc tách và phân vào 1 trong 4 nhóm nghiệp vụ chính:

```
                      ┌────────────────────────────────────────┐
                      │    FILE LOG KLIPPEL QC SUMMARY ROWS    │
                      └───────────────────┬────────────────────┘
                                          │
         ┌──────────────────┬─────────────┴────────────┬──────────────────┐
         ▼                  ▼                          ▼                  ▼
┌─────────────────┐┌─────────────────┐ ┌─────────────────────────┐┌─────────────────┐
│ 1. ĐỊNH DANH    ││ 2. PHÁN ĐỊNH    │ │ 3. THÔNG SỐ ĐO LIÊN TỤC ││ 4. DỮ LIỆU ĐƯỜNG│
│    (Identity)   ││    (Verdicts)   │ │    (Parametric Continuous││   CONG & MẢNG    │
│ - Serial/ID/DUT ││ - Overall Result│ │ - Re, fs, Qts, SPL, THD ││ - Frequency Resp│
│ - Time / Date   ││ - Task Results  │ │ - LSL / USL Limits      ││   (1/12 Octave) │
│ - Station Name  ││ (PASS / FAIL)   │ │ - Mean, Max, Min, Delay ││ - Distortion Pts│
└─────────────────┘└─────────────────┘ └─────────────────────────┘└─────────────────┘
```

### 1️⃣ Cột Định Danh (Identity & Metadata)
| Tên Cột Phổ Biến | Ý Nghĩa Kỹ Thuật | Cơ Chế Xử Lý Của Parser v2 |
| :--- | :--- | :--- |
| `ID`, `DUT`, `Serial`, `Barcode` | Mã định danh thiết bị đo (DUT ID) | Bóc tách phần mã hàng (Model) và Serial vật lý trần. |
| `Time`, `Date`, `Timestamp` | Thời điểm thực hiện phép đo | Chuẩn hóa về đối tượng `Date` của JavaScript để tính FPY và vẽ Heatmap. |
| `Station`, `Test Station` | Tên máy đo / Jig kiểm âm | Gom nhóm và so sánh năng lực chéo giữa các máy đo. |
| `Operator`, `User` | Tên nhân viên đứng chuyền | Thống kê sản lượng theo nhân sự. |

### 2️⃣ Cột Phán Định (Task Verdicts - Rời rạc: PASS / FAIL)
Klippel QC gán phán định cho từng bài đo (*Task*) bằng các từ khóa chuẩn:
- **`PASSED` / `PASS` / `OK` / `0`**: Sản phẩm nằm hoàn toàn trong dung sai cho phép của bài đo.
- **`FAILED` / `FAIL` / `NG` / `1`**: Sản phẩm vi phạm ngưỡng giới hạn trên hoặc dưới.
- **`ABORTED` / `ERROR` / `NOT TESTED`**: Phép đo bị hủy do lỗi kỹ thuật (rơi mic, hở mạch, chạm chập).

### 3️⃣ Cột Thông Số Đo Liên Tục (Continuous Parametric Metrics)
Chứa các giá trị vật lý đo được kèm giới hạn kiểm soát LSL (Lower Spec Limit) và USL (Upper Spec Limit):
- *Cấu trúc header thường gặp*: `re - 4V 1/12 [Ohm] (Min=15.5, Max=18.5)` hoặc `SPL_Delay - RB 16V [dB]`.
- Parser bóc tách: **Tên thông số**, **Đơn vị đo ($\Omega$, Hz, dB, %, V, W)**, **Ngưỡng LSL**, **Ngưỡng USL**, **Giá trị đo thực tế**.

---

## 5. CÁC ĐIỂM ĐẶC THÙ & LỖI TIỀM ẨN KHI ĐỌC LOG KLIPPEL

1. **Chuỗi ID có chứa ký tự phân cách**: Một số mã quét chứa dấu gạch chéo `/`, dấu `&` hoặc dấu phẩy `,` dễ làm rách cột nếu parser dùng lệnh `split()` ngây thơ $\rightarrow$ Parser v2 dùng bộ phân tích Regular Expression nhận diện ngữ cảnh ngoặc kép (`"..."`).
2. **Ký hiệu đơn vị đo đặc biệt**: Ký hiệu Ohm ($\Omega$), độ ($\deg$), micro ($\mu$) có thể bị biến thành ký tự rác (`?` hoặc ``) nếu tệp lưu dạng ANSI/ASCII $\rightarrow$ Parser v2 tích hợp thuật toán tự nhận diện bảng mã UTF-8 vs Win-1252.
3. **Cột đo không có thời gian**: Một số file xuất không bật cờ lưu thời gian $\rightarrow$ Hệ thống tự động kích hoạt cờ `noTimestamp = true` để hiển thị chế độ phân tích phi thời gian an toàn.
