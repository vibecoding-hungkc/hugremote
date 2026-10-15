import { fsService } from '../server/src/services/fsService.js';
import { parseSshConfig } from '../server/src/config.js';

async function testLive() {
  console.log('=== TEST LIVE REMOTE FS THỰC TẾ TRÊN REMOTE SERVER ===');
  const servers = parseSshConfig();
  const claudeServer = servers.find((s) => s.id === 'server-ssh-claude-server');
  if (!claudeServer) {
    console.error('Không tìm thấy server-ssh-claude-server');
    return;
  }

  console.log(`Kết nối tới ${claudeServer.name} (${claudeServer.host}:${claudeServer.port})...`);
  const testDir = `hugremote_probe_dir_${Date.now()}`;
  const testFile = `${testDir}/test_file.txt`;

  // 1. Tạo thư mục từ xa
  console.log(`1. Tạo thư mục từ xa: ${testDir}`);
  await fsService.createRemote(claudeServer, testDir, 'dir');
  console.log('-> Tạo thư mục từ xa thành công!');

  // 2. Tạo file bên trong thư mục từ xa
  console.log(`2. Tạo file từ xa: ${testFile}`);
  await fsService.createRemote(claudeServer, testFile, 'file');
  console.log('-> Tạo file từ xa thành công!');

  // 3. Ghi nội dung vào file từ xa
  console.log('3. Ghi nội dung vào file từ xa...');
  await fsService.writeRemoteFile(claudeServer, testFile, 'Xin chào từ HugRemote Live Test!');
  console.log('-> Ghi file thành công!');

  // 4. Đọc file từ xa
  console.log('4. Đọc file từ xa kiểm tra nội dung...');
  const fileContent = await fsService.readRemoteFile(claudeServer, testFile);
  console.log('-> Đọc thành công:', fileContent.content);

  // 5. Liệt kê file từ xa
  console.log('5. Liệt kê danh sách thư mục con...');
  const list = await fsService.listRemote(claudeServer, testDir);
  console.log('-> Danh sách file trong folder:', list.entries.map((e) => e.name));

  // 6. Đổi tên file từ xa
  const renamedFile = `${testDir}/renamed_file.txt`;
  console.log(`6. Đổi tên file từ xa thành: ${renamedFile}`);
  await fsService.renameRemote(claudeServer, testFile, renamedFile);
  console.log('-> Đổi tên file thành công!');

  // 7. Xóa toàn bộ thư mục từ xa
  console.log(`7. Xóa đệ quy thư mục từ xa: ${testDir}`);
  await fsService.deleteRemote(claudeServer, testDir);
  console.log('-> Xóa đệ quy thành công!');

  console.log('\n=== TẤT CẢ CÁC BƯỚC LIVE TEST TRÊN REMOTE SERVER ĐỀU THÀNH CÔNG 100% ===');
}

testLive().catch((err) => {
  console.error('LIVE TEST FAILED:', err);
  process.exit(1);
});
