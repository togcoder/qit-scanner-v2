# 📐 TÀI LIỆU 03: GIẢI THUẬT TOÁN HỌC & THỐNG KÊ CHẤT LƯỢNG

Tài liệu này chi tiết hóa toàn bộ các công thức toán học, mô hình phân bố xác suất và thuật toán thống kê chất lượng (SPC) được cài đặt trong động cơ tính toán của QIT Scanner v2.

---

## 1. THUẬT TOÁN PHÂN ĐOẠN CHU KỲ THEO KHOẢNG THỜI GIAN (TIME GAP CLUSTERING)

### Vấn đề thực tế trong nhà máy:
Nếu một sản phẩm (cùng một số Serial) được đo thử nghiệm vào **sáng thứ Hai**, sau đó tuần sau **thứ Sáu** sản phẩm đó được đưa vào đo trong một lô sản xuất mới, việc gộp tất cả các lần đo lại làm một sẽ làm sai lệch FPY của từng lô.

### Thuật toán phân tách Event:
Cho chuỗi các bản ghi đo của một sản phẩm: $R = [r_1, r_2, \dots, r_m]$ được sắp xếp tăng dần theo thời gian $t_1 \le t_2 \le \dots \le t_m$.
Một sự kiện mới (*Production Event*) được khởi tạo khi:

$$\Delta t = t_{k} - t_{k-1} > T_{\text{gap}} \quad (\text{Mặc định } T_{\text{gap}} = 30 \text{ phút})$$

Mỗi Event $E$ đại diện cho **1 chu kỳ kiểm định độc lập**, trong đó:
- `firstRun` ($r_1$ của Event): Dùng để tính toán **First Pass Yield (FPY)**.
- `lastRun` ($r_{\text{last}}$ của Event): Dùng để tính toán **Final Yield** và phân tích Pareto lỗi sau khắc phục.

---

## 2. CÔNG THỨC TÍNH FPY, FINAL YIELD & RETEST RATE

```
                       TẬP HỢP TẤT CẢ SẢN PHẨM (N_total)
      ┌─────────────────────────────────────────────────────────────┐
      │                   SẢN PHẨM ĐỘC LẬP (N_unique)               │
      ├──────────────────────────────┬──────────────────────────────┤
      │  ĐẠT NGAY LẦN ĐẦU (N_first)  │  LỖI LẦN ĐẦU (N_first_fail)  │
      │  ───────► TÍNH FPY           ├──────────────┬───────────────┤
      │                              │ SỬA & RETEST │ VẪN LỖI (NG)  │
      │                              │ ĐẠT (N_retest│               │
      │                              │ _pass)       │               │
      └──────────────────────────────┴──────────────┴───────────────┘
      ▲                                             ▲
      └──────────────────────┬──────────────────────┘
                             ▼
                   TÍNH FINAL PASS YIELD
```

### 1. First Pass Yield (Tỷ lệ đạt lần đầu - FPY):
$$\text{FPY} = \left( \frac{N_{\text{first\_pass}}}{N_{\text{unique\_units}}} \right) \times 100\%$$

### 2. Final Pass Yield (Tỷ lệ đạt sau cùng):
$$\text{Final Yield} = \left( \frac{N_{\text{last\_pass}}}{N_{\text{unique\_units}}} \right) \times 100\%$$

### 3. Retest Rate (Tỷ lệ đo lại):
$$\text{Retest Rate} = \left( \frac{N_{\text{retest\_units}}}{N_{\text{unique\_units}}} \right) \times 100\%$$

---

## 3. THUẬT TOÁN TÍNH TOÁN PARETO 80/20 & ĐƯỜNG CONG TÍCH LŨY

Bảng Pareto sắp xếp các danh mục lỗi theo số lượng giảm dần: $\text{Count}_1 \ge \text{Count}_2 \ge \dots \ge \text{Count}_K$.

Tỷ lệ phần trăm lỗi tích lũy (% Cumulative) tại vị trí thứ $k$ được tính bằng:

$$\text{CumPct}_k = \left( \frac{\sum_{i=1}^{k} \text{Count}_i}{\sum_{j=1}^{K} \text{Count}_j} \right) \times 100\%$$

Vạch ngưỡng **80% Cut-off** trên biểu đồ Pareto phân định nhóm **20% nguyên nhân cốt lõi** cần ưu tiên xử lý trước trong dây chuyền.

---

## 4. MA TRẬN TƯƠNG QUAN LỖI CHÉO $N \times N$ (DEFECT CO-OCCURRENCE)

Ma trận vuông $M_{N \times N}$ biểu diễn số lượng sản phẩm đồng thời mắc cả lỗi $T_i$ và lỗi $T_j$:

$$M_{i,j} = \sum_{u=1}^{N_{\text{fail}}} \mathbf{1}\left( T_i \in \text{Errors}(u) \ \land \ T_j \in \text{Errors}(u) \right)$$

- Đường chéo chính $M_{i,i}$: Tổng số sản phẩm dính lỗi $T_i$.
- Các phần tử ngoài đường chéo $M_{i,j}$ ($i \neq j$): Thể hiện mức độ liên đới kỹ thuật (ví dụ: Lỗi lệch đáp tần `resp` thường xuyên đi kèm với lỗi méo hài `thd`).

---

## 5. NĂNG LỰC QUY TRÌNH STATISTICAL PROCESS CONTROL ($C_p, C_{pk}$)

Với tập dữ liệu đo liên tục $X = \{x_1, x_2, \dots, x_n\}$ của một thông số (ví dụ: Điện trở $R_e$):

### 1. Giá trị trung bình mẫu ($\mu$ - Mean):
$$\mu = \bar{x} = \frac{1}{n} \sum_{i=1}^{n} x_i$$

### 2. Độ lệch chuẩn mẫu ($\sigma$ - Standard Deviation):
$$\sigma = s = \sqrt{\frac{1}{n - 1} \sum_{i=1}^{n} (x_i - \bar{x})^2}$$

### 3. Chỉ số năng lực tiềm năng ($C_p$ - Process Capability):
$$C_p = \frac{\text{USL} - \text{LSL}}{6\sigma}$$

### 4. Chỉ số năng lực thực tế ($C_{pk}$ - Process Capability Index):
$$C_{pl} = \frac{\bar{x} - \text{LSL}}{3s}, \quad C_{pu} = \frac{\text{USL} - \bar{x}}{3s}$$

$$C_{pk} = \min(C_{pl}, C_{pu})$$

### 5. Chỉ số hiệu suất tổng thể quy trình ($P_p, P_{pk}$ - Process Performance):
Được tính trên toàn bộ tập dữ liệu mẫu thực tế của lô sản xuất (bao gồm cả các sản phẩm hỏng/dị biệt):
$$P_p = \frac{\text{USL} - \text{LSL}}{6\sigma_{\text{all}}}, \quad P_{pk} = \min\left(\frac{\bar{x}_{\text{all}} - \text{LSL}}{3\sigma_{\text{all}}}, \frac{\text{USL} - \bar{x}_{\text{all}}}{3\sigma_{\text{all}}}\right)$$

### 6. Độ lệch tâm quy trình ($k$ - Process Off-center Index):
$$k = \frac{|\bar{x} - M|}{(\text{USL} - \text{LSL})/2}, \quad \text{với } M = \frac{\text{USL} + \text{LSL}}{2}$$
- $k = 0$: Quy trình hoàn toàn định tâm tại điểm lý tưởng.
- $k \ge 1$: Giá trị trung bình nằm ngoài dung sai.
- Mối liên hệ toán học: $C_{pk} = C_p (1 - k)$.

### 7. Lọc dữ liệu chuẩn SPC (SPC Natural Variation Filtering):
Theo chuẩn kiểm soát quy trình thống kê (Klippel QC SPC & ISO 21747), năng lực tự nhiên $C_{pk}$ cần được tính toán trên các mẫu kiểm soát (*In-control / Conforming units*) để tránh việc các sự cố ngoại lai (như tuột giắc cắm, hở mối hàn làm SPL rơi từ 140 dB xuống 50 dB) làm thổi phồng độ lệch chuẩn $s$ một cách nhân tạo.
Hệ thống cung cấp 3 chế độ:
- `PASS_ONLY` (Khuyến nghị chuẩn SPC): Tính $C_p / C_{pk}$ trên sản phẩm Đạt, đồng thời báo cáo $P_p / P_{pk}$ trên toàn bộ sản phẩm.
- `ALL`: Tính trên 100% bản ghi.
- `TRIMMED_3SIGMA`: Tự động loại bỏ các điểm dị biệt nằm ngoài dải $\bar{x} \pm 3s$.

### 8. Tiêu chuẩn đánh giá $C_{pk}$ công nghiệp:
- **$C_{pk} < 1.00$**: Quy trình không đạt năng lực (Phế phẩm cao, phân bố lệch ngoài giới hạn).
- **$1.00 \le C_{pk} < 1.33$**: Quy trình chấp nhận được nhưng cần giám sát chặt.
- **$1.33 \le C_{pk} < 1.67$**: Quy trình tốt, đạt năng lực kiểm soát chất lượng ổn định.
- **$C_{pk} \ge 1.67$**: Quy trình xuất sắc (Đạt tiêu chuẩn 6-Sigma, tỷ lệ lỗi < 3.4 DPMO).

---

## 9. CẢNH BÁO CẬN BIÊN SỚM (NEAR-FAIL MARGIN ALERT)

Khoảng dung sai kiểm tra: $\Delta = \text{USL} - \text{LSL}$.
Khoảng biên độ cảnh báo sớm (Mặc định 10% dung sai):

$$\text{Margin} = \Delta \times \left(\frac{\text{NEAR\_FAIL\_MARGIN\_PCT}}{100}\right)$$

Một sản phẩm được xếp vào danh sách **Cận Biên (Near-Fail)** khi:
- Cận dưới: $\text{LSL} \le x_i \le \text{LSL} + \text{Margin}$
- Cận trên: $\text{USL} - \text{Margin} \le x_i \le \text{USL}$

Giúp kỹ sư phát hiện xu hướng trôi thông số (*Parameter Drift*) trước khi máy bắt đầu sinh ra hàng phế phẩm thực sự.
