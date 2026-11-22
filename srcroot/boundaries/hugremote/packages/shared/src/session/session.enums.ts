export enum UserRole {
  OWNER = 'owner',
  MEMBER = 'member',
}

export enum HostKind {
  LOCAL = 'local',
  SSH = 'ssh',
}

export enum HostAuthType {
  KEY = 'key',
  PASSWORD = 'password',
  AGENT = 'agent',
}

export enum TerminalStatus {
  RUNNING = 'running',
  EXITED = 'exited',
}

export enum ClaudeStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  AWAITING_INPUT = 'awaiting_input',
  DONE = 'done',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

/** Chế độ quyền của Claude CLI (`--permission-mode`). */
export enum PermissionMode {
  DEFAULT = 'default',
  ACCEPT_EDITS = 'acceptEdits',
  PLAN = 'plan',
  BYPASS = 'bypassPermissions',
}

export enum ProjectTab {
  SESSIONS = 'sessions',
  FILES = 'files',
  GIT = 'git',
}
