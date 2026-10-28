import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const REPO_OWNER = 'vibecoding-hungkc';
const REPO_NAME = 'hugremote';

export function parseSemver(tag) {
  const match = String(tag || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    raw: tag,
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

export function compareSemver(a, b) {
  const vA = parseSemver(a);
  const vB = parseSemver(b);
  if (!vA && !vB) return String(a).localeCompare(String(b));
  if (!vA) return -1;
  if (!vB) return 1;
  if (vA.major !== vB.major) return vA.major - vB.major;
  if (vA.minor !== vB.minor) return vA.minor - vB.minor;
  if (vA.patch !== vB.patch) return vA.patch - vB.patch;
  if (!vA.prerelease && vB.prerelease) return 1;
  if (vA.prerelease && !vB.prerelease) return -1;
  if (vA.prerelease && vB.prerelease) return vA.prerelease.localeCompare(vB.prerelease);
  return 0;
}

export function detectChannel(projectRoot, options = []) {
  // 1. Explicit CLI flags have highest priority
  if (
    options.includes('--beta') ||
    options.includes('—beta') ||
    options.includes('–beta') ||
    options.includes('--main') ||
    options.includes('—main')
  ) {
    return 'beta';
  }
  if (
    options.includes('--stable') ||
    options.includes('—stable') ||
    options.includes('–stable') ||
    options.includes('--release') ||
    options.includes('—release')
  ) {
    return 'stable';
  }

  // 2. Check process.env.UPDATE_CHANNEL
  if (process.env.UPDATE_CHANNEL) {
    const ch = process.env.UPDATE_CHANNEL.toLowerCase().trim();
    if (ch === 'beta' || ch === 'main') return 'beta';
    if (ch === 'stable' || ch === 'release') return 'stable';
  }

  // 3. Check .channel file in projectRoot
  const channelFile = path.join(projectRoot, '.channel');
  if (fs.existsSync(channelFile)) {
    try {
      const ch = fs.readFileSync(channelFile, 'utf8').trim().toLowerCase();
      if (ch === 'beta' || ch === 'main') return 'beta';
      if (ch === 'stable' || ch === 'release') return 'stable';
    } catch (_) {}
  }

  // 4. Inferred from git state:
  // If HEAD is detached or matches an exact tag -> stable
  try {
    const isExactTag = execSync('git describe --tags --exact-match 2>/dev/null', {
      cwd: projectRoot,
      encoding: 'utf8',
    }).trim();
    if (isExactTag) return 'stable';
  } catch (_) {}

  return 'beta';
}

export function installProjectDependencies(projectRoot, run = execSync) {
  run('npm ci --foreground-scripts', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}

export function stashLocalChanges(projectRoot, run = execSync, createMarker = () => crypto.randomUUID()) {
  const dirty = String(run('git status --porcelain', {
    cwd: projectRoot,
    encoding: 'utf8',
  }) || '').trim();
  if (!dirty) return null;

  const marker = String(createMarker());
  if (!/^[0-9A-Za-z-]{8,128}$/.test(marker)) {
    throw new Error('Marker backup không hợp lệ.');
  }
  const message = `hugremote-update-backup-${marker}`;
  run(`git stash push --include-untracked -m "${message}"`, {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  const stashList = String(run('git stash list --format="%H%x00%gs"', {
    cwd: projectRoot,
    encoding: 'utf8',
  }) || '');
  const matchingCommits = stashList
    .split(/\r?\n/)
    .map(line => line.split('\u0000'))
    .filter(([commit, subject]) => /^[0-9a-f]{40,64}$/.test(commit) && subject?.endsWith(message))
    .map(([commit]) => commit);
  if (matchingCommits.length !== 1) {
    throw new Error('Không xác định duy nhất được commit backup vừa tạo.');
  }
  return matchingCommits[0];
}

export function restoreLocalChanges(projectRoot, stashCommit, run = execSync) {
  if (!/^[0-9a-f]{40,64}$/.test(stashCommit)) {
    throw new Error('Commit backup không hợp lệ.');
  }
  run(`git stash apply --index ${stashCommit}`, {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}

export function assertBetaUpdateBranch(branch) {
  if (branch !== 'main') {
    throw new Error(`Kênh Beta chỉ cập nhật trực tiếp trên branch main; branch hiện tại: ${branch}`);
  }
  return branch;
}

export function assertSafeReleaseTag(tag) {
  if (!/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error(`Release tag không hợp lệ: ${tag}`);
  }
  return tag;
}

export async function fetchLatestGitHubRelease(repo = `${REPO_OWNER}/${REPO_NAME}`) {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'HugRemote-Updater',
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.tag_name) {
        return {
          tag: data.tag_name,
          name: data.name || data.tag_name,
          publishedAt: data.published_at,
          htmlUrl: data.html_url,
          body: data.body,
        };
      }
    }
  } catch (_) {}
  return null;
}

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
  --stable, --release   Cập nhật theo bản Release chính thức mới nhất từ GitHub
  --beta, --main        Cập nhật theo mã nguồn mới nhất từ nhánh 'main'
  -f, --force           Bắt buộc tải lại mã nguồn và biên dịch lại toàn bộ
  -n, --dry-run         Chỉ kiểm tra phiên bản và kênh cập nhật, không sửa đổi file
  -h, --help            Hiển thị hướng dẫn này
`);
    return;
  }

  const dryRun =
    options.includes('--dry-run') ||
    options.includes('—dry-run') ||
    options.includes('–dry-run') ||
    options.includes('-n');

  const force =
    options.includes('--force') ||
    options.includes('-f') ||
    options.includes('—force') ||
    options.includes('–force');

  const channel = detectChannel(rootDir, options);

  // If user explicitly specified channel flag, persist to .channel file
  if (!dryRun && options.some((o) => ['--beta', '—beta', '--main', '--stable', '—stable', '--release'].includes(o))) {
    try {
      fs.writeFileSync(path.join(rootDir, '.channel'), channel, 'utf8');
    } catch (_) {}
  }

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
    let currentCommit = '';
    try {
      currentCommit = execSync('git rev-parse --short HEAD', {
        cwd: rootDir,
        encoding: 'utf8',
      }).trim();
    } catch (_) {}

    let currentVersion = '1.1.1';
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
      );
      currentVersion = pkg.version || '1.1.1';
    } catch (_) {}

    let currentTag = '';
    try {
      currentTag = execSync('git describe --tags --exact-match 2>/dev/null', {
        cwd: rootDir,
        encoding: 'utf8',
      }).trim();
    } catch (_) {}

    console.log(`📌 Phiên bản hiện tại : \x1b[32mv${currentVersion}\x1b[0m (${currentTag ? `tag: ${currentTag}` : `commit: ${currentCommit}`})`);
    console.log(`📡 Kênh cập nhật      : \x1b[35m\x1b[1m${channel === 'stable' ? 'Stable (Bản Release chính thức từ GitHub)' : 'Beta (Nhánh main)'}\x1b[0m`);
    console.log(`📂 Thư mục cài đặt    : ${rootDir}\n`);

    let localBackupCommit = null;

    if (channel === 'stable') {
      // STABLE CHANNEL: Check against official GitHub Releases
      console.log('🔍 Đang kiểm tra bản Release chính thức mới nhất từ GitHub...');
      const release = await fetchLatestGitHubRelease();
      if (!release) {
        console.warn('⚠️  Không thể kết nối tới GitHub Releases API, đang kiểm tra tags git...');
      }

      // Fetch git tags
      try {
        execSync('git fetch --tags origin', { cwd: rootDir, stdio: 'inherit' });
      } catch (err) {
        console.warn('⚠️  Không thể fetch tags từ remote.');
      }

      let targetReleaseTag = release ? release.tag : '';
      if (!targetReleaseTag) {
        // Fallback: get highest semver tag
        try {
          const rawTags = execSync('git tag -l "v*"', { cwd: rootDir, encoding: 'utf8' })
            .split(/\r?\n/)
            .filter(Boolean);
          const sorted = rawTags.sort(compareSemver);
          targetReleaseTag = sorted[sorted.length - 1];
        } catch (_) {}
      }

      if (!targetReleaseTag) {
        console.error('❌ Không tìm thấy bản Release nào trên GitHub.');
        process.exit(1);
      }

      try {
        targetReleaseTag = assertSafeReleaseTag(targetReleaseTag);
      } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
      }

      console.log(`🏷️  Bản Release mới nhất : \x1b[32m\x1b[1m${targetReleaseTag}\x1b[0m${release && release.name ? ` (${release.name})` : ''}`);

      let targetCommit = '';
      try {
        targetCommit = execSync(`git rev-list -n 1 tags/${targetReleaseTag}`, { cwd: rootDir, encoding: 'utf8' }).trim();
      } catch (_) {}

      const localHead = execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
      const isAlreadyLatestRelease =
        currentTag === targetReleaseTag ||
        ('v' + currentVersion === targetReleaseTag) ||
        (targetCommit && localHead === targetCommit);

      if (dryRun) {
        console.log(`\n🧪 [Dry-Run] Kênh Stable: Mục tiêu Release ${targetReleaseTag}. Bỏ qua checkout, build và restart dịch vụ.`);
        return;
      }

      if (isAlreadyLatestRelease && !force) {
        console.log(`\n\x1b[32m✓ HugRemote đã ở bản Release mới nhất (${targetReleaseTag})!\x1b[0m`);
        console.log('💡 Dùng \x1b[1mhugremote update --force\x1b[0m nếu bạn muốn ép buộc tải & biên dịch lại.');
        restartServiceIfRunning();
        return;
      }

      console.log(`\n⬇️  Đang tải và chuyển sang bản Release \x1b[32m${targetReleaseTag}\x1b[0m...`);
      try {
        localBackupCommit = stashLocalChanges(rootDir);
        execSync(`git checkout tags/${targetReleaseTag} 2>/dev/null || git checkout -B release tags/${targetReleaseTag}`, {
          cwd: rootDir,
          stdio: 'inherit',
        });
      } catch (err) {
        if (localBackupCommit) {
          console.warn(`⚠️  Thay đổi cục bộ được giữ an toàn trong backup ${localBackupCommit}.`);
        }
        console.error(`❌ Lỗi khi checkout release ${targetReleaseTag}:`, err.message);
        process.exit(1);
      }
    } else {
      // BETA CHANNEL: Check against latest main branch
      console.log('📡 Đang đồng bộ và kiểm tra commit mới nhất từ nhánh main...');
      try {
        execSync('git fetch origin main', { cwd: rootDir, stdio: 'inherit' });
      } catch (err) {
        console.warn('⚠️  Không thể kết nối đến GitHub remote, kiểm tra commit cục bộ.');
      }

      let localHash = '';
      let remoteHash = '';
      try {
        localHash = execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
        remoteHash = execSync('git rev-parse origin/main', { cwd: rootDir, encoding: 'utf8' }).trim();
      } catch (_) {}

      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();

      if (dryRun) {
        console.log(`\n🧪 [Dry-Run] Kênh Beta: Nhánh main (remote ${remoteHash.slice(0, 7) || 'N/A'}, local ${localHash.slice(0, 7)}). Bỏ qua checkout, build và restart dịch vụ.`);
        return;
      }

      if (currentBranch === 'main' && localHash && remoteHash && localHash === remoteHash && !force) {
        console.log(`\n\x1b[32m✓ HugRemote đã ở bản Beta mới nhất trên nhánh main (${currentCommit})!\x1b[0m`);
        console.log('💡 Dùng \x1b[1mhugremote update --force\x1b[0m nếu bạn muốn ép buộc pull & biên dịch lại.');
        restartServiceIfRunning();
        return;
      }

      console.log('⬇️  Đang tải mã nguồn mới nhất từ nhánh main...');
      try {
        assertBetaUpdateBranch(currentBranch);
        localBackupCommit = stashLocalChanges(rootDir);
        execSync('git pull origin main', { cwd: rootDir, stdio: 'inherit' });
      } catch (err) {
        if (localBackupCommit) {
          console.warn(`⚠️  Thay đổi cục bộ được giữ an toàn trong backup ${localBackupCommit}.`);
        }
        console.error('❌ Lỗi khi git pull:', err.message);
        process.exit(1);
      }
    }

    // Read updated package.json
    let newVersion = currentVersion;
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
      );
      newVersion = pkg.version || currentVersion;
    } catch (_) {}

    let newCommit = execSync('git rev-parse --short HEAD', {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();

    console.log('\n📦 Đang đồng bộ thư viện theo mã nguồn vừa cập nhật (npm install)...');
    try {
      installProjectDependencies(rootDir);
      console.log('✓ Thư viện đã được đồng bộ!');
    } catch (err) {
      if (localBackupCommit) {
        console.warn(`⚠️  Thay đổi cục bộ được giữ an toàn trong backup ${localBackupCommit}.`);
      }
      console.error('❌ Lỗi khi cài đặt thư viện (npm install):', err.message);
      process.exit(1);
    }

    console.log('\n📦 Đang biên dịch Client & Server (npm run build)...');
    try {
      execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
      console.log('✓ Biên dịch hoàn tất!');
    } catch (err) {
      if (localBackupCommit) {
        console.warn(`⚠️  Thay đổi cục bộ được giữ an toàn trong backup ${localBackupCommit}.`);
      }
      console.error('❌ Lỗi khi biên dịch mã nguồn (npm run build):', err.message);
      process.exit(1);
    }

    if (localBackupCommit) {
      try {
        restoreLocalChanges(rootDir, localBackupCommit);
        console.log('✓ Đã khôi phục chính xác nội dung và trạng thái staged trước khi cập nhật.');
        console.log(`✓ Backup an toàn vẫn được giữ trong git stash tại commit ${localBackupCommit}.`);
      } catch (err) {
        console.error('❌ Mã nguồn đã build nhưng không thể khôi phục đầy đủ thay đổi cục bộ.');
        console.error(`   Backup vẫn được giữ tại commit ${localBackupCommit}; dịch vụ chưa được restart.`);
        process.exit(1);
      }
    }

    ensureCliSymlinks(rootDir);
    restartServiceIfRunning();

    console.log(
      '\n\x1b[32m\x1b[1m========================================================\x1b[0m'
    );
    console.log(
      `\x1b[32m\x1b[1m 🎉 CẬP NHẬT HUGREMOTE THÀNH CÔNG LÊN v${newVersion} (${channel === 'stable' ? 'Release' : 'Beta'} - ${newCommit})!\x1b[0m`
    );
    console.log(
      '\x1b[32m\x1b[1m========================================================\x1b[0m\n'
    );
  } else {
    console.log('⚠️  Thư mục cài đặt hiện tại không phải là Git repository.');
    const scriptUrl =
      channel === 'stable'
        ? 'https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/main/install.sh'
        : 'https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/main/beta.sh';
    console.log(`⬇️  Đang chạy script cập nhật từ GitHub (${scriptUrl})...`);
    try {
      const cmd = `curl -fsSL ${scriptUrl} | bash`;
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
