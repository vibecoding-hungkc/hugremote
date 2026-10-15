import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from '../server/node_modules/fastify/fastify.js';
import { apiRoutes } from '../server/src/routes/api.js';
import { fsService } from '../server/src/services/fsService.js';
import { parseSshConfig } from '../server/src/config.js';

test('Live Remote SSH Docker Container FS Operations & HTTP API Routes', async (t) => {
  const servers = parseSshConfig();
  const box = servers.find((s) => s.name === 'docker-test-box');
  assert.ok(box, 'Máy chủ docker-test-box phải được cấu hình trong ~/.ssh/config');

  const fastify = Fastify();
  await fastify.register(apiRoutes);
  await fastify.ready();

  t.after(async () => {
    await fastify.close();
  });

  // 1. Tạo file từ xa qua API
  const testFileName = `test_file_${Date.now()}.txt`;
  const resCreateFile = await fastify.inject({
    method: 'POST',
    url: '/api/fs/action',
    payload: {
      serverId: box.id,
      action: 'create',
      path: testFileName,
      type: 'file',
    },
  });
  assert.strictEqual(resCreateFile.statusCode, 200, 'HTTP POST create file phải trả về 200 OK');
  assert.deepStrictEqual(JSON.parse(resCreateFile.body), { success: true });

  // 2. Ghi nội dung vào file từ xa
  const writeRes = await fsService.writeRemoteFile(box, testFileName, 'Xin chào từ Docker SSH Container!');
  assert.ok(writeRes.size > 0, 'File phải ghi thành công có size > 0');

  // 3. Đọc nội dung file từ xa
  const readRes = await fsService.readRemoteFile(box, testFileName);
  assert.strictEqual(readRes.content, 'Xin chào từ Docker SSH Container!');

  // 4. Liệt kê danh sách file qua API GET /api/fs
  const resList = await fastify.inject({
    method: 'GET',
    url: `/api/fs?serverId=${box.id}`,
  });
  assert.strictEqual(resList.statusCode, 200);
  const listData = JSON.parse(resList.body);
  assert.ok(listData.entries.some((e: any) => e.name === testFileName), 'File vừa tạo phải xuất hiện trong danh sách');

  // 5. Đổi tên file từ xa qua API
  const renamedFileName = `renamed_${testFileName}`;
  const resRename = await fastify.inject({
    method: 'POST',
    url: '/api/fs/action',
    payload: {
      serverId: box.id,
      action: 'rename',
      oldPath: testFileName,
      newPath: renamedFileName,
    },
  });
  assert.strictEqual(resRename.statusCode, 200);

  // 6. Xóa file từ xa qua API
  const resDeleteFile = await fastify.inject({
    method: 'POST',
    url: '/api/fs/action',
    payload: {
      serverId: box.id,
      action: 'delete',
      path: renamedFileName,
    },
  });
  assert.strictEqual(resDeleteFile.statusCode, 200);

  // 7. Tạo thư mục con và file lồng nhau
  const testDirName = `test_dir_${Date.now()}`;
  const resCreateDir = await fastify.inject({
    method: 'POST',
    url: '/api/fs/action',
    payload: {
      serverId: box.id,
      action: 'create',
      path: testDirName,
      type: 'dir',
    },
  });
  assert.strictEqual(resCreateDir.statusCode, 200);

  // Tạo file bên trong thư mục con
  const nestedFilePath = `${testDirName}/nested.json`;
  const resCreateNested = await fastify.inject({
    method: 'POST',
    url: '/api/fs/action',
    payload: {
      serverId: box.id,
      action: 'create',
      path: nestedFilePath,
      type: 'file',
    },
  });
  assert.strictEqual(resCreateNested.statusCode, 200);

  // Xóa đệ quy toàn bộ thư mục qua API
  const resDeleteDir = await fastify.inject({
    method: 'POST',
    url: '/api/fs/action',
    payload: {
      serverId: box.id,
      action: 'delete',
      path: testDirName,
    },
  });
  assert.strictEqual(resDeleteDir.statusCode, 200);

  console.log('✓ Hoàn thành kiểm thử thực tế trên Docker SSH Server: Tạo file, Ghi, Đọc, Đổi tên, Tạo thư mục, Xóa đệ quy đều thành công 100%!');
  process.exit(0);
});
