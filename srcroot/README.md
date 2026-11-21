# srcroot/ — nơi chứa code của ĐƯỜNG INTAKE

> Quy ước đầy đủ: [VIPER.md §1.3](../VIPER.md). Thư mục này chỉ dùng khi pha V
> đi bằng **đường intake** (Authority thả tài liệu MESH-render vào `intake/`).

## Ba nhóm, không phẳng

Cấu trúc phản chiếu đúng `context/ARCHITECTURE.md §1–§3` (dịch từ intake ARCHITECTURE),
để đọc tên thư mục là biết target thuộc tầng nào:

```
srcroot/
├── boundaries/           ← backend boundary        (ARCHITECTURE §1)
│   └── <boundary-name>/
├── web-experiences/      ← frontend web            (ARCHITECTURE §2)
│   └── <web-experience-name>/
└── mobile-experiences/   ← frontend mobile         (ARCHITECTURE §3)
    └── <mobile-experience-name>/
```

Ba thư mục nhóm **luôn tồn tại**, kể cả khi hệ thống không có mobile — thư mục rỗng rẻ
hơn việc mỗi vòng lại phải nhớ đặt target mới vào đâu. Thư mục
`<nhóm>/{{...-NAME}}/` trong template là **chỗ giữ nhịp**: đổi tên nó thành target thật
đầu tiên của nhóm, hoặc xoá đi nếu nhóm đó không có target nào.

## Quy ước

- **Tên thư mục = tên trong tài liệu.** Giữ nguyên tên boundary/experience của
  `context/ARCHITECTURE.md §1–§3`; đây cũng là tên `context/TECHSTACK.md §1` dùng cho
  khối `### Target:` và `intake/loops/l<N>/_PROPOSAL.md` dùng ở cột "Target".
- **Không tự đẻ thêm target** ngoài danh sách, và **không gộp hai target cho gọn** —
  ranh giới ở đường intake là "đúng danh sách intake", không phải "ít thư mục nhất"
  (luật #5).
- **Vòng nào dựng target nào** đọc ở `intake/loops/l<N>/_PROPOSAL.md` cột "Target" —
  vòng chỉ chạm hai target thì không scaffold sẵn tám cái ([VIPER.md §1.4](../VIPER.md)).
- **Scaffold từng target theo TECHSTACK của intake** (per-target), không theo default
  của stack skill — xem `/viper-implement` và [VIPER.md §1.3](../VIPER.md). Cấu trúc
  *bên trong* mỗi target vẫn theo `stack-<tên>/SKILL.md §3`.
- **Target không import thẳng code của target khác** — đi qua contract ở
  `context/ARCHITECTURE.md §5`. Đó cũng là thứ `BACKWARD-COMPATIBILITY-CHECKLIST.md §1`
  ghi lại từ vòng 2.

## Cái gì KHÔNG nằm ở đây

| Thứ | Nằm đâu | Vì sao |
|---|---|---|
| `Makefile` | gốc repo | Hợp đồng 6 lệnh là **một** cho cả hệ; thân từng lệnh điều phối xuống `make -C srcroot/<nhóm>/<tên> …`. Deploy luôn đi qua root `make deploy` — hook `guard_bc` canh ở đó |
| `docker-compose.yml`, seed dữ liệu, cấu hình chạy local | `deployment/local/` | DB local dùng chung cho mọi target; xem `deployment/README.md` |
| `.env.example` | `deployment/` | Một danh sách biến cho cả hệ, cột "Target" nói biến nào của ai |
| `prototype/<experience>/index.html` | `prototype/` | Tài liệu chốt IA của pha V, không phải code nền |

## Đường phỏng vấn thì sao?

Không dùng thư mục này. Đường phỏng vấn theo luật #5 — một app, một DB, một nơi
deploy — scaffold thẳng vào gốc repo theo `stack-<tên>/SKILL.md §3` (`src/`, `cmd/`…).
Thư mục này để trống, không cần xoá.

Ràng buộc "một app" đó là ràng buộc **tốc độ của bối cảnh một tuần**, không phải luật
chung của VIPER ([VIPER.md §0](../VIPER.md)). Sản phẩm cần nhiều target thật thì đường
đúng là intake, không phải lách luật #5 ở đường phỏng vấn.
