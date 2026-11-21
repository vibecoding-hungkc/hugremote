---
type: architecture
tier: T0
status: DRAFT
last_reviewed: "2026-11-21"
---

# ARCHITECTURE — hugremote

> **Mỏng nhưng quyết đủ.** Đủ để agent tự quyết khi code mà không phải hỏi. Không phải HLD 20 trang.
> Cấu trúc §1–§5 lấy theo `intake/_ARCHITECTURE-TEMPLATE.md` để hai đường vào dùng chung một khung.
>
> **Cỡ hệ thống — khác nhau theo đường vào** ([VIPER.md §1.3](../VIPER.md), luật #5):
> - **Đường phỏng vấn**: một app, một DB, một nơi deploy — không micro-service. §1 đúng một dòng, §2 đúng một dòng, §3 ghi `—`.
> - **Đường intake**: đa target theo `intake/ARCHITECTURE.md` — mỗi boundary/experience một thư mục dưới `srcroot/boundaries/` · `srcroot/web-experiences/` · `srcroot/mobile-experiences/`. **Không tự đẻ target ngoài danh sách intake.**
>
> Xoá hết dấu `_CHƯA ĐIỀN_` khi điền xong.

---

## 1. Backend boundaries

<!-- Đường phỏng vấn: đúng MỘT dòng, tên `app`, "Sở hữu dữ liệu" ghi các thực thể ở §6.
     Đường intake: mỗi boundary trong intake/ARCHITECTURE.md §1 một dòng, GIỮ NGUYÊN tên
     — tên này là tên thư mục code srcroot/boundaries/<tên>/ ở pha I.
     Cột "Vòng": vòng nào giao boundary này (theo context/ROADMAP.md §1). -->

| Boundary | Nhiệm vụ (1 dòng) | Sở hữu dữ liệu | Vòng |
|---|---|---|---|
| _CHƯA ĐIỀN_ | | | |

## 2. Frontend experiences — web

<!-- Đường phỏng vấn: một dòng (hoặc ghi `—` nếu backend-only).
     Đường intake: theo intake/ARCHITECTURE.md §2; tên = thư mục srcroot/web-experiences/<tên>/.
     (§3 mobile tương tự, dưới srcroot/mobile-experiences/.)

     Cột "Design system" là NGUỒN ÁNH XẠ DUY NHẤT experience → gói design system, dùng
     bởi gate.py, hook guard_ds.py và thẻ vai dogfood `picky`. Giá trị = tên thư
     mục gói `intake/design-systems/<ds>/`. Tên experience ở cột đầu đồng thời là tên
     thư mục code `srcroot/<nhóm>/<tên>/` và thư mục `prototype/<tên>/` — chính nhờ vậy
     máy tra được file prototype nào phải theo bảng token nào.

     · Một design system (hoặc đường phỏng vấn) → để `—`, mọi phép kiểm chạy trên cả
       bảng token như trước, không phải khai gì thêm.
     · NHIỀU gói trong intake/design-systems/ → cột này BẮT BUỘC cho mọi dòng, bỏ trống
       là gate V đỏ. Hai experience dùng chung một gói là chuyện bình thường.

     Ví dụ (hai design system):
     | admin-console | P-OWNER | quản trị lịch, báo cáo | 1 | admin |
     | shop-web      | P-BUYER | đặt lịch, xem trạng thái | 2 | shop  | -->

| Experience | Persona | Năng lực lộ ra | Vòng | Design system |
|---|---|---|---|---|
| _CHƯA ĐIỀN_ | | | | — |

## 3. Frontend experiences — mobile

<!-- Không có mobile thì ghi `—` và xoá bảng. Cột "Design system": xem §2. -->

| Experience | Nền tảng | Persona | Vòng | Design system |
|---|---|---|---|---|
| — | | | | — |

## 4. Sơ đồ

```
_CHƯA ĐIỀN_
```

<!-- ASCII hoặc mermaid. Đường phỏng vấn chỉ cần: người dùng → app → DB → dịch vụ ngoài.
     Ví dụ:
       Người dùng ──► Next.js (Vercel) ──► Postgres (Neon)
                           ├──► Clerk (auth)
                           └──► Resend (email)

     Đường intake: giữ topology của intake/ARCHITECTURE.md §4 — experience → BFF (nếu có)
     → boundary → datastore, kèm hạ tầng ngoài đáng chú ý. -->

## 5. Contract giữa các target

<!-- CHỈ đường intake, và chỉ khi có nhiều hơn một target. Một app thì xoá bảng, ghi `—`:
     không có ranh giới nào để ký contract.
     Mỗi dòng = một mặt tiếp xúc mà bên khác bám vào. Đây cũng là nguồn của
     BACKWARD-COMPATIBILITY-CHECKLIST.md §1 từ vòng 2 — đổi ở đây là đổi hợp đồng. -->

| Contract | Bên cung cấp | Bên dùng | Kiểu | Vòng |
|---|---|---|---|---|
| — | | | | |

## 6. Mô hình dữ liệu lõi

<!-- Các thực thể chính + quan hệ + ràng buộc quan trọng. Đây là chỗ agent tra khi phân vân
     "field này để đâu", "cái này unique không". Ghi đủ để không phải hỏi.
     Đa target: một khối bảng cho mỗi boundary sở hữu dữ liệu, đặt tiêu đề ### <boundary>. -->

| Thực thể | Field chính | Quan hệ | Ràng buộc |
|---|---|---|---|
| _CHƯA ĐIỀN_ | | | |

**Ca biên đã quyết** (nguồn: `PRD.md §7`):

| Tình huống | Xử lý |
|---|---|
| Trùng dữ liệu | _CHƯA ĐIỀN_ |
| Xoá | _CHƯA ĐIỀN_ (xoá cứng / xoá mềm) |
| Sửa đồng thời | _CHƯA ĐIỀN_ |
| Gửi hai lần (double submit) | _CHƯA ĐIỀN_ |

## 7. Luồng lõi

<!-- Luồng end-to-end quan trọng nhất — cái mà pha I phải làm chạy được, và pha dogfood phải đi hết.
     Viết theo bước, kèm chỗ nào chạm DB, chỗ nào gọi ra ngoài, chỗ nào đi qua ranh giới target. -->

_CHƯA ĐIỀN_

```
1. …
2. …
3. …
```

## 8. Ranh giới module

<!-- Chia code thành mấy phần, phần nào được gọi phần nào. Ngăn agent để logic sai chỗ.
     Đường phỏng vấn — cấu trúc trong app duy nhất ở gốc repo:
       app/       routing + layout
       features/  theo tính năng: UI + hook + state cục bộ
       lib/       dùng chung: db client, auth, tiện ích
       server/    logic nghiệp vụ + truy cập DB   ← CHỈ chỗ này chạm DB
     Đường intake — cấu trúc BÊN TRONG mỗi srcroot/<nhóm>/<tên>/ (theo stack skill của target đó),
     cộng luật: target không import thẳng code của target khác, đi qua contract ở §5. -->

| Thư mục | Chứa gì | Được gọi bởi | Không được làm gì |
|---|---|---|---|
| _CHƯA ĐIỀN_ | | | |

Quy tắc chung không đổi:
- Chỉ **một tầng** được chạm DB. UI không query trực tiếp.
- Logic nghiệp vụ không nằm trong component.
- Gọi dịch vụ ngoài đi qua một chỗ duy nhất (dễ mock khi test, dễ đổi khi provider hỏng).

## 9. Dịch vụ ngoài

| Dịch vụ | Dùng để | Hỏng thì sao |
|---|---|---|
| _CHƯA ĐIỀN_ | | |

## 10. Thứ cố tình KHÔNG làm

<!-- Ghi rõ để agent không "tốt bụng" thêm vào: cache layer, queue, websocket, multi-tenant,
     i18n, dark mode... Vòng này không có nghĩa là không bao giờ — thứ nào cần thì vào ROADMAP. -->

- _CHƯA ĐIỀN_
