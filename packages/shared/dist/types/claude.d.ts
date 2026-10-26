export type ClaudeToolFamily = 'bash' | 'read' | 'edit' | 'search' | 'web' | 'todo' | 'agent' | 'mcp' | 'generic';
export interface ClaudeToolCall {
    id?: string;
    type: ClaudeToolFamily;
    nativeName?: string;
    title: string;
    status?: 'pending' | 'receiving-input' | 'ready' | 'running' | 'progress' | 'done' | 'error' | 'cancelled';
    isExpanded?: boolean;
    content?: string;
    input?: any;
    partialInput?: string;
    diff?: string[];
    output?: string;
    summary?: string;
    parentToolUseId?: string;
}
export interface ClaudeInteraction {
    interactionId: string;
    type: 'permission' | 'user_dialog';
    status: 'pending' | 'responded' | 'cancelled';
    request: any;
    response?: any;
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
    childAgents?: Array<{
        agentId: string;
        parentToolUseId: string;
        status: 'running' | 'completed' | 'error';
        summary?: string;
        recentTools?: string[];
        totalTokens?: number;
        messages?: Array<{
            sender: string;
            text: string;
        }>;
    }>;
    interactions?: ClaudeInteraction[];
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
    isRunning?: boolean;
}
//# sourceMappingURL=claude.d.ts.map