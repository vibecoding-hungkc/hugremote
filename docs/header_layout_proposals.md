# Đề Xuất Thiết Kế Lại Thanh Header (SmartHeader) - HugRemote

> **Mục tiêu:** Tận dụng không gian còn trống trên tầng tên Server, khắc phục tình trạng chia 2 tầng lãng phí chiều cao, tối ưu hóa công năng và mang lại trải nghiệm gọn gàng, hiện đại chuẩn Dark Theme cho lập trình viên.

---

## Hiện trạng hiện tại (2 Tầng)
```text
┌────────────────────────────────────────────────────────────────────────┐
│                        ● hungnd@hungpc (22px)                          │
├────────────────────────────────────────────────────────────────────────┤
│ [☰] [📁 project]   [ > / src / components / ... ]   [VI] [+] [🔄] (38px) │
└────────────────────────────────────────────────────────────────────────┘
```
- **Vấn đề:** 
  1. Hàng trên (`server-title-row`) cao 22px chỉ hiển thị duy nhất tên server ở giữa, hai bên trái phải trống 80-90% diện tích.
  2. Tổng chiều cao header lên tới 64px, chiếm nhiều không gian quý giá của màn hình dòng lệnh Terminal và khung chat Claude trên thiết bị di động/laptop.
  3. Hàng dưới (`context-row`) lại bị chen chúc giữa Menu, Project, Breadcrumb/Session Pill, Ngôn ngữ và các nút Action.

---

## 5 Mẫu Đề Xuất Bố Cục (Header Layout Models)

---

### MẪU 1: SINGLE-BAR COMPACT (Gộp 1 Tầng Tinh Gọn - Khuyên Dùng ⭐)
*Gộp toàn bộ thành duy nhất 1 thanh phẳng cao 44px - 48px, đưa Server & Project thành một cụm thông tin thống nhất bên trái.*

#### Sơ đồ trực quan:
```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [☰] [● hungpc / 📁 hugremote ▾] │ [ > / client / src / App.vue ] │ [🌐 VI] [+] [🔄]     │
│ └───────── TRÁI ─────────────┘ │ └──────── GIỮA ────────────┘ │ └──── PHẢI ──────┘     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Cụm Trái (Host & Context Scope):**
  - Nút Menu Drawer `[☰]` mở danh sách server.
  - Một Pill Badge gộp: `[● hungpc / 📁 hugremote ▾]` (Bấm vào chọn nhanh Server hoặc chuyển Project).
- **Cụm Giữa (Active Resource Center - Dynamic Flex):**
  - **Files:** Breadcrumb dạng trượt mượt mà `[ > / client / src / ... ]`
  - **Terminal:** Pill `[>_ terminal #1 (3) ▾]`
  - **Claude:** Pill `[✦ claude-sonnet (2) ▾]`
  - **Git:** Pill `[⎇ main (3 changes)]`
- **Cụm Phải (Quick Actions):**
  - Chuyển ngôn ngữ `[VI/EN]` + Các nút tác vụ nhanh theo tab (`+`, `Refresh`, `Save`).
- **Ưu điểm:** Tiết kiệm ngay 20px chiều cao cho màn hình làm việc, không còn khoảng trống thừa thãi, bố cục thanh lịch chuẩn phong cách công cụ dev hiện đại (Linear / Vercel style).

---

### MẪU 2: TWO-TIER SYSTEM MONITOR (Tầng Trên Làm Thanh Trạng Thái Hệ Thống)
*Giữ nguyên cấu trúc 2 tầng (60px), nhưng lấp đầy hàng trên bằng thông tin tài nguyên Server (CPU, RAM, Ping/Latency).*

#### Sơ đồ trực quan:
```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [● hungnd@hungpc]        ⚡ 38ms   │   💻 CPU: 18%   RAM: 4.2/16GB         [SSH: Active] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [☰] [📁 hugremote]       │ [ > / src / components / ... ]         │ [🌐 VI] [+] [🔄]    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Tầng 1 (Status Bar - 24px, nền hơi tối hơn `#090e1a`):**
  - **Bên trái:** `● hungnd@hungpc` (Host name + IP/Cổng).
  - **Ở giữa:** Thông số tải nhanh của server: CPU %, RAM sử dụng, Ping latency (hoặc Uptime).
  - **Bên phải:** Trạng thái kết nối SSH / WebSocket (`Connected`).
- **Tầng 2 (Workplace Bar - 36px):**
  - Các nút điều hướng Workspace: Project selector, Breadcrumb, Session switcher, Action buttons.
- **Ưu điểm:** Khai thác tối đa khoảng trống hàng 1 thành bảng điều khiển máy chủ chuyên nghiệp, rất hữu ích khi quản lý nhiều VPS/Server từ xa.

---

### MẪU 3: TOP-TIER WORKSPACE SWITCHER (Tầng Trên Làm Thanh Tab/Phiên Nhanh)
*Đưa các phiên Terminal / Claude hoặc tab mở gần đây lên lấp đầy hàng trên dạng tab bar mini.*

#### Sơ đồ trực quan:
```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [● hungpc] │ [>_ term-1] [>_ build *] [✦ claude-task] [+]              │ [🌐 VI] [⚙️]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [☰] [📁 hugremote ▾]     │ [ > / client / src / App.vue ]              │ [+] [🔄] [💾] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Tầng 1 (Host & Quick Tabs - 26px):**
  - **Bên trái:** Tên server `[● hungpc]`.
  - **Ở giữa (Scroll ngang):** Dãy thẻ tab mini chuyển nhanh các phiên đang chạy (`term-1`, `term-2`, `claude-1`), có nút `+` tạo phiên mới ngay trên đỉnh.
  - **Bên phải:** Nút đổi ngôn ngữ & Settings.
- **Tầng 2 (Context Action Bar - 34px):**
  - Thanh breadcrumb đường dẫn chi tiết hoặc tên file đang mở, cùng các nút hành động (Save, Run, Preview).
- **Ưu điểm:** Chuyển đổi qua lại giữa các terminal/phiên Claude chỉ với 1 chạm mà không cần phải mở modal Session Hub.

---

### MẪU 4: BREADCRUMB COMMAND CENTER (Đưa Breadcrumb Lên Hàng Trên Cùng Server)
*Hàng trên hiển thị trọn vẹn lộ trình làm việc từ Server -> Repo -> Thư mục; Hàng dưới dành cho các tác vụ và session.*

#### Sơ đồ trực quan:
```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [● hungpc] > [📁 hugremote] > [src] > [components] > [SmartHeader.vue]   [🌐 VI] [🔔]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [☰ Menu]   [⎇ branch: main]   [>_ Sessions: 3 ▾]   [✦ Claude: 1 ▾]       [+] [🔄] [💾] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Tầng 1 (Hierarchical Breadcrumb Path - 26px):**
  - Biểu diễn dòng phân cấp xuyên suốt: `[Host] > [Project] > [Thư mục cha] > [File hiện tại]`.
  - Giúp lập trình viên luôn biết chính xác mình đang đứng ở server nào, repo nào, nhánh nào mà không bị co cụm chữ.
- **Tầng 2 (Toolbar & Tool Session Controls - 36px):**
  - Tập trung toàn bộ nút bấm chức năng: Nút Menu máy chủ, chuyển nhánh Git, bộ chọn phiên Terminal/Claude và các nút lưu/chạy lệnh.
- **Ưu điểm:** Tính định hướng cực cao, không bao giờ bị cắt cụt (truncate) đường dẫn thư mục dài.

---

### MẪU 5: SPLIT-PILL COMPACT (1 Tầng Dạng Đảo Nổi Dynamic Island)
*Thiết kế hiện đại chuẩn phong cách macOS / iOS: gom các thành phần thành các cụm Capsule (Pill) nổi bật.*

#### Sơ đồ trực quan:
```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ [☰] ● hungpc ]   [ 📁 hugremote / >_ terminal-1 (3) ▾ ]   [ [🌐 VI] [+] [🔄] ]      │
│  └─ Cụm Server ─┘   └────── Cụm Phiên & Đường Dẫn ──────┘   └───── Cụm Phím Tác Vụ ────┘│
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Cấu trúc 3 khoang độc lập (Chiều cao 46px):**
  - **Khoang 1 (Trái):** Nền `#1e293b` bo tròn - kết hợp nút drawer `[☰]` và tên Server `● hungpc`.
  - **Khoang 2 (Giữa - Trọng tâm):** Viên con nhộng nổi viền neon xanh mờ `#3b82f6` hiển thị cả Project + Trạng thái phiên hiện tại (nhấn vào là menu trượt thả nhanh).
  - **Khoang 3 (Phải):** Khối nút tiện ích đồng màu với viền tinh tế.
- **Ưu điểm:** Thẩm mỹ rất cao, hiện đại, tạo chiều sâu thị giác (dimensional depth) đúng chuẩn phong cách thiết kế UI cao cấp mà bạn ưa chuộng.

---

## Bảng So Sánh Tóm Tắt

| Tiêu chí | Mẫu 1 (Single Compact) | Mẫu 2 (System Monitor) | Mẫu 3 (Quick Tabs) | Mẫu 4 (Command Path) | Mẫu 5 (Split-Pill) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Số tầng** | **1 Tầng (46px)** | 2 Tầng (60px) | 2 Tầng (60px) | 2 Tầng (62px) | **1 Tầng (46px)** |
| **Tiết kiệm diện tích** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Tận dụng chỗ trống** | Gom hết vào 1 dòng | Hiển thị CPU/RAM/Ping | Dãy tab chuyển nhanh | Đường dẫn đầy đủ | Gom dạng viên nang |
| **Trải nghiệm trên Mobile** | Cực kỳ tối ưu | Tốt | Cần cuộn ngang tab | Rất rõ ràng | Rất đẹp mắt |
| **Độ thẩm mỹ Dark Theme** | Tối giản, thanh lịch | Hầm hố, đậm chất server | Đa năng, tiện lợi | Trực quan, chuẩn mực | Hiện đại, có chiều sâu |

---
*Gợi ý từ trợ lý:* **Mẫu 1** hoặc **Mẫu 5** là lựa chọn tối ưu nhất nếu muốn giao diện thanh thoát, tiết kiệm tối đa chiều cao màn hình để dành đất cho Terminal và Claude; trong khi **Mẫu 2** hoặc **Mẫu 3** sẽ phù hợp nhất nếu bạn muốn biến hàng trên thành trung tâm thông tin đa năng.
