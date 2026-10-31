import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';

/** Chrome's install prompt event (not in the DOM typings). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** Set when the browser offers to install the app (Android / desktop Chrome and Edge). */
  installPrompt: InstallPromptEvent | null;
  /** Running as the installed app. */
  standalone: boolean;
  /** iOS Safari: installing is manual (Share → Add to Home Screen). */
  ios: boolean;
  /** A new version is downloaded and waits for the user's OK. */
  needRefresh: boolean;
  /** Everything needed offline is cached (shown once). */
  offlineReady: boolean;
  install: () => Promise<void>;
  update: () => void;
  dismiss: () => void;
}

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

export const usePwa = create<PwaState>((set, get) => ({
  installPrompt: null,
  standalone: standalone(),
  ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  needRefresh: false,
  offlineReady: false,
  install: async () => {
    const prompt = get().installPrompt;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // The event can only be used once.
    set({ installPrompt: null });
  },
  update: () => void updateSW?.(true),
  dismiss: () => set({ needRefresh: false, offlineReady: false }),
}));

/** Registers the service worker and listens for install events; call once at startup. */
export function setupPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep it for our own install button instead of the browser's mini-infobar.
    e.preventDefault();
    usePwa.setState({ installPrompt: e as InstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => usePwa.setState({ installPrompt: null }));
  window.matchMedia('(display-mode: standalone)').addEventListener('change', () => usePwa.setState({ standalone: standalone() }));
  updateSW = registerSW({
    onNeedRefresh: () => usePwa.setState({ needRefresh: true }),
    onOfflineReady: () => usePwa.setState({ offlineReady: true }),
  });
}
