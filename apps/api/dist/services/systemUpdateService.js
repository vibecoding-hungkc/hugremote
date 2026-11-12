import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '../../../..');
const CANONICAL_REPO_URL = 'https://github.com/vibecoding-hungkc/hugremote.git';
const RAW_PACKAGE_JSON_URL = 'https://raw.githubusercontent.com/vibecoding-hungkc/hugremote/main/package.json';
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/vibecoding-hungkc/hugremote/releases/latest';
export function parseSemverTuple(ver) {
    const m = String(ver || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!m)
        return null;
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}
export function compareSemverStrings(a, b) {
    const tA = parseSemverTuple(a);
    const tB = parseSemverTuple(b);
    if (!tA || !tB)
        return String(a).localeCompare(String(b));
    if (tA[0] !== tB[0])
        return tA[0] - tB[0];
    if (tA[1] !== tB[1])
        return tA[1] - tB[1];
    return tA[2] - tB[2];
}
function readLocalPackageVersion(rootDir = APP_ROOT) {
    const candidates = [
        path.join(rootDir, 'package.json'),
        path.join(process.cwd(), 'package.json'),
    ];
    for (const file of candidates) {
        try {
            if (fs.existsSync(file)) {
                const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (pkg.version)
                    return String(pkg.version);
            }
        }
        catch { }
    }
    return '1.6.17';
}
function readLocalCommit(rootDir = APP_ROOT) {
    for (const dir of [rootDir, process.cwd()]) {
        try {
            if (fs.existsSync(path.join(dir, '.git'))) {
                const out = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
                    cwd: dir,
                    encoding: 'utf8',
                    timeout: 2000,
                    stdio: ['ignore', 'pipe', 'ignore'],
                }).trim();
                if (out)
                    return out;
            }
        }
        catch { }
    }
    try {
        const realRoot = fs.realpathSync(rootDir);
        const baseName = path.basename(realRoot);
        const m = baseName.match(/^\d+\.\d+\.\d+-([0-9a-f]{7,40})/i);
        if (m)
            return m[1].slice(0, 7);
    }
    catch { }
    try {
        const currentLink = path.join(os.homedir(), '.local', 'share', 'hugremote', 'current');
        if (fs.existsSync(currentLink)) {
            const realCurrent = fs.realpathSync(currentLink);
            const baseName = path.basename(realCurrent);
            const m = baseName.match(/^\d+\.\d+\.\d+-([0-9a-f]{7,40})/i);
            if (m)
                return m[1].slice(0, 7);
        }
    }
    catch { }
    return '';
}
function detectActiveChannel() {
    const channelFile = path.join(os.homedir(), '.local', 'share', 'hugremote', 'channel');
    try {
        if (fs.existsSync(channelFile)) {
            const raw = fs.readFileSync(channelFile, 'utf8').trim().toLowerCase();
            if (raw === 'stable')
                return 'stable';
            if (raw === 'beta')
                return 'beta';
        }
    }
    catch { }
    return 'beta';
}
async function fetchRemoteMainMetadata() {
    let commit = '';
    let version = '';
    try {
        const lsOut = execFileSync('git', ['ls-remote', '--quiet', CANONICAL_REPO_URL, 'refs/heads/main'], {
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        const firstHash = lsOut.split(/\s+/)[0] || '';
        if (/^[0-9a-f]{7,40}$/i.test(firstHash)) {
            commit = firstHash.slice(0, 7);
        }
    }
    catch { }
    try {
        const res = await fetch(RAW_PACKAGE_JSON_URL, {
            headers: { 'User-Agent': 'HugRemote-Updater' },
            signal: AbortSignal.timeout(4500),
        });
        if (res.ok) {
            const pkg = await res.json();
            if (pkg?.version)
                version = String(pkg.version);
        }
    }
    catch { }
    return { version, commit };
}
async function fetchLatestReleaseTag() {
    try {
        const res = await fetch(LATEST_RELEASE_API_URL, {
            headers: {
                'User-Agent': 'HugRemote-Updater',
                Accept: 'application/vnd.github.v3+json',
            },
            signal: AbortSignal.timeout(4500),
        });
        if (res.ok) {
            const data = await res.json();
            if (data?.tag_name)
                return String(data.tag_name);
        }
    }
    catch { }
    return '';
}
class SystemUpdateService {
    mockCheckProvider = null;
    mockUpdateRunner = null;
    updating = false;
    updateProgress = '';
    setMockCheckProviderForTest(fn) {
        this.mockCheckProvider = fn;
    }
    setMockUpdateRunnerForTest(fn) {
        this.mockUpdateRunner = fn;
    }
    async checkVersion(channelOverride) {
        if (this.mockCheckProvider) {
            return this.mockCheckProvider(channelOverride);
        }
        const channel = channelOverride || detectActiveChannel();
        const currentVersion = readLocalPackageVersion();
        const currentCommit = readLocalCommit();
        if (this.updating) {
            return {
                currentVersion,
                currentCommit,
                latestVersion: currentVersion,
                latestCommit: currentCommit,
                latestReleaseTag: `v${currentVersion}`,
                channel,
                hasUpdate: true,
                summary: this.updateProgress || 'Đang thực hiện cập nhật ở chế độ nền...',
                checkedAt: new Date().toISOString(),
                isDesktopApp: Boolean(process.env.HUGREMOTE_DESKTOP_SECRET),
                isUpdating: true,
                updateProgress: this.updateProgress,
            };
        }
        const [mainMeta, latestReleaseTag] = await Promise.all([
            fetchRemoteMainMetadata(),
            fetchLatestReleaseTag(),
        ]);
        const releaseVer = latestReleaseTag ? latestReleaseTag.replace(/^v/, '') : '';
        const latestVersion = channel === 'stable' && releaseVer
            ? releaseVer
            : mainMeta.version || releaseVer || currentVersion;
        const latestCommit = mainMeta.commit || currentCommit;
        const newerSemver = compareSemverStrings(latestVersion, currentVersion) > 0;
        const newerCommit = Boolean(latestCommit && currentCommit) &&
            !latestCommit.toLowerCase().startsWith(currentCommit.toLowerCase()) &&
            !currentCommit.toLowerCase().startsWith(latestCommit.toLowerCase());
        const hasUpdate = newerSemver || newerCommit;
        let summary = `Đang ở bản mới nhất v${currentVersion}${currentCommit ? ` · ${currentCommit}` : ''}`;
        if (hasUpdate) {
            if (newerSemver) {
                summary = `Có phiên bản mới v${latestVersion}${latestCommit ? ` · ${latestCommit}` : ''}`;
            }
            else {
                summary = `Có bản cập nhật mới v${latestVersion}${latestCommit ? ` · commit ${latestCommit}` : ''}`;
            }
        }
        return {
            currentVersion,
            currentCommit,
            latestVersion,
            latestCommit,
            latestReleaseTag: latestReleaseTag || `v${latestVersion}`,
            channel,
            hasUpdate,
            summary,
            checkedAt: new Date().toISOString(),
            isDesktopApp: Boolean(process.env.HUGREMOTE_DESKTOP_SECRET),
        };
    }
    async runQuickUpdate(options) {
        if (this.mockUpdateRunner) {
            return this.mockUpdateRunner(options);
        }
        const channel = options?.channel || detectActiveChannel();
        const previousVersion = readLocalPackageVersion();
        if (this.updating) {
            return {
                success: true,
                previousVersion,
                updatedVersion: previousVersion,
                updatedCommit: '',
                channel,
                restarting: false,
                message: this.updateProgress || 'Đang thực hiện cập nhật ở chế độ nền...',
                inProgress: true,
            };
        }
        this.updating = true;
        this.updateProgress = 'Đang bắt đầu cập nhật...';
        try {
            const cliUpdaterModuleUrl = new URL('../../../../bin/isolated-update.js', import.meta.url).href;
            const { installIsolatedRelease } = await import(/* @vite-ignore */ cliUpdaterModuleUrl);
            const latestTag = await fetchLatestReleaseTag();
            const useStableRelease = channel === 'stable' &&
                Boolean(latestTag) &&
                compareSemverStrings(latestTag.replace(/^v/, ''), previousVersion) > 0;
            const effectiveChannel = useStableRelease ? 'stable' : 'beta';
            const releaseRef = useStableRelease ? latestTag : 'main';
            let shouldRestartSystemd = false;
            const deferredService = {
                preflight: () => { },
                isActive: () => {
                    if (process.platform !== 'linux')
                        return false;
                    try {
                        const st = execSync('systemctl --user is-active hugremote.service 2>/dev/null', {
                            encoding: 'utf8',
                        }).trim();
                        return st === 'active';
                    }
                    catch {
                        return false;
                    }
                },
                getWorkingDirectory: () => path.join(os.homedir(), '.local', 'share', 'hugremote', 'current'),
                setWorkingDirectory: () => { },
                restart: () => {
                    shouldRestartSystemd = true;
                },
                waitUntilActive: () => true,
            };
            const result = installIsolatedRelease({
                sourceRoot: APP_ROOT,
                ref: releaseRef,
                channel: effectiveChannel,
                service: deferredService,
                onProgress: (step) => {
                    this.updateProgress = step;
                },
            });
            if (shouldRestartSystemd) {
                setTimeout(() => {
                    try {
                        execSync('systemctl --user restart hugremote.service', { stdio: 'ignore' });
                    }
                    catch { }
                }, 1200);
            }
            const shortCommit = String(result.commit || '').slice(0, 7);
            return {
                success: true,
                previousVersion,
                updatedVersion: String(result.version || previousVersion),
                updatedCommit: shortCommit,
                channel: effectiveChannel,
                restarting: shouldRestartSystemd,
                message: `Đã cập nhật thành công lên v${result.version}${shortCommit ? ` · ${shortCommit}` : ''}`,
            };
        }
        finally {
            this.updating = false;
            this.updateProgress = '';
        }
    }
}
export const systemUpdateService = new SystemUpdateService();
