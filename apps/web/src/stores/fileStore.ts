import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useServerStore } from './serverStore.js';
import { useProjectStore } from './projectStore.js';
import { apiUrl } from '../utils/api.js';

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  mtime: string | null;
  ext: string;
  relPath: string;
}

export interface ActiveFile {
  relPath: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
}

export const useFileStore = defineStore('file', () => {
  const currentRel = ref('');
  const parentRel = ref<string | null>(null);
  const entries = ref<FileEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const saveNotice = ref('');
  let saveNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  const activeFile = ref<ActiveFile | null>(null);
  const fileMode = ref<'code' | 'preview'>('code');

  const serverStore = useServerStore();
  const projectStore = useProjectStore();

  async function fetchFiles(path = '') {
    loading.value = true;
    error.value = null;
    try {
      const serverId = serverStore.currentServerId;
      const projectId = projectStore.currentProject?.id || '';
      const res = await fetch(apiUrl(`/api/fs?serverId=${encodeURIComponent(serverId)}&projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`));
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to list directory');
      }
      const data = await res.json();
      currentRel.value = data.currentRel || '';
      parentRel.value = data.parentRel;
      entries.value = data.entries || [];
    } catch (err: any) {
      error.value = err.message;
      entries.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function openFile(relPath: string) {
    loading.value = true;
    error.value = null;
    try {
      const serverId = serverStore.currentServerId;
      const projectId = projectStore.currentProject?.id || '';
      const res = await fetch(apiUrl(`/api/fs/read?serverId=${encodeURIComponent(serverId)}&projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(relPath)}`));
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to read file');
      }
      const data = await res.json();
      activeFile.value = {
        relPath,
        name: data.name,
        content: data.content,
        originalContent: data.content,
        isDirty: false,
      };

      const lowerName = data.name.toLowerCase();
      if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
        fileMode.value = 'preview';
      } else {
        fileMode.value = 'code';
      }
    } catch (err: any) {
      error.value = `Lỗi mở file: ${err.message}`;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function saveActiveFile() {
    if (!activeFile.value) return;
    try {
      const serverId = serverStore.currentServerId;
      const res = await fetch(apiUrl('/api/fs/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          projectId: projectStore.currentProject?.id || '',
          path: activeFile.value.relPath,
          content: activeFile.value.content,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save file');
      }
      activeFile.value.originalContent = activeFile.value.content;
      activeFile.value.isDirty = false;
      saveNotice.value = `Đã lưu ${activeFile.value.name}`;
      if (saveNoticeTimer) clearTimeout(saveNoticeTimer);
      saveNoticeTimer = setTimeout(() => { saveNotice.value = ''; }, 2400);
    } catch (err: any) {
      error.value = `Lỗi lưu file: ${err.message}`;
      throw err;
    }
  }

  function closeActiveFile() {
    activeFile.value = null;
  }

  async function createItem(name: string, type: 'file' | 'dir') {
    const serverId = serverStore.currentServerId;
    const targetPath = currentRel.value ? `${currentRel.value}/${name}` : name;
    const res = await fetch(apiUrl('/api/fs/action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        serverId,
        projectId: projectStore.currentProject?.id || '',
        path: targetPath,
        type,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create item');
    }
    await fetchFiles(currentRel.value);
  }

  async function deleteItem(relPath: string) {
    const serverId = serverStore.currentServerId;
    const res = await fetch(apiUrl('/api/fs/action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        serverId,
        projectId: projectStore.currentProject?.id || '',
        path: relPath,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete item');
    }
    await fetchFiles(currentRel.value);
  }

  async function renameItem(oldRel: string, newRel: string) {
    const serverId = serverStore.currentServerId;
    const res = await fetch(apiUrl('/api/fs/action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rename',
        serverId,
        projectId: projectStore.currentProject?.id || '',
        oldPath: oldRel,
        newPath: newRel,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to rename item');
    }
    await fetchFiles(currentRel.value);
  }

  // --- UPLOAD & DOWNLOAD ---
  const isUploading = ref(false);
  const uploadProgressText = ref('');
  const tempArchives = ref<Array<{ id: string; name: string; folderName: string; sizeStr: string; mtime: number; expiresAt: number }>>([]);

  function getDownloadUrl(relPath: string): string {
    const serverId = serverStore.currentServerId;
    const projectId = projectStore.currentProject?.id || '';
    return apiUrl(`/api/fs/download?serverId=${encodeURIComponent(serverId)}&projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(relPath)}`);
  }

  function downloadItem(relPath: string, fileName?: string) {
    const url = getDownloadUrl(relPath);
    const a = document.createElement('a');
    a.href = url;
    if (fileName) a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function uploadFiles(files: FileList | File[], targetRel?: string) {
    if (!files || files.length === 0) return { success: true, count: 0 };
    isUploading.value = true;
    uploadProgressText.value = `Đang tải lên ${files.length} tệp...`;
    error.value = null;

    try {
      const serverId = serverStore.currentServerId;
      const projectId = projectStore.currentProject?.id || '';
      const destRel = targetRel !== undefined ? targetRel : currentRel.value;

      const formData = new FormData();
      const fileArr = Array.from(files);

      fileArr.forEach((file) => {
        // webkitRelativePath exists for folder uploads
        const relPath = (file as any).webkitRelativePath || file.name;
        // encodeURIComponent to preserve directory slashes in multipart filename header
        formData.append('files', file, encodeURIComponent(relPath));
      });

      const url = apiUrl(`/api/fs/upload?serverId=${encodeURIComponent(serverId)}&projectId=${encodeURIComponent(projectId)}&targetDir=${encodeURIComponent(destRel)}`);
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Lỗi khi tải lên file');
      }

      const data = await res.json();
      saveNotice.value = `Đã tải lên ${data.count || fileArr.length} tệp thành công`;
      if (saveNoticeTimer) clearTimeout(saveNoticeTimer);
      saveNoticeTimer = setTimeout(() => { saveNotice.value = ''; }, 3000);

      await fetchFiles(currentRel.value);
      return data;
    } catch (err: any) {
      error.value = `Lỗi tải lên: ${err.message}`;
      throw err;
    } finally {
      isUploading.value = false;
      uploadProgressText.value = '';
    }
  }

  async function fetchTempArchives() {
    try {
      const res = await fetch(apiUrl('/api/fs/tmp-archives'));
      if (res.ok) {
        const data = await res.json();
        tempArchives.value = data.archives || [];
      }
    } catch (_) {}
  }

  async function purgeTempArchives() {
    try {
      const res = await fetch(apiUrl('/api/fs/tmp-archives'), { method: 'DELETE' });
      if (res.ok) {
        await fetchTempArchives();
      }
    } catch (_) {}
  }

  async function deleteTempArchive(id: string) {
    try {
      const res = await fetch(apiUrl(`/api/fs/tmp-archives/${encodeURIComponent(id)}`), { method: 'DELETE' });
      if (res.ok) {
        await fetchTempArchives();
      }
    } catch (_) {}
  }

  return {
    currentRel,
    parentRel,
    entries,
    loading,
    isUploading,
    uploadProgressText,
    tempArchives,
    error,
    saveNotice,
    activeFile,
    fileMode,
    fetchFiles,
    openFile,
    saveActiveFile,
    closeActiveFile,
    createItem,
    deleteItem,
    renameItem,
    getDownloadUrl,
    downloadItem,
    uploadFiles,
    fetchTempArchives,
    purgeTempArchives,
    deleteTempArchive,
  };
});
