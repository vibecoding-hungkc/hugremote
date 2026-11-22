#!/bin/bash
# Dự án mẫu cho dogfood (PRD §7): ~/projects/demo-api (repo 60 commit, có file đang sửa, remote bare) + demo-web
set -e
cd ~
git config --global user.name "Dev Demo"; git config --global user.email dev@demo.local; git config --global init.defaultBranch main
mkdir -p projects remotes && git init -q --bare remotes/demo-api.git
mkdir -p projects/demo-api/src/bookings projects/demo-api/test projects/demo-api/logs && cd projects/demo-api
git init -q && git remote add origin ~/remotes/demo-api.git
printf '# demo-api\n\nAPI đặt lịch mẫu cho HugRemote.\n' > README.md
printf 'node_modules/\ndist/\nlogs/\n.env\n' > .gitignore
printf 'PORT=3000\nSECRET=demo\n' > .env
printf '{\n  "name": "demo-api",\n  "version": "0.1.0",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
for i in $(seq 1 58); do echo "export const step$i = $i;" >> src/steps.ts; git add -A; git commit -qm "bước $i: thêm step$i"; done
cat > src/bookings/bookings.controller.ts <<'TS'
import { Controller, Get } from '@nestjs/common';

@Controller('bookings')
export class BookingsController {
  @Get()
  list() {
    return [];
  }
}
TS
git add -A && git commit -qm "thêm BookingsController" && git push -q -u origin main
printf '\n## Chạy\n\npnpm dev\n' >> README.md
echo "// TODO: service đặt lịch" > src/bookings/bookings.service.ts
for i in $(seq 1 30); do echo "[2026-11-21 10:$(printf %02d $i)] INFO request $i"; done > logs/app.log
echo "[2026-11-21 10:31] ERROR kết nối DB thất bại" >> logs/app.log
mkdir -p ~/projects/demo-web && cd ~/projects/demo-web && git init -q && printf '# demo-web\n' > README.md && git add -A && git commit -qm "khởi tạo"
