# HugRemote Analysis & Protocol Research Artifacts

Thư mục tập hợp toàn bộ tài liệu nghiên cứu, ma trận năng lực (capability matrix), bằng chứng kiểm thử (evidence), bộ fixtures giao thức và spikes thực nghiệm sinh ra trong quá trình reverse-engineering và chuẩn hóa giao thức **Claude Code Protocol Parity (M0–M7)** cho HugRemote.

---

## Cấu trúc Thư mục

```
analysis/
├── claude-protocol/
│   ├── docs/
│   │   ├── response-evidence-manifest-v2.1.308.json   # Danh mục bằng chứng neo giữ theo CLI 2.1.308 & VSIX
│   │   ├── response-parity-matrix.json              # Ma trận năng lực 43 capabilities Claude Code
│   │   └── response-protocol-v2.1.308.md             # Đặc tả giao thức chuẩn hóa và ranh giới hệ thống
│   ├── fixtures/
│   │   └── 2.1.308/
│   │       ├── manifest.json                        # Metadata và mã băm SHA-256 của 44 fixtures
│   │       └── m1-*.jsonl                           # 44 file fixture khung hình NDJSON chuẩn hóa
│   └── spikes/
│       └── 001-duplex-interaction-spike/
│           └── README.md                            # Thực nghiệm cơ chế duplex stream-json stdin
└── prototypes/
    └── prototype.html                               # Bản mô phỏng giao diện web-first ban đầu
```

---

## Chi tiết các Thành phần

1. **`claude-protocol/docs/`**:
   - `response-evidence-manifest-v2.1.308.json`: Chứa các giá trị hash SHA-256 cố định, offset byte trong bytecode VSIX và CLI binary dùng làm oracle quy chuẩn tuyệt đối.
   - `response-parity-matrix.json`: Khai báo trạng thái hỗ trợ đầy đủ 43 khả năng giao thức (stream, deltas, system status, tools, duplex interaction, sequenced replay).
   - `response-protocol-v2.1.308.md`: Tài liệu đặc tả kỹ thuật chi tiết về khung truyền tin NDJSON, các schema sự kiện và quy tắc chuyển đổi trạng thái terminal.

2. **`claude-protocol/fixtures/`**:
   - Lưu trữ 44 tập dữ liệu mẫu JSONL đã được làm sạch hoàn toàn khỏi thông tin nhạy cảm, định danh người dùng thật, token hoặc đường dẫn tuyệt đối máy chủ.
   - Sử dụng cho các bài test hồi quy tự động: `test:claude-fixture-safety`, `test:claude-protocol-core`, `test:claude-protocol-fuzz`, `test:claude-differential`.

3. **`claude-protocol/spikes/`**:
   - Tài liệu ghi nhận kết quả thực nghiệm spike transport hai chiều (Duplex Transport Spike) với stdin pipe để điều khiển xác thực phân quyền và đối thoại người dùng.

4. **`prototypes/`**:
   - Lưu trữ bản dựng mẫu HTML/JS (`prototype.html`) phục vụ việc kiểm chứng trải nghiệm người dùng tương tác tệp trước khi tích hợp vào core Vue components.
