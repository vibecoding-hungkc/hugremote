import { MigrationInterface, QueryRunner } from 'typeorm';

/** 17 bảng của ARCHITECTURE §6. Chỉ thêm — đổi/xoá đi hai bước qua hai vòng (G-8). */
export class Init1763769600000 implements MigrationInterface {
  name = 'Init1763769600000';

  async up(q: QueryRunner): Promise<void> {
    const sql = [
      `CREATE TABLE users (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('owner','member')),
        email TEXT UNIQUE,
        password_hash TEXT,
        password_salt TEXT,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        preferences TEXT NOT NULL DEFAULT '{}',
        last_login_at TEXT,
        revoked_at TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX users_one_owner ON users(role) WHERE role = 'owner'`,
      `CREATE TABLE refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        family_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        ip TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT
      )`,
      `CREATE INDEX refresh_tokens_family ON refresh_tokens(family_id)`,
      `CREATE TABLE two_factor (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 0,
        secret_enc TEXT,
        pending_secret_enc TEXT,
        recovery_code_hashes TEXT NOT NULL DEFAULT '[]'
      )`,
      `CREATE TABLE login_attempts (
        key TEXT PRIMARY KEY,
        fail_count INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT
      )`,
      `CREATE TABLE sso_config (
        provider TEXT PRIMARY KEY CHECK (provider IN ('google','oidc')),
        issuer_url TEXT,
        client_id TEXT,
        client_secret_enc TEXT,
        allowed_emails TEXT NOT NULL DEFAULT '[]',
        button_label TEXT,
        enabled INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE sso_denials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        provider TEXT NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('not_allowed','revoked','disabled','token_invalid')),
        at TEXT NOT NULL
      )`,
      `CREATE TABLE hosts_meta (
        host_id TEXT PRIMARY KEY,
        workspace_dir TEXT,
        auth_type TEXT CHECK (auth_type IN ('key','password','agent')),
        secret_enc TEXT,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE known_hosts (
        host_id TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        key_type TEXT NOT NULL,
        fingerprint_sha256 TEXT NOT NULL,
        trusted_at TEXT NOT NULL,
        PRIMARY KEY (host, port, key_type)
      )`,
      `CREATE TABLE pinned_hosts (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        host_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (user_id, host_id)
      )`,
      `CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        is_home INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE (host_id, root_path)
      )`,
      `CREATE UNIQUE INDEX projects_one_home ON projects(host_id) WHERE is_home = 1`,
      `CREATE TABLE terminal_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        cwd TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running','exited')),
        exit_code INTEGER,
        created_at TEXT NOT NULL,
        last_attached_at TEXT
      )`,
      `CREATE TABLE claude_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        cli_session_id TEXT,
        model TEXT,
        effort TEXT,
        permission_mode TEXT NOT NULL DEFAULT 'default',
        status TEXT NOT NULL CHECK (status IN ('idle','running','awaiting_input','done','cancelled','error')),
        last_sequence INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (project_id, cli_session_id)
      )`,
      `CREATE TABLE claude_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES claude_sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (session_id, seq)
      )`,
      `CREATE TABLE claude_queue (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES claude_sessions(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        attachments_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX claude_queue_session ON claude_queue(session_id, created_at)`,
      `CREATE TABLE recent_files (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        opened_at TEXT NOT NULL,
        PRIMARY KEY (user_id, project_id, path)
      )`,
      `CREATE TABLE update_runs (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        from_version TEXT,
        to_version TEXT,
        status TEXT NOT NULL CHECK (status IN ('waiting','running','done','rolled_back','failed')),
        "when" TEXT NOT NULL DEFAULT 'now' CHECK ("when" IN ('now','idle')),
        steps TEXT NOT NULL DEFAULT '[]',
        started_at TEXT NOT NULL,
        finished_at TEXT
      )`,
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ];
    for (const s of sql) await q.query(s);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of [
      'settings',
      'update_runs',
      'recent_files',
      'claude_queue',
      'claude_messages',
      'claude_sessions',
      'terminal_sessions',
      'projects',
      'pinned_hosts',
      'known_hosts',
      'hosts_meta',
      'sso_denials',
      'sso_config',
      'login_attempts',
      'two_factor',
      'refresh_tokens',
      'users',
    ]) {
      await q.query(`DROP TABLE IF EXISTS ${t}`);
    }
  }
}
