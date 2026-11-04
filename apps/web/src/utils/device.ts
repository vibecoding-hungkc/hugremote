import { ref, onMounted, onBeforeUnmount } from 'vue';

/**
 * Detects whether the current runtime is a Desktop device (PC / Mac / Linux desktop)
 * based on device hardware/OS & pointer capabilities — NOT screen/viewport dimensions.
 */
export function detectDesktopDevice(win: any = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!win || typeof win.navigator === 'undefined') {
    return false;
  }

  if (win.__HUGREMOTE_DEVICE_TYPE === 'desktop') return true;
  if (win.__HUGREMOTE_DEVICE_TYPE === 'mobile') return false;

  const nav = win.navigator as any;
  const ua = String(nav.userAgent || '');
  if (!ua || /^Node\.js/i.test(ua)) {
    return false;
  }

  // 1. User-Agent Client Hints (Chromium)
  if (nav.userAgentData && typeof nav.userAgentData.mobile === 'boolean') {
    if (nav.userAgentData.mobile) return false;
  }

  // 2. Mobile / Tablet User-Agent signatures
  const mobileUaRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Silk|Kindle|PlayBook|CriOS|FxiOS|EdgiOS/i;
  if (mobileUaRegex.test(ua)) {
    return false;
  }

  // 3. iPadOS 13+ desktop-class Safari (reports Macintosh + multi-touch hardware)
  const platform = String(nav.platform || '');
  if ((/Macintosh|MacIntel/i.test(ua) || /MacIntel/i.test(platform)) && Number(nav.maxTouchPoints || 0) > 1) {
    return false;
  }

  // 4. Touch-only device without hover capability (e.g., mobile/tablet with "Request Desktop Site" or DevTools mobile device emulation)
  if (typeof win.matchMedia === 'function') {
    try {
      if (win.matchMedia('(hover: none) and (pointer: coarse)').matches) {
        return false;
      }
    } catch (_) {}
  }

  // 5. Desktop OS User-Agent or fine pointer with hover
  if (/Windows NT|Macintosh|Mac OS X|X11;\s*(?:Linux|Ubuntu|Fedora|Arch|CrOS)|Linux x86_64|Linux aarch64|CrOS/i.test(ua)) {
    return true;
  }

  if (typeof win.matchMedia === 'function') {
    try {
      if (win.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches) {
        return true;
      }
    } catch (_) {}
  }

  return false;
}

export function useDesktopDevice() {
  const isDesktopDevice = ref(detectDesktopDevice());
  let mediaQuery: MediaQueryList | null = null;

  const syncDeviceType = () => {
    isDesktopDevice.value = detectDesktopDevice();
  };

  onMounted(() => {
    syncDeviceType();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncDeviceType);
      if (typeof window.matchMedia === 'function') {
        try {
          mediaQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
          mediaQuery.addEventListener?.('change', syncDeviceType);
        } catch (_) {}
      }
    }
  });

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', syncDeviceType);
    }
    mediaQuery?.removeEventListener?.('change', syncDeviceType);
  });

  return {
    isDesktopDevice,
    syncDeviceType,
  };
}
