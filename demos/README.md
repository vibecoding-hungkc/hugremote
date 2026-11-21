# demos/ — file demo cuối vòng

Pha R của mọi vòng quay một video đi trọn kịch bản demo của vòng trên sản phẩm thật
([VIPER.md §1.5](../VIPER.md), `/viper-repeat` Bước 2). File của vòng N nằm ở `demos/vong-<N>/` —
một thư mục mỗi vòng, đánh số nên tự nó là lưu trữ (giống `intake/loops/l<N>/`), không move đi đâu.

| File | Khi nào | Quay bằng | Commit? |
|---|---|---|---|
| `<experience>.webm` | experience web | server `browser` — `browser_start_video` … `browser_stop_video` (skill `viper-browse` §7) | Không — `.gitignore` |
| `<experience>.mp4` | experience mobile | `mobile_start_screen_recording` / `mobile_stop_screen_recording` (skill `viper-mobile` §7) | Không — `.gitignore` |
| `<target>.log` | backend-only (`KHÔNG CÓ UI`) | bản ghi terminal: lệnh + output nguyên văn | Có — text nhỏ |

Video nặng nên không vào git; vết trong git là sổ `context/DEMOS.md` (ngày quay, môi trường, commit,
bước ↔ AC ↔ kết quả). Muốn giữ cả video trong repo thì dùng Git LFS — sửa `.gitignore` + một dòng
`DECISIONS.md`. Tải video lên đâu đó hay gửi link cho người ngoài là hành động hướng ra ngoài: Authority
tự làm hoặc chốt.
