---
feature: claude-project-sessions-management
description: Add Project Sessions list button to Claude screen, and add rename & delete buttons on each project session item.
status: done
created: 2026-10-18
---

# Feature: Claude Project Sessions Management (View, Rename, Delete)

## Goal
Trong màn hình Claude, cung cấp nút mở danh sách phiên làm việc của dự án (Project Sessions từ `~/.claude/projects/`) và bổ sung nút Đổi tên (Rename), Xóa (Delete) trên từng session item.

## Scope
- In scope:
  - Backend API: `DELETE /api/claude/project-sessions/:id` và `PATCH /api/claude/project-sessions/:id` (rename).
  - Tầng dịch vụ `claudeService`: Quản lý xóa file `.jsonl` và lưu trữ tên tùy chỉnh qua file metadata `.hugremote-meta.json` + bản ghi `custom-title`.
  - Client Store (`claudeStore.ts`): Thêm `deleteProjectSession()` và `renameProjectSession()`.
  - Giao diện `ClaudeSessionHubModal.vue`: Bổ sung nút Rename & Delete trên mỗi thẻ phiên CLI (tab 1), hỗ trợ inline editing và xác nhận xóa an toàn.
  - Giao diện `ClaudeView.vue` & `SmartHeader.vue`: Bổ sung nút mở danh sách Project Sessions trực quan trên thanh điều khiển của màn Claude và empty state.
  - Kiểm thử tự động và kiểm thử E2E trên trình duyệt.

## Acceptance Criteria
- [x] AC1: Backend hỗ trợ endpoint `DELETE /api/claude/project-sessions/:id` xóa tệp `.jsonl` cục bộ (và từ xa qua SSH) thành công.
- [x] AC2: Backend hỗ trợ endpoint `PATCH /api/claude/project-sessions/:id` lưu tên mới và phản ánh ngay vào `summary`.
- [x] AC3: Giao diện `ClaudeSessionHubModal.vue` hiển thị nút Đổi tên (`ri-edit-line`) và Xóa (`ri-delete-bin-line`) trên từng item phiên CLI.
- [x] AC4: Màn hình `ClaudeView.vue` có nút xem danh sách phiên project trực tiếp ở thanh công cụ phía dưới và empty state.
- [x] AC5: Kiểm thử tự động và E2E xác nhận đổi tên và xóa hoạt động chính xác.

## Tasks
- [x] T1: Triển khai API xóa và đổi tên project session trong `claudeService.ts` và `api.ts`.
- [x] T2: Bổ sung methods `deleteProjectSession` và `renameProjectSession` trong `claudeStore.ts`.
- [x] T3: Nâng cấp `ClaudeSessionHubModal.vue` với inline rename và xác nhận xóa.
- [x] T4: Bổ sung nút xem danh sách phiên project trong `ClaudeView.vue` và `SmartHeader.vue`.
- [x] T5: Viết kiểm thử tự động, chạy build và kiểm thử E2E qua browser.
- [x] T6: Merge vào `main`, restart service và báo cáo kết quả.
