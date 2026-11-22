import type { QueryClient } from '@tanstack/react-query';
import { filesApi } from '../../features/files/api/files.api';
import { isDirty, useFiles } from '../../features/files/files.store';
import { relToProject } from '../../lib/text';
import type { Project } from '../../types/schemas';

/**
 * `file_changed` (Claude vừa sửa file): file đang mở chưa sửa → tự tải lại + dải "Claude vừa sửa file này";
 * đang có sửa chưa lưu → chuyển sang xung đột (So sánh · Lấy bản trên máy · Giữ bản của tôi) — không ghi đè im lặng (AC-37).
 */
export async function onFileChanged(qc: QueryClient, d: Record<string, unknown>) {
  const projectId = String(d.projectId ?? '');
  const abs = String(d.path ?? '');
  void qc.invalidateQueries({ queryKey: ['git', projectId] });
  void qc.invalidateQueries({ queryKey: ['fsfiles', projectId] });
  const project = qc.getQueryData<Project>(['project', projectId]) ?? qc.getQueriesData<Project[]>({ queryKey: ['projects'] }).flatMap(([, l]) => l ?? []).find((p) => p.id === projectId);
  if (!project) return;
  const rel = relToProject(abs, project.rootPath);
  void qc.invalidateQueries({ queryKey: ['linechanges', projectId, rel] });
  const st = useFiles.getState();
  const f = st.byProject[projectId]?.open.find((x) => x.path === rel);
  if (!f) return;
  try {
    const r = await filesApi.read(projectId, rel);
    if (r.content === f.base) return;
    if (isDirty(f)) st.conflict(projectId, rel, r.mtime);
    else {
      st.reload(projectId, rel, r.content, r.mtime);
      st.touched(projectId, rel, true);
    }
  } catch {
    /* file bị xoá/đổi tên — để người dùng tự thấy khi lưu */
  }
}

