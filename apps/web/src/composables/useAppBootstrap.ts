import { onMounted } from 'vue';
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
    if (!authStore.authenticated) return;
    await serverStore.fetchServers();
    await projectStore.fetchProjects(serverStore.currentServerId);
    await fileStore.fetchFiles('');
    terminalStore.ensureServerSession();
    await Promise.all([
      claudeStore.fetchModels(serverStore.currentServerId),
      claudeStore.ensureProjectSession(),
    ]);
    await gitStore.fetchStatus();
  }

  onMounted(bootstrap);

  return { authStore, bootstrap };
}
