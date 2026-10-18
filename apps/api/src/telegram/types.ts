export interface TelegramTopicBinding {
  chatId: string;
  threadId: string;
  sessionId: string;
  sessionName?: string;
  updatedAt: number;
}

export interface TelegramTopicState {
  enabledChats: Record<string, boolean>; // chatId -> topicModeEnabled
  bindings: Record<string, TelegramTopicBinding>; // `${chatId}:${threadId}` -> binding
}

export interface TelegramConfig {
  botToken: string;
  allowedUsers: string[]; // string user IDs or usernames (lowercase, without @)
  topicModeDefault: boolean;
  defaultCwd: string;
}

export interface CommandExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  outputFileUrl?: string;
}
