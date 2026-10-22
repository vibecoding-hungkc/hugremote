import { onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/authStore.js';
import { useServerStore } from '../stores/serverStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useFileStore } from '../stores/fileStore.js';
import { useTerminalStore } from '../stores/terminalStore.js';
import { useClaudeStore } from '../stores/claudeStore.js';
import { useGitStore } from '../stores/gitStore.js';

export function useAppBootstrap() {
  const authStore = useAuthStore();
  const serverStore = useServerStore();
  const projectStore = useProjectStore();
  const fileStore = useFileStore();
  const terminalStore = useTerminalStore();
  const claudeStore = useClaudeStore();
  const gitStore = useGitStore();

  async function bootstrap() {
    await authStore.fetchMe();
    if (!authStore.authenticated || authStore.mustChangePassword) return;
    await serverStore.fetchServers();
    try {
      await projectStore.fetchProjects(serverStore.currentServerId);
    } catch (err: any) {
      fileStore.error = err.message || 'Không thể tải Project';
      return;
    }
    await fileStore.fetchFiles('');
    terminalStore.ensureServerSession();
    await Promise.all([
      claudeStore.fetchModels(serverStore.currentServerId),
      claudeStore.ensureProjectSession(),
    ]);
    await gitStore.fetchStatus();
  }

  onMounted(bootstrap);

  // Automatically bootstrap when user logs in or completes first-time password change
  watch(
    () => authStore.needsLogin,
    (needed, wasNeeded) => {
      if (wasNeeded && !needed && authStore.authenticated && !authStore.mustChangePassword) {
        bootstrap();
      }
    }
  );

  return { authStore, bootstrap };
}
