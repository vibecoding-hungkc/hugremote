import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export async function runUpdate(options = []) {
  if (
    options.includes('--help') ||
    options.includes('-h') ||
    options.includes('—help') ||
    options.includes('–help') ||
    options.includes('help')
  ) {
    console.log(`
🐴 HugRemote Updater

Sử dụng:
  hugremote update [options]

Tùy chọn:
  -f, --force    Bắt buộc kéo mã nguồn mới và biên dịch lại ngay cả khi đã ở commit mới nhất
  -h, --help     Hiển thị hướng dẫn này
`);
    return;
  }

  const force =
    options.includes('--force') ||
    options.includes('-f') ||
    options.includes('—force') ||
    options.includes('–force');

  console.log('\x1b[38;5;209m\x1b[1m');
  console.log('  _    _             _____                      _       ');
  console.log(' | |  | |           |  __ \\                    | |      ');
  console.log(' | |__| |_   _  __  | |__) |___ _ __ ___   ___ | |_ ___ ');
  console.log(' |  __  | | | |/ _` |  _  // _ \\ \'\\_` _ \\ / _ \\| __/ _ \\');
  console.log(' | |  | | |_| | (_| | | \\ \\  __/ | | | | | (_) | ||  __/');
  console.log(' |_|  |_|\\__,_|\\__, |_|  \\_\\___|_| |_| |_|\\___/ \\__\\___|');
  console.log('                __/ |                                   ');
  console.log('               |___/               Mobile-First Web IDE ');
  console.log('\x1b[0m');
  console.log('\x1b[34m========================================================\x1b[0m');
  console.log('\x1b[1m 🚀 Bắt đầu kiểm tra và cập nhật HugRemote...\x1b[0m');
  console.log('\x1b[34m========================================================\x1b[0m\n');

  const gitDir = path.join(rootDir, '.git');
  const isGitRepo = fs.existsSync(gitDir);

  if (isGitRepo) {
    let currentBranch = 'main';
    try {
      currentBranch =
        execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: rootDir,
          encoding: 'utf8',
        }).trim() || 'main';
    } catch (_) {}

    let currentCommit = '';
    try {
      currentCommit = execSync('git rev-parse --short HEAD', {
        cwd: rootDir,
        encoding: 'utf8',
      }).trim();
    } catch (_) {}

    let currentVersion = '1.0.1';
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
      );
      currentVersion = pkg.version || '1.0.1';
    } catch (_) {}

    console.log(
      `📌 Phiên bản hiện tại : \x1b[32mv${currentVersion}\x1b[0m (${currentCommit || 'local'})`
    );
    console.log(`🌿 Nhánh Git          : \x1b[34m${currentBranch}\x1b[0m`);
    console.log(`📂 Thư mục cài đặt    : ${rootDir}\n`);

    console.log('📡 Đang đồng bộ và kiểm tra commit mới từ GitHub...');
    try {
      execSync(`git fetch origin ${currentBranch}`, {
        cwd: rootDir,
        stdio: 'inherit',
      });
    } catch (err) {
      console.warn('⚠️  Không thể kết nối đến GitHub remote, kiểm tra commit cục bộ.');
    }

    let localHash = '';
    let remoteHash = '';
    try {
      localHash = execSync('git rev-parse HEAD', {
        cwd: rootDir,
        encoding: 'utf8',
      }).trim();
      remoteHash = execSync(`git rev-parse origin/${currentBranch}`, {
        cwd: rootDir,
        encoding: 'utf8',
      }).trim();
    } catch (_) {}

    if (localHash && remoteHash && localHash === remoteHash && !force) {
      console.log(
        `\n\x1b[32m✓ HugRemote đã ở phiên bản mới nhất (v${currentVersion} - ${currentCommit})!\x1b[0m`
      );
      console.log(
        '💡 Dùng \x1b[1mhugremote update --force\x1b[0m nếu bạn muốn ép buộc pull & biên dịch lại.'
      );
      restartServiceIfRunning();
      return;
    }

    if (localHash !== remoteHash) {
      console.log('⬇️  Phát hiện commit mới, đang tải mã nguồn...');
      try {
        execSync(`git pull origin ${currentBranch}`, {
          cwd: rootDir,
          stdio: 'inherit',
        });
      } catch (err) {
        console.error('❌ Lỗi khi git pull:', err.message);
        console.error('Vui lòng kiểm tra xung đột mã nguồn trong thư mục dự án.');
        process.exit(1);
      }
    } else {
      console.log('⚡ Chế độ ép buộc (--force): Tiến hành cài đặt dependencies và biên dịch lại...');
    }

    // Read updated package.json
    let newVersion = currentVersion;
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
      );
      newVersion = pkg.version || currentVersion;
    } catch (_) {}

    let newCommit = currentCommit;
    try {
      newCommit = execSync('git rev-parse --short HEAD', {
        cwd: rootDir,
        encoding: 'utf8',
      }).trim();
    } catch (_) {}

    console.log('\n📦 Đang biên dịch Client & Server (npm run build)...');
    try {
      execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
      console.log('✓ Biên dịch hoàn tất!');
    } catch (err) {
      console.error('❌ Lỗi khi biên dịch mã nguồn (npm run build):', err.message);
      process.exit(1);
    }

    ensureCliSymlinks(rootDir);
    restartServiceIfRunning();

    console.log(
      '\n\x1b[32m\x1b[1m========================================================\x1b[0m'
    );
    console.log(
      `\x1b[32m\x1b[1m 🎉 CẬP NHẬT HUGREMOTE THÀNH CÔNG LÊN v${newVersion} (${newCommit})!\x1b[0m`
    );
    console.log(
      '\x1b[32m\x1b[1m========================================================\x1b[0m\n'
    );
  } else {
    console.log('⚠️  Thư mục cài đặt hiện tại không phải là Git repository.');
    console.log('⬇️  Đang chạy script cập nhật tự động từ GitHub...');
    try {
      const cmd =
        'curl -fsSL https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/main/beta.sh | bash';
      execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
    } catch (err) {
      console.error('❌ Lỗi khi thực thi script cập nhật:', err.message);
      process.exit(1);
    }
  }
}

function restartServiceIfRunning() {
  try {
    const status = execSync('systemctl --user is-active hugremote.service 2>/dev/null', {
      encoding: 'utf8',
    }).trim();
    if (status === 'active') {
      console.log('\n🔄 Đang khởi động lại tiến trình nền (hugremote.service)...');
      execSync('systemctl --user restart hugremote.service', { stdio: 'inherit' });
      console.log('\x1b[32m✓ Đã khởi động lại dịch vụ hugremote thành công!\x1b[0m');
    }
  } catch (_) {}
}

function ensureCliSymlinks(projectRoot) {
  try {
    const targetBinDir = path.join(os.homedir(), '.local', 'bin');
    if (!fs.existsSync(targetBinDir)) {
      fs.mkdirSync(targetBinDir, { recursive: true });
    }
    const binSource = path.join(projectRoot, 'bin', 'hugremote.js');
    const targetHugremote = path.join(targetBinDir, 'hugremote');
    const targetHugcode = path.join(targetBinDir, 'hugcode');

    try {
      if (fs.existsSync(targetHugremote)) fs.unlinkSync(targetHugremote);
    } catch (_) {}
    fs.symlinkSync(binSource, targetHugremote);

    try {
      if (fs.existsSync(targetHugcode)) fs.unlinkSync(targetHugcode);
    } catch (_) {}
    fs.symlinkSync(binSource, targetHugcode);
  } catch (_) {}
}
