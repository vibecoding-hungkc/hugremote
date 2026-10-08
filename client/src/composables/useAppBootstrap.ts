import { onMounted } from 'vue';
import { useAuthStore } from '../stores/authStore.js';
import { useClaudeStore } from '../stores/claudeStore.js';
import { useFileStore } from '../stores/fileStore.js';
import { useServerStore } from '../stores/serverStore.js';

export function useAppBootstrap() {
  const authStore = useAuthStore();
  const serverStore = useServerStore();
  const fileStore = useFileStore();
  const claudeStore = useClaudeStore();

  async function bootstrap() {
    await authStore.fetchMe();
    if (!authStore.authenticated) return;
    await serverStore.fetchServers();
    await fileStore.fetchFiles('');
    await claudeStore.fetchSessions();
  }

  onMounted(bootstrap);

  return { authStore, bootstrap };
}
