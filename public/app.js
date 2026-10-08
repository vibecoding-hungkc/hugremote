// ========================================================
// HugCode - Mobile Web IDE App Core Logic
// ========================================================

(function () {
  'use strict';

  // --- STATE ---
  let currentPath = ''; // Relative path from workspace
  let workspaceRoot = '';
  let openedFile = null; // { path, name, initialContent, isDirty }
  let term = null;
  let fitAddon = null;
  let termWs = null;
  let cm = null;

  let ctrlActive = false;
  let altActive = false;

  // --- DOM ELEMENTS ---
  const connBadge = document.getElementById('conn-badge');
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  const views = document.querySelectorAll('.view');
  
  // File DOM
  const fileBreadcrumb = document.getElementById('file-breadcrumb');
  const fileList = document.getElementById('file-list');
  const btnNewFile = document.getElementById('btn-new-file');
  const btnNewFolder = document.getElementById('btn-new-folder');
  const btnRefreshFiles = document.getElementById('btn-refresh-files');
  const btnRefreshAll = document.getElementById('btn-refresh-all');

  // Editor DOM
  const editorFilename = document.getElementById('editor-filename');
  const editorDirty = document.getElementById('editor-dirty');
  const btnSaveFile = document.getElementById('btn-save-file');
  const btnCloseFile = document.getElementById('btn-close-file');
  const editorPlaceholder = document.getElementById('editor-placeholder');
  const cmTarget = document.getElementById('cm-target');
  const navEditorBadge = document.getElementById('nav-editor-badge');

  // Terminal DOM
  const terminalContainer = document.getElementById('terminal-container');
  const termStatus = document.getElementById('term-status');
  const btnReconnectTerm = document.getElementById('btn-reconnect-term');
  const btnClearTerm = document.getElementById('btn-clear-term');
  const keyCtrl = document.getElementById('key-ctrl');
  const keyAlt = document.getElementById('key-alt');

  // Modal DOM
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalInput = document.getElementById('modal-input');
  const modalBtnCancel = document.getElementById('modal-btn-cancel');
  const modalBtnConfirm = document.getElementById('modal-btn-confirm');
  let modalCallback = null;

  // Toast
  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // --- INITIALIZATION ---
  window.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initCodeMirror();
    initTerminal();
    initTouchBar();
    initEditorKeybar();
    initModal();

    await fetchWorkspaceInfo();
    await loadDirectory('');
  });

  // --- NAVIGATION (MOBILE TABS) ---
  function initNavigation() {
    navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        switchView(targetId);
      });
    });

    btnRefreshAll.addEventListener('click', () => {
      loadDirectory(currentPath);
      showToast('Đã làm mới dữ liệu', 'info');
    });
  }

  function switchView(viewId) {
    views.forEach((v) => {
      if (v.id === viewId) {
        v.classList.add('active');
      } else {
        v.classList.remove('active');
      }
    });

    navItems.forEach((n) => {
      if (n.getAttribute('data-target') === viewId) {
        n.classList.add('active');
      } else {
        n.classList.remove('active');
      }
    });

    if (viewId === 'view-terminal') {
      setTimeout(() => {
        if (fitAddon && term) {
          fitAddon.fit();
          sendTerminalResize();
          term.focus();
        }
      }, 50);
    } else if (viewId === 'view-editor') {
      setTimeout(() => {
        if (cm) cm.refresh();
      }, 50);
    }
  }

  // --- WORKSPACE & FILE MANAGEMENT ---
  async function fetchWorkspaceInfo() {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const info = await res.json();
        workspaceRoot = info.workspace;
      }
    } catch (_) {}
  }

  async function loadDirectory(relPath = '') {
    fileList.innerHTML = '<li class="file-item loading">Đang tải...</li>';
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(relPath)}`);
      if (!res.ok) throw new Error('Không thể đọc thư mục');
      const data = await res.json();

      currentPath = data.currentRel;
      renderBreadcrumb(data.currentRel);
      renderFileList(data.entries, data.parentRel);
    } catch (err) {
      fileList.innerHTML = `<li class="file-item" style="color:var(--danger)">Lỗi: ${err.message}</li>`;
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  }

  function renderBreadcrumb(rel) {
    fileBreadcrumb.innerHTML = '';
    const homeCrumb = document.createElement('span');
    homeCrumb.className = 'crumb-item' + (!rel ? ' active' : '');
    homeCrumb.textContent = 'root';
    homeCrumb.addEventListener('click', () => loadDirectory(''));
    fileBreadcrumb.appendChild(homeCrumb);

    if (!rel) return;

    const parts = rel.split('/').filter(Boolean);
    let accumulated = '';
    parts.forEach((p, idx) => {
      accumulated = accumulated ? `${accumulated}/${p}` : p;
      const targetPath = accumulated;

      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '/';
      fileBreadcrumb.appendChild(sep);

      const crumb = document.createElement('span');
      crumb.className = 'crumb-item' + (idx === parts.length - 1 ? ' active' : '');
      crumb.textContent = p;
      crumb.addEventListener('click', () => loadDirectory(targetPath));
      fileBreadcrumb.appendChild(crumb);
    });

    fileBreadcrumb.scrollLeft = fileBreadcrumb.scrollWidth;
  }

  function renderFileList(entries, parentRel) {
    fileList.innerHTML = '';

    // Thư mục cha (..)
    if (parentRel !== null) {
      const upItem = document.createElement('li');
      upItem.className = 'file-item';
      upItem.innerHTML = `
        <div class="file-item-left">
          <span class="file-item-icon">📁</span>
          <div class="file-item-info">
            <span class="file-item-name">.. (Lên thư mục cha)</span>
          </div>
        </div>
      `;
      upItem.addEventListener('click', () => loadDirectory(parentRel));
      fileList.appendChild(upItem);
    }

    if (entries.length === 0 && parentRel === null) {
      fileList.innerHTML = '<li class="file-item">Thư mục trống</li>';
      return;
    }

    entries.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'file-item';

      const icon = item.isDirectory ? '📁' : getFileIcon(item.ext);
      const meta = item.isDirectory ? 'Thư mục' : formatSize(item.size);

      li.innerHTML = `
        <div class="file-item-left">
          <span class="file-item-icon">${icon}</span>
          <div class="file-item-info">
            <span class="file-item-name">${escapeHtml(item.name)}</span>
            <span class="file-item-meta">${meta}</span>
          </div>
        </div>
        <div class="file-item-actions">
          <button class="file-action-btn btn-rename" title="Đổi tên">✏️</button>
          <button class="file-action-btn btn-del" title="Xóa">🗑️</button>
        </div>
      `;

      // Click to open file / folder
      li.querySelector('.file-item-left').addEventListener('click', () => {
        if (item.isDirectory) {
          loadDirectory(item.relPath);
        } else {
          openFileInEditor(item.relPath);
        }
      });

      // Rename
      li.querySelector('.btn-rename').addEventListener('click', (e) => {
        e.stopPropagation();
        promptRename(item.relPath, item.name);
      });

      // Delete
      li.querySelector('.btn-del').addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDelete(item.relPath, item.name);
      });

      fileList.appendChild(li);
    });
  }

  function getFileIcon(ext) {
    switch (ext) {
      case '.js':
      case '.mjs':
      case '.ts': return '📜';
      case '.json': return '⚙️';
      case '.py': return '🐍';
      case '.sh':
      case '.bash': return '💻';
      case '.html':
      case '.htm': return '🌐';
      case '.css': return '🎨';
      case '.md': return '📝';
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.svg': return '🖼️';
      default: return '📄';
    }
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // --- ACTIONS: NEW FILE / FOLDER / RENAME / DELETE ---
  btnNewFile.addEventListener('click', () => {
    showModal('Tạo File Mới', 'example.js', async (val) => {
      if (!val) return;
      const targetRel = currentPath ? `${currentPath}/${val}` : val;
      try {
        const res = await fetch('/api/fs/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: targetRel, type: 'file' }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Lỗi tạo file');
        showToast(`Đã tạo file: ${val}`, 'success');
        loadDirectory(currentPath);
        openFileInEditor(targetRel);
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });

  btnNewFolder.addEventListener('click', () => {
    showModal('Tạo Thư Mục Mới', 'new_folder', async (val) => {
      if (!val) return;
      const targetRel = currentPath ? `${currentPath}/${val}` : val;
      try {
        const res = await fetch('/api/fs/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: targetRel, type: 'directory' }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Lỗi tạo thư mục');
        showToast(`Đã tạo thư mục: ${val}`, 'success');
        loadDirectory(currentPath);
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  });

  btnRefreshFiles.addEventListener('click', () => loadDirectory(currentPath));

  function promptRename(relPath, oldName) {
    showModal('Đổi tên', oldName, async (newName) => {
      if (!newName || newName === oldName) return;
      const dir = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '';
      const newRel = dir ? `${dir}/${newName}` : newName;
      try {
        const res = await fetch('/api/fs/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: relPath, newPath: newRel }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Lỗi đổi tên');
        showToast('Đổi tên thành công', 'success');
        loadDirectory(currentPath);
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  }

  async function confirmDelete(relPath, name) {
    if (!confirm(`Bạn có chắc muốn xóa "${name}" không?`)) return;
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(relPath)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi xóa file');
      showToast(`Đã xóa ${name}`, 'success');
      if (openedFile && openedFile.path === relPath) {
        closeFile();
      }
      loadDirectory(currentPath);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  // --- EDITOR MANAGEMENT (CodeMirror) ---
  function initCodeMirror() {
    cm = CodeMirror.fromTextArea(cmTarget, {
      lineNumbers: true,
      lineWrapping: true,
      theme: 'dracula',
      indentUnit: 2,
      tabSize: 2,
      viewportMargin: Infinity,
    });

    cm.on('change', () => {
      if (!openedFile) return;
      const dirty = cm.getValue() !== openedFile.initialContent;
      setDirty(dirty);
    });

    btnSaveFile.addEventListener('click', saveCurrentFile);
    btnCloseFile.addEventListener('click', closeFile);
  }

  function setDirty(isDirty) {
    if (!openedFile) return;
    openedFile.isDirty = isDirty;
    btnSaveFile.disabled = !isDirty;
    if (isDirty) {
      editorDirty.classList.remove('hidden');
      navEditorBadge.classList.remove('hidden');
    } else {
      editorDirty.classList.add('hidden');
      navEditorBadge.classList.add('hidden');
    }
  }

  async function openFileInEditor(relPath) {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(relPath)}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Không thể đọc file');
      const data = await res.json();

      openedFile = {
        path: relPath,
        name: data.name,
        initialContent: data.content,
        isDirty: false,
      };

      editorFilename.textContent = data.name;
      editorPlaceholder.style.display = 'none';

      const mode = detectMode(data.name);
      cm.setOption('mode', mode);
      cm.setValue(data.content);
      cm.clearHistory();

      setDirty(false);
      switchView('view-editor');
      setTimeout(() => cm.refresh(), 50);
    } catch (err) {
      showToast(`Lỗi mở file: ${err.message}`, 'error');
    }
  }

  async function saveCurrentFile() {
    if (!openedFile) return;
    const content = cm.getValue();
    try {
      btnSaveFile.disabled = true;
      btnSaveFile.textContent = 'Đang lưu...';

      const res = await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: openedFile.path, content }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi lưu file');

      openedFile.initialContent = content;
      setDirty(false);
      showToast('Đã lưu file thành công', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSaveFile.textContent = '💾 Lưu';
      btnSaveFile.disabled = !openedFile.isDirty;
    }
  }

  function closeFile() {
    if (openedFile && openedFile.isDirty) {
      if (!confirm('File có thay đổi chưa lưu. Bạn có chắc muốn đóng?')) return;
    }
    openedFile = null;
    editorFilename.textContent = 'Chưa chọn file';
    editorPlaceholder.style.display = 'flex';
    cm.setValue('');
    setDirty(false);
    btnSaveFile.disabled = true;
  }

  function detectMode(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'js':
      case 'mjs':
      case 'cjs': return 'javascript';
      case 'json': return { name: 'javascript', json: true };
      case 'py': return 'python';
      case 'sh':
      case 'bash': return 'shell';
      case 'html':
      case 'htm': return 'htmlmixed';
      case 'css': return 'css';
      case 'xml': return 'xml';
      case 'md':
      case 'markdown': return 'markdown';
      case 'yml':
      case 'yaml': return 'yaml';
      default: return 'text/plain';
    }
  }

  function initEditorKeybar() {
    document.querySelectorAll('.editor-keybar .key-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!cm) return;
        const key = btn.getAttribute('data-key');
        const char = btn.getAttribute('data-char');
        if (key === 'tab') {
          cm.replaceSelection('  ');
        } else if (key === 'undo') {
          cm.undo();
        } else if (key === 'redo') {
          cm.redo();
        } else if (char) {
          cm.replaceSelection(char);
        }
        cm.focus();
      });
    });
  }

  // --- TERMINAL MANAGEMENT (xterm.js + WebSocket) ---
  function initTerminal() {
    term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#090d16',
        foreground: '#e2e8f0',
        cursor: '#60a5fa',
        selectionBackground: 'rgba(59, 130, 246, 0.4)',
      },
      convertEol: true,
    });

    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainer);

    connectTerminalWs();

    term.onData((data) => {
      if (!termWs || termWs.readyState !== WebSocket.OPEN) return;

      if (ctrlActive) {
        ctrlActive = false;
        keyCtrl.classList.remove('active');
        // Convert 'c' -> '\x03', 'd' -> '\x04', etc.
        const code = data.charCodeAt(0);
        if (code >= 97 && code <= 122) { // a-z
          termWs.send(String.fromCharCode(code - 96));
          return;
        } else if (code >= 65 && code <= 90) { // A-Z
          termWs.send(String.fromCharCode(code - 64));
          return;
        }
      }

      if (altActive) {
        altActive = false;
        keyAlt.classList.remove('active');
        termWs.send('\x1b' + data);
        return;
      }

      termWs.send(data);
    });

    btnReconnectTerm.addEventListener('click', connectTerminalWs);
    btnClearTerm.addEventListener('click', () => {
      if (term) term.clear();
      if (termWs && termWs.readyState === WebSocket.OPEN) {
        termWs.send('\x0c'); // Formfeed / clear
      }
    });

    // Auto-fit on window & visual viewport resize
    const onResize = () => {
      if (fitAddon && term) {
        fitAddon.fit();
        sendTerminalResize();
      }
    };
    window.addEventListener('resize', onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize);
    }
  }

  function connectTerminalWs() {
    if (termWs) {
      try { termWs.close(); } catch (_) {}
    }

    termStatus.textContent = 'Đang kết nối...';
    connBadge.className = 'status-badge connecting';
    connBadge.textContent = '● Đang kết nối';

    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${location.host}/ws/terminal?cwd=${encodeURIComponent(currentPath || '')}`;

    termWs = new WebSocket(wsUrl);

    termWs.onopen = () => {
      termStatus.textContent = 'Đã kết nối';
      connBadge.className = 'status-badge connected';
      connBadge.textContent = '● Online';
      fitAddon.fit();
      sendTerminalResize();
      showToast('Terminal đã kết nối', 'success');
    };

    termWs.onmessage = (event) => {
      if (term) {
        term.write(event.data);
      }
    };

    termWs.onclose = () => {
      termStatus.textContent = 'Mất kết nối';
      connBadge.className = 'status-badge disconnected';
      connBadge.textContent = '● Offline';
      if (term) term.write('\r\n\x1b[33m[Kết nối terminal đã đóng]\x1b[0m\r\n');
    };

    termWs.onerror = () => {
      termStatus.textContent = 'Lỗi kết nối';
      connBadge.className = 'status-badge disconnected';
      connBadge.textContent = '● Lỗi';
    };
  }

  function sendTerminalResize() {
    if (termWs && termWs.readyState === WebSocket.OPEN && term) {
      termWs.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows,
      }));
    }
  }

  // --- TERMINAL TOUCH BAR ---
  function initTouchBar() {
    keyCtrl.addEventListener('click', () => {
      ctrlActive = !ctrlActive;
      keyCtrl.classList.toggle('active', ctrlActive);
    });

    keyAlt.addEventListener('click', () => {
      altActive = !altActive;
      keyAlt.classList.toggle('active', altActive);
    });

    document.querySelectorAll('.touch-bar .touch-btn[data-code]').forEach((btn) => {
      btn.addEventListener('click', () => {
        let rawCode = btn.getAttribute('data-code');
        // Unescape \x1b, \t, \r, \x03
        rawCode = rawCode
          .replace(/\\x1b/g, '\x1b')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '\r')
          .replace(/\\x03/g, '\x03');

        if (termWs && termWs.readyState === WebSocket.OPEN) {
          termWs.send(rawCode);
        }
        if (term) term.focus();
      });
    });
  }

  // --- MODAL DIALOG ---
  function initModal() {
    modalBtnCancel.addEventListener('click', closeModal);
    modalBtnConfirm.addEventListener('click', () => {
      const val = modalInput.value.trim();
      if (modalCallback) modalCallback(val);
      closeModal();
    });
    modalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = modalInput.value.trim();
        if (modalCallback) modalCallback(val);
        closeModal();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    });
  }

  function showModal(title, placeholder, cb) {
    modalTitle.textContent = title;
    modalInput.placeholder = placeholder || '';
    modalInput.value = '';
    modalCallback = cb;
    modal.classList.remove('hidden');
    setTimeout(() => modalInput.focus(), 50);
  }

  function closeModal() {
    modal.classList.add('hidden');
    modalInput.value = '';
    modalCallback = null;
  }
})();
