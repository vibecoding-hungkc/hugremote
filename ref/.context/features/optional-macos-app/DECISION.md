# Decisions — optional macOS app

- 2026-11-05: Chưa chọn desktop runtime; cần xác minh packaging của native `node-pty`, process cleanup, loopback-only security và quyền chạy GitHub macOS runner trước khi chốt. Bản web/CLI là sản phẩm chính, desktop chỉ là tùy chọn thêm.
- 2026-11-06: Đóng gói macOS phải ký lại ad-hoc (`codesign --sign -`) từ trong ra ngoài cho toàn bộ Mach-O binaries (`node`, `pty.node`, `spawn-helper`, `cpufeatures.node`) và toàn bộ `HugRemote.app` (bảo toàn entitlements của Electron), kiểm chứng bằng `codesign --verify --deep --strict --verbose=2`, đồng thời tạo bộ cài `.dmg` (`hdiutil create -format UDZO`) có sẵn lối tắt `/Applications` để kéo-thả cài đặt thay vì phát hành `.app` trần.
