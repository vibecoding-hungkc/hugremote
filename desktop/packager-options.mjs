import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveMacAppPath(results, name) {
  if (results.length !== 1) throw new Error(`Expected one packaged macOS app, got ${results.length}`);
  return path.join(results[0], `${name}.app`);
}
const requireDesktop = createRequire(new URL('./package.json', import.meta.url));

export function makePackagerOptions({ shellDir, output, payload, nodeDir, arch }) {
  return {
    dir: shellDir, out: output, overwrite: true, platform: 'darwin', arch,
    electronVersion: requireDesktop('electron/package.json').version,
    appBundleId: 'com.hugtech.hugremote', name: 'HugRemote', asar: false,
    icon: path.join(desktopDir, 'icon.icns'),
    extraResource: [payload, nodeDir],
  };
}
