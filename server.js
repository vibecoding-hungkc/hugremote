const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pty = require('node-pty');

const PORT = parseInt(process.env.PORT || '8099', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Mặc định workspace là thư mục dự án hugcode
const DEFAULT_WORKSPACE = process.env.WORKSPACE_ROOT || path.resolve(__dirname);
// Thư mục gốc tối đa cho phép duyệt (toàn bộ home dir để linh hoạt)
const ALLOWED_ROOT = process.env.ALLOWED_ROOT || os.homedir();

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Hàm kiểm tra và giải quyết path an toàn
function resolvePath(requestedPath, baseDir = DEFAULT_WORKSPACE) {
  const target = requestedPath ? path.resolve(baseDir, requestedPath) : baseDir;
  // Đảm bảo không thoát ra ngoài ALLOWED_ROOT
  if (!target.startsWith(ALLOWED_ROOT)) {
    throw new Error('Access denied: Path is outside permitted root');
  }
  return target;
}

function getRelativePath(targetPath) {
  return path.relative(DEFAULT_WORKSPACE, targetPath);
}

// 1. API FS - Liệt kê thư mục
app.get('/api/fs', (req, res) => {
  try {
    const relPath = req.query.path || '';
    const targetDir = resolvePath(relPath);

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: 'Directory does not exist' });
    }

    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Target path is not a directory' });
    }

    const dirents = fs.readdirSync(targetDir, { withFileTypes: true });
    const entries = dirents
      .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
      .map((e) => {
        const full = path.join(targetDir, e.name);
        const isDir = e.isDirectory();
        let size = 0;
        let mtime = null;
        try {
          const s = fs.statSync(full);
          size = s.size;
          mtime = s.mtime.toISOString();
        } catch (_) {}

        return {
          name: e.name,
          isDirectory: isDir,
          size,
          mtime,
          ext: isDir ? '' : path.extname(e.name).toLowerCase(),
          relPath: path.relative(DEFAULT_WORKSPACE, full),
        };
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const parentDir = targetDir === ALLOWED_ROOT ? null : path.dirname(targetDir);
    const parentRel = parentDir ? path.relative(DEFAULT_WORKSPACE, parentDir) : null;

    res.json({
      workspace: DEFAULT_WORKSPACE,
      currentDir: targetDir,
      currentRel: getRelativePath(targetDir),
      parentRel,
      entries,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. API File - Đọc nội dung file
app.get('/api/file', (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: 'Missing path query' });

    const filePath = resolvePath(relPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory, not a file' });
    }

    if (stat.size > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (> 10MB)' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.json({
      path: relPath,
      name: path.basename(filePath),
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      content,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. API File - Lưu nội dung file
app.post('/api/file', (req, res) => {
  try {
    const { path: relPath, content } = req.body || {};
    if (!relPath) return res.status(400).json({ error: 'Missing path in body' });

    const filePath = resolvePath(relPath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content ?? '', 'utf8');
    const stat = fs.statSync(filePath);
    res.json({ success: true, size: stat.size, mtime: stat.mtime.toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. API FS - Tạo file/thư mục mới
app.post('/api/fs/create', (req, res) => {
  try {
    const { path: relPath, type } = req.body || {};
    if (!relPath) return res.status(400).json({ error: 'Missing path' });

    const target = resolvePath(relPath);
    if (fs.existsSync(target)) {
      return res.status(409).json({ error: 'Item already exists' });
    }

    if (type === 'directory') {
      fs.mkdirSync(target, { recursive: true });
    } else {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, '', 'utf8');
    }

    res.json({ success: true, path: relPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. API FS - Xóa file hoặc thư mục
app.delete('/api/fs', (req, res) => {
  try {
    const relPath = req.query.path || (req.body && req.body.path);
    if (!relPath) return res.status(400).json({ error: 'Missing path' });

    const target = resolvePath(relPath);
    if (target === ALLOWED_ROOT || target === DEFAULT_WORKSPACE) {
      return res.status(403).json({ error: 'Cannot delete root workspace' });
    }

    if (!fs.existsSync(target)) {
      return res.status(404).json({ error: 'Target not found' });
    }

    fs.rmSync(target, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. API FS - Đổi tên / di chuyển
app.post('/api/fs/rename', (req, res) => {
  try {
    const { oldPath, newPath } = req.body || {};
    if (!oldPath || !newPath) return res.status(400).json({ error: 'Missing oldPath or newPath' });

    const oldTarget = resolvePath(oldPath);
    const newTarget = resolvePath(newPath);

    if (!fs.existsSync(oldTarget)) {
      return res.status(404).json({ error: 'Source not found' });
    }
    if (fs.existsSync(newTarget)) {
      return res.status(409).json({ error: 'Destination already exists' });
    }

    fs.renameSync(oldTarget, newTarget);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. API System Info
app.get('/api/info', (_req, res) => {
  res.json({
    app: 'hugcode',
    version: '1.0.0-prototype',
    workspace: DEFAULT_WORKSPACE,
    user: os.userInfo().username,
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: process.uptime(),
  });
});

const server = http.createServer(app);

// WebSocket cho Terminal (node-pty)
const wss = new WebSocketServer({ server, path: '/ws/terminal' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const reqCwd = url.searchParams.get('cwd');
  let cwd = DEFAULT_WORKSPACE;
  try {
    if (reqCwd) {
      const candidate = resolvePath(reqCwd);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        cwd = candidate;
      }
    }
  } catch (_) {}

  const shell = process.env.SHELL || '/bin/bash';
  let ptyProcess = null;

  try {
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });
  } catch (err) {
    console.error('Failed to spawn PTY:', err);
    ws.send(`\r\n\x1b[31mFailed to spawn terminal: ${err.message}\x1b[0m\r\n`);
    ws.close();
    return;
  }

  ptyProcess.onData((data) => {
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    } catch (_) {}
  });

  ptyProcess.onExit(() => {
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send('\r\n[Process completed]\r\n');
        ws.close();
      }
    } catch (_) {}
  });

  ws.on('message', (message) => {
    try {
      const text = message.toString();
      // Kiểm tra có phải message điều khiển JSON không
      if (text.startsWith('{') && text.endsWith('}')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
            ptyProcess.resize(Math.max(10, parsed.cols), Math.max(5, parsed.rows));
            return;
          }
          if (parsed.type === 'input') {
            ptyProcess.write(parsed.data || '');
            return;
          }
        } catch (_) {
          // Nếu parse JSON lỗi thì coi như input thường
        }
      }
      // Gửi raw input vào PTY
      ptyProcess.write(text);
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (_) {}
    }
  });

  ws.on('error', () => {
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (_) {}
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 HugCode Prototype running at http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
  console.log(`📁 Workspace: ${DEFAULT_WORKSPACE}`);
});
