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

/** Chế độ quyền của Claude CLI (`--permission-mode`). `manual` = hỏi trước mọi thao tác ghi/chạy. */
export enum PermissionMode {
  MANUAL = 'manual',
  ACCEPT_EDITS = 'acceptEdits',
  AUTO = 'auto',
  PLAN = 'plan',
  BYPASS = 'bypassPermissions',
}

/** Sự kiện của claude-stream.v1 (ARCHITECTURE §5). Mỗi sự kiện mang `seq` tăng dần (G-14). */
export enum ClaudeEvent {
  SYNC = 'sync',
  ITEM = 'item',
  TEXT_DELTA = 'text_delta',
  THINKING = 'thinking',
  STATUS = 'status',
  INTERACTION_REQUESTED = 'interaction_requested',
  INTERACTION_RESPONDED = 'interaction_responded',
  QUEUE_CHANGED = 'queue_changed',
  FINISH = 'finish',
  ERROR = 'error',
}

export enum ProjectTab {
  SESSIONS = 'sessions',
  FILES = 'files',
  GIT = 'git',
}
