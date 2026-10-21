import fs from 'fs';
import path from 'path';
import os from 'os';
import { createApp } from '../apps/api/src/app.js';
import { tempZipService } from '../apps/api/src/services/tempZipService.js';

async function run() {
  console.log('Testing FS Download, Upload, and Auto-Cleanup...');
  const app = await createApp();
  await app.ready();

  const all = (await import('../apps/api/src/config.js')).parseSshConfig();
  const localServer = all.find((s) => s.id === 'server-local');
  const { projectService } = await import('../apps/api/src/services/projectService.js');
  const activeProj = projectService.getActiveProject('server-local');
  const baseWs = activeProj?.rootPath || localServer?.workspace || os.homedir();
  const testSubDir = `test_fs_${Date.now()}`;
  const tmpTestDir = path.join(baseWs, testSubDir);
  fs.mkdirSync(tmpTestDir, { recursive: true });

  try {
    // 1. Upload files
    console.log('--- TEST 1: Uploading files to target dir ---');
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="file1.txt"\r\nContent-Type: text/plain\r\n\r\nhello world from file 1\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${encodeURIComponent('nested/app.js')}"\r\nContent-Type: application/javascript\r\n\r\nconsole.log("nested file");\r\n`),
      Buffer.from(`--${boundary}--\r\n`),
    ]);

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/fs/upload?targetDir=${encodeURIComponent(testSubDir)}`,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    console.log('Upload response status:', uploadRes.statusCode, uploadRes.payload);
    if (uploadRes.statusCode !== 200) {
      throw new Error(`Upload failed: ${uploadRes.payload}`);
    }
    const uploadData = JSON.parse(uploadRes.payload);
    if (uploadData.count !== 2) {
      throw new Error(`Expected count 2, got ${uploadData.count}`);
    }

    // Verify files on disk
    const file1Path = path.join(tmpTestDir, 'file1.txt');
    const nestedAppPath = path.join(tmpTestDir, 'nested', 'app.js');
    if (!fs.existsSync(file1Path) || !fs.existsSync(nestedAppPath)) {
      throw new Error('Uploaded files not found on disk');
    }
    console.log('✓ Uploaded single file and nested directory file successfully');

    // 2. Download single file
    console.log('--- TEST 2: Downloading single file ---');
    const downloadFileRes = await app.inject({
      method: 'GET',
      url: `/api/fs/download?path=${encodeURIComponent(path.join(testSubDir, 'file1.txt'))}`,
    });

    if (downloadFileRes.statusCode !== 200) {
      throw new Error(`Download file failed: ${downloadFileRes.statusCode}`);
    }
    if (downloadFileRes.payload !== 'hello world from file 1') {
      throw new Error(`File content mismatch: ${downloadFileRes.payload}`);
    }
    console.log('✓ Downloaded single file with correct content');

    // 3. Download directory as Zip
    console.log('--- TEST 3: Downloading directory as Zip archive ---');
    const downloadDirRes = await app.inject({
      method: 'GET',
      url: `/api/fs/download?path=${encodeURIComponent(testSubDir)}`,
    });

    if (downloadDirRes.statusCode !== 200) {
      throw new Error(`Download dir failed: ${downloadDirRes.statusCode}`);
    }
    const contentType = downloadDirRes.headers['content-type'];
    const contentDisposition = downloadDirRes.headers['content-disposition'];
    const zipArchiveName = downloadDirRes.headers['x-zip-archive-name'] as string;

    if (contentType !== 'application/zip') {
      throw new Error(`Expected application/zip, got ${contentType}`);
    }
    if (!contentDisposition?.includes('attachment') || !contentDisposition?.includes('.zip')) {
      throw new Error(`Invalid Content-Disposition: ${contentDisposition}`);
    }
    if (!zipArchiveName) {
      throw new Error('Missing X-Zip-Archive-Name header');
    }
    console.log(`✓ Directory zipped and streamed as ${zipArchiveName} (${downloadDirRes.rawPayload.length} bytes)`);

    // Verify temp zip archive exists in temp downloads folder
    const tempDir = tempZipService.getTempDir();
    const tempZipPath = path.join(tempDir, zipArchiveName);
    if (!fs.existsSync(tempZipPath)) {
      throw new Error(`Expected cached zip at ${tempZipPath}`);
    }
    console.log(`✓ Zip archive verified in temp storage: ${tempZipPath}`);

    // 4. List temp archives API
    console.log('--- TEST 4: Listing temp archives ---');
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/fs/tmp-archives',
    });
    if (listRes.statusCode !== 200) {
      throw new Error(`List temp archives failed: ${listRes.statusCode}`);
    }
    const listData = JSON.parse(listRes.payload);
    const found = listData.archives.find((a: any) => a.id === zipArchiveName);
    if (!found) {
      throw new Error(`Zip archive ${zipArchiveName} not found in listing`);
    }
    console.log(`✓ Temp archives listed: found ${listData.archives.length} archive(s)`);

    // 5. Delete single archive API
    console.log('--- TEST 5: Deleting single temp archive ---');
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/fs/tmp-archives/${encodeURIComponent(zipArchiveName)}`,
    });
    if (deleteRes.statusCode !== 200) {
      throw new Error(`Delete archive failed: ${deleteRes.statusCode}`);
    }
    if (fs.existsSync(tempZipPath)) {
      throw new Error(`Expected archive to be deleted from disk: ${tempZipPath}`);
    }
    console.log('✓ Temp archive deleted successfully');

    // 6. Test purge all archives
    console.log('--- TEST 6: Purge all archives ---');
    // create a dummy archive first
    const dummyPath = path.join(tempDir, 'dummy-test.zip');
    fs.writeFileSync(dummyPath, Buffer.from('PK\x05\x06\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')); // empty zip

    const purgeRes = await app.inject({
      method: 'DELETE',
      url: '/api/fs/tmp-archives',
    });
    if (purgeRes.statusCode !== 200) {
      throw new Error(`Purge archives failed: ${purgeRes.statusCode}`);
    }
    if (fs.existsSync(dummyPath)) {
      throw new Error('Dummy archive was not purged');
    }
    console.log('✓ Purge all temp archives succeeded');

    // 7. Test auto-cleanup TTL and Quota logic
    console.log('--- TEST 7: Auto-cleanup TTL & Quota logic ---');
    const oldZip = path.join(tempDir, 'old-2026-01-01-abc.zip');
    fs.writeFileSync(oldZip, Buffer.from('test-old-content'));
    // Set mtime to 2 hours ago
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    fs.utimesSync(oldZip, twoHoursAgo / 1000, twoHoursAgo / 1000);

    const cleanupRes = tempZipService.cleanupOldZipArchives();
    if (fs.existsSync(oldZip)) {
      throw new Error('Old expired zip was not cleaned up');
    }
    if (cleanupRes.removedCount < 1) {
      throw new Error('Expected at least 1 file removed by auto-cleanup');
    }
    console.log(`✓ Auto-cleanup TTL passed: removed ${cleanupRes.removedCount} expired file(s)`);

    console.log('\nAll FS Download, Upload, and Auto-Cleanup tests PASSED! ✔');
  } finally {
    // cleanup test dir
    try {
      fs.rmSync(tmpTestDir, { recursive: true, force: true });
    } catch (_) {}
    await app.close();
  }
}

run().catch((err) => {
  console.error('Test FAILED:', err);
  process.exit(1);
});
