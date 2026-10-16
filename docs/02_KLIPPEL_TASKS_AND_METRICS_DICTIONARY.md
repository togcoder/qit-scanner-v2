# 📖 TÀI LIỆU 02: TỪ ĐIỂN TASK ĐO & THÔNG SỐ ÂM HỌC KLIPPEL QC

Tài liệu này tổng hợp toàn bộ các Task đo kiểm âm học và thông số điện cơ Thiele-Small thường xuất hiện trong các file log Klippel QC Summary, cùng ý nghĩa vật lý và nguyên nhân lỗi thực tế trong sản xuất loa.

---

## 1. CÁC BÀI ĐO ÂM HỌC RỜI RẠC (ACOUSTIC VERDICT TASKS)

Trong hệ thống Klippel QC, mỗi bài kiểm tra được gán nhãn nhiệm vụ (*Task Name*) kèm điện áp kích thích (*Stimulus Voltage*):

```
                        CẤU TRÚC ĐẶT TÊN TASK ĐO TRONG LOG
               ┌───────────────────────┬───────────────────────┐
               │    resp - 16V 1/12    │    thd - 4V 1/12      │
               └───────────┬───────────┴───────────┬───────────┘
                           │                       │
                Task: Đáp tần (resp)        Task: Méo hài (thd)
                Điện áp: 16 Volts           Điện áp: 4 Volts
                Độ phân giải: 1/12 Octave   Độ phân giải: 1/12 Octave
```

### 📋 Bảng Chi Tiết Các Task Đo Phổ Biến

| Mã Kỹ Thuật (Log Header) | Tên Tiếng Việt Chuẩn Hóa | Ý Nghĩa Kỹ Thuật & Phạm Vi Đo | Nguyên Nhân Gây Lỗi Thường Gặp Trong Xưởng |
| :--- | :--- | :--- | :--- |
| `resp - 4V 1/12` | **Đáp tuyến tần số (4V)** | Đo áp suất âm thanh phát ra (SPL) trên dải tần số ở mức điện áp nhỏ (4V). | Lắp sai màng loa, nón loa bị móp, keo viền màng không kín hoặc dán lệch tâm. |
| `resp - 16V 1/12` | **Đáp tuyến tần số (16V)** | Đo đáp tần ở công suất cao (16V) để kiểm tra độ ổn định của màng khi dao động lớn. | Cuộn dây voice coil bị chạm hành trình cực đại (Xmax), nhện loa quá cứng. |
| `thd - 4V 1/12` | **Tổng méo hài (THD 4V)** | Đo tỷ lệ phần trăm các sóng hài bậc 2, 3, 4, 5 so với tần số cơ bản ở mức 4V. | Từ trường nam châm không đối xứng, nhện loa bị lệch trục (tilt), biến dạng cuộn dây. |
| `thd - 16V 1/12` | **Tổng méo hài (THD 16V)** | Đo độ méo phi tuyến ở công suất cao. | Cuộn dây nhảy ra ngoài khe từ trường (*BL nonlinearity*), màng loa bị uốn cong cơ học. |
| `rrbz` / `rub&buzz` | **Tạp âm rè màng (Rub & Buzz)** | Đo các thành phần méo xung tần số cao do cọ xát cơ học gây ra tiếng "rè rè". | **Cạ côn** (voice coil cọ vào cực T-yoke/Top plate), **Dây râu đập vào màng**, Dị vật (mạt sắt, giọt keo khô) lọt khe từ. |
| `pol` / `polarity` | **Cực tính loa (Phase/Polarity)** | Xác định chiều chuyển động của màng khi cấp điện áp dương (+). | Đấu ngược dây cực âm/dương (+/-) khi hàn trạm tiếp điểm hoặc quấn ngược chiều coil. |

---

## 2. THÔNG SỐ ĐO LIÊN TỤC & THIELE-SMALL (PARAMETRIC METRICS)

Các thông số vật lý liên tục được đo đạc chính xác bằng đơn vị tiêu chuẩn, phục vụ cho việc tính toán $C_p / C_{pk}$ và kiểm soát chất lượng 6-Sigma:

| Ký Hiệu | Đơn Vị | Tên Thông Số | Ý Nghĩa Vật Lý & Ngưỡng Đo |
| :---: | :---: | :--- | :--- |
| $R_e$ | $\Omega$ (Ohm) | **Điện trở thuần cuộn dây** | Điện trở DC của cuộn voice coil khi đứng yên. Phụ thuộc vào chiều dài, tiết diện và chất liệu dây đồng/nhôm. |
| $f_s$ | Hz | **Tần số cộng hưởng tự do** | Tần số mà tại đó hệ thống dao động tự nhiên (màng + nhện + coil) có biên độ lớn nhất trong không khí tự do. |
| $\text{SPL}$ / $\text{Level}$ | dB | **Mức áp suất âm thanh** | Độ nhạy âm học (Sensitivity) của loa ở khoảng cách và điện áp danh định (ví dụ: 1W/1m). |
| $Q_{ts}$ | — | **Hệ số phẩm chất tổng** | Tỷ số giữa năng lượng tích trữ và năng lượng tiêu hao tại tần số $f_s$ ($Q_{ts} = \frac{Q_{es} \cdot Q_{ms}}{Q_{es} + Q_{ms}}$). |
| $Q_{es}$ | — | **Hệ số phẩm chất điện** | Đánh giá khả năng hãm điện từ của hệ thống từ trường và cuộn dây. |
| $Q_{ms}$ | — | **Hệ số phẩm chất cơ** | Đánh giá độ ma sát và tổn hao cơ học của màng loa, gân viền và nhện loa. |
| $\text{impPt}$ | $\Omega$ | **Điểm trở kháng đặc trưng** | Trở kháng đo tại các điểm tần số kiểm định (ví dụ: trở kháng tại 1 kHz). |
| $\text{rmseZ}$ | % | **Độ sai lệch đường trở kháng** | Độ lệch quân phương (Root-Mean-Square Error) giữa đường cong trở kháng thực tế và mô hình lý thuyết. |
| $\text{SPL\_Delay}$ | ms / dB | **Độ trễ truyền âm** | Thời gian trễ từ khi phát tín hiệu điện đến khi micro Klippel thu nhận được sóng âm. |

---

## 3. MỐI QUAN HỆ KỸ THUẬT GIỮA THÔNG SỐ ĐO VÀ KHÂU SẢN XUẤT

```
  ┌───────────────────────┐              ┌──────────────────────────────────────────────┐
  │ THÔNG SỐ BẤT THƯỜNG   │              │ NGUYÊN NHÂN TẠI CÔNG ĐOẠN SẢN XUẤT           │
  ├───────────────────────┤              ├──────────────────────────────────────────────┤
  │ Re thấp hơn LSL       │ ───────────► │ Quấn thiếu vòng dây, chập lớp trong coil     │
  │ Re cao hơn USL        │ ───────────► │ Dây kéo quá căng làm mỏng tiết diện, mối hàn ảo│
  ├───────────────────────┤              ├──────────────────────────────────────────────┤
  │ fs cao hơn USL        │ ───────────► │ Nhện/gân quá cứng, dán keo nhện quá dày      │
  │ fs thấp hơn LSL       │ ───────────► │ Màng loa quá nặng (dư keo), nhện quá mềm     │
  ├───────────────────────┤              ├──────────────────────────────────────────────┤
  │ Rub & Buzz cao        │ ───────────► │ Đồ gá Jig ép lệch tâm, mạt từ tính trong khe│
  │ THD tăng vọt          │ ───────────► │ Nạp từ không đủ Gauss, T-yoke bị nghiêng     │
  └───────────────────────┘              └──────────────────────────────────────────────┘
```
