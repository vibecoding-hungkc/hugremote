export interface ClaudeToolCall {
  id?: string;
  type: 'read' | 'edit' | 'bash';
  title: string;
  status?: 'running' | 'done' | 'error';
  isExpanded?: boolean;
  content?: string;
  diff?: string[];
  output?: string;
}

export interface ClaudeMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  thinking?: string;
  isThinking?: boolean;
  isWorking?: boolean;
  isThinkingExpanded?: boolean;
  tools?: ClaudeToolCall[];
}

export interface ClaudeLimits {
  fiveHour: {
    usedPercent: number;
    resetIn: string;
  };
  weekly: {
    usedPercent: number;
    resetIn: string;
  };
}

export interface ClaudeProjectSessionSummary {
  id: string;
  summary: string;
  firstPrompt?: string;
  lastPrompt?: string;
  model: string;
  branch?: string;
  userMsgs: number;
  asstMsgs: number;
  updatedAt: number;
  size: number;
  cwd?: string;
  contextTokens?: string;
  totalCostUSD?: number;
}

export interface ClaudeProjectSessionDetail extends ClaudeProjectSessionSummary {
  messages: ClaudeMessage[];
}

export interface ClaudeSession {
  id: string;
  serverId: string;
  projectId?: string;
  name: string;
  cwd: string;
  isCustomNamed: boolean;
  model: string;
  mode: string;
  bypassPermissions?: boolean;
  timer?: string;
  contextTokens?: string;
  messages: ClaudeMessage[];
  updatedAt: number;
  createdAt?: number;
  cliSessionId?: string;
}
