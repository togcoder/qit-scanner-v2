# 🏷️ TÀI LIỆU 04: ĐẶC TẢ BÓC TÁCH SERIAL & BỘ SO KHỚP MÃ VẠCH (MATCHER V2)

Tài liệu này mô tả chi tiết cơ chế chuẩn hóa chuỗi, thuật toán phân biệt Model vs Serial Number và cấu trúc so khớp 3 tầng (Multi-tier Matcher Engine).

---

## 1. VẤN ĐỀ CỦA BẢN V1 VÀ PHÂN BIỆT RÕ MODEL VS SERIAL

Trong kiểm tra âm thanh Klippel:
1. **Dạng 1: Chuỗi ghép Model_Serial**:
   *Ví dụ*: `P2001315-10-B_SIEV261531B1102`
   - `P2001315-10-B` là **Mã Model / Mã Bản Vẽ** (Part Number / Model Code).
   - `SIEV261531B1102` là **Số Serial vật lý** của từng con hàng (Serial Number).
2. **Dạng 2: Chuỗi Serial trần (Pure Serial)**:
   *Ví dụ*: `FNIENBDV41RK0B09`
   - Đây là **Số Serial vật lý độc lập** của từng sản phẩm.
   - **Mã Model** không nằm trong chuỗi ID mà được trích xuất từ đường dẫn Database Klippel (`D:\SFS203-01\...\655983\...` $\rightarrow$ Model: `655983`).
   - *Lưu ý*: Bản cũ bị nhầm lẫn gán toàn bộ chuỗi Serial trần làm tên Model, dẫn tới bảng Model hiển thị hàng nghìn dòng Serial đơn lẻ. Bản V2 đã bóc tách chính xác Model từ Database Path hoặc tiền tố phân cách, nhóm toàn bộ dữ liệu về đúng các Model thực tế (ví dụ: `P2001315-10-B` và `655983`).

---

## 2. QUY TRÌNH CHUẨN HÓA CHUỖI (ALPHANUMERIC CLEANING PIPELINE)

Hệ thống Scanner V2 áp dụng quy trình chuẩn hóa chuỗi 3 bước nghiêm ngặt:

```
    CHUỖI QUÉT GỐC THÔ: "  P2001315-10-B/SIEV261531B1102 \r\n "
                         │
                         ▼ (Bước 1: Auto Trim & Bỏ ký tự điều khiển \r \n \t)
                   "P2001315-10-B/SIEV261531B1102"
                         │
                         ▼ (Bước 2: Lọc bỏ ký tự đặc biệt - Chỉ giữ a-z, 0-9)
                   "p200131510bsiev261531b1102"
                         │
                         ▼ (Bước 3: Bóc tách Serial trần - Trailing Token Extraction)
                   "siev261531b1102"
```

### Hàm chuyển đổi chuẩn `getAlphaNum(str)`:
```javascript
function getAlphaNum(str) {
    if (!str) return '';
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}
```

---

## 3. CƠ CHẾ SO KHỚP 3 TẦNG ĐỘC LẬP (MULTI-TIER MATCHER ENGINE)

Khi công nhân quét một mã bất kỳ, hệ thống duyệt qua 3 tầng chỉ mục với độ trễ dưới 1 mili-giây ($O(1)$):

```
                               MÃ QUÉT TỪ SÚNG BARCODE
                                          │
                                          ▼
                ┌──────────────────────────────────────────────────┐
                │ TẦNG 1: KHỚP CHÍNH XÁC ID ĐẦY ĐỦ (Full Clean ID) │
                │        dictLookupClean.get(cleanScan)            │
                └─────────────────────────┬────────────────────────┘
                                          │ (Nếu không khớp)
                                          ▼
                ┌──────────────────────────────────────────────────┐
                │ TẦNG 2: KHỚP SERIAL TRẦN (Pure Serial Lookup)    │
                │        dictLookupSeri.get(cleanScan)             │
                └─────────────────────────┬────────────────────────┘
                                          │ (Nếu không khớp)
                                          ▼
                ┌──────────────────────────────────────────────────┐
                │ TẦNG 3: KHỚP CHUỖI CON & MÃ HÀNG (Substring Match)│
                │     Quét tập mốc Model & Tiền tố độ dài >= 4     │
                └─────────────────────────┬────────────────────────┘
                                          │
                         ┌────────────────┴────────────────┐
                         ▼                                 ▼
                 ✅ TÌM THẤY BẢN GHI               ❌ BÁO "NOT FOUND"
                 (Hiển thị & Đọc tiếng)            (Còi cảnh báo âm)
```

### 1️⃣ Tầng 1: Full Clean ID Match (Độ ưu tiên cao nhất)
- So khớp trực tiếp chuỗi quét với toàn bộ mã định danh trong file log sau khi đã lược bỏ dấu gạch nối và ký tự đặc biệt.
- Áp dụng khi công nhân quét mã tem dài.

### 2️⃣ Tầng 2: Pure Serial Match (Độ ưu tiên số 2)
- Parser tự động tách chuỗi sau dấu gạch dưới `_`, dấu gạch ngang `-` hoặc dấu gạch chéo `/` cuối cùng để tạo bảng băm `dictLookupSeri`.
- Áp dụng khi công nhân chỉ quét mã Serial trần khắc laser trên đuôi củ loa.

### 3️⃣ Tầng 3: Substring & Reverse Matching (Độ ưu tiên số 3)
- Cho phép nhận diện nếu mã quét là phần tiền tố hoặc phần hậu tố hợp lệ nằm trong một mã dài hơn (có áp dụng điều kiện chặn mã giả lập: độ dài tối thiểu `MIN_SCAN_LEN = 4` ký tự).

---

## 4. BẢNG TEST CASE THỰC NGHIỆM ĐÃ XÁC THỰC TRÊN 8,893 BẢN GHI

| Mã ID Gốc Trong File Log | Chuỗi Thực Tế Công Nhân Quét | Tầng Khớp | Kết Quả Trả Về |
| :--- | :--- | :---: | :---: |
| `P2001315-10-B_SIEV261531B1102` | `P2001315-10-B_SIEV261531B1102` | **Tầng 1** | ✅ Khớp đúng 100% |
| `P2001315-10-B_SIEV261531B1102` | `SIEV261531B1102` | **Tầng 2** | ✅ Khớp đúng 100% |
| `P2001315-10-B_SIEV261531B1102` | `siev-261531-b1102` (có dấu gạch) | **Tầng 2** | ✅ Khớp đúng 100% |
| `FNIENBDV41RK0B09` | `FNIENBDV41RK0B09` | **Tầng 1** | ✅ Khớp đúng 100% |
| `F5AA8BHTYKWAENC5` | `F5AA8BHTYKWAENC5` | **Tầng 1** | ✅ Khớp đúng 100% |
| Bất kỳ chuỗi nào | `ABC` (< 4 ký tự) | Chặn | ⚠️ Từ chối (Chuỗi quá ngắn) |
| Bất kỳ chuỗi nào | `INVALID_CODE_9999` | Không khớp | ❌ Báo `NOT_FOUND` |
