/**
 * Versioned Claude Normalized Event & Canonical State Protocol
 * Baseline: Claude Code CLI & VS Code Extension 2.1.308 (linux-x64)
 */
export declare const CLAUDE_PROTOCOL_VERSION = 1;
export type ClaudeNormalizedEventType = 'message.started' | 'message.delta' | 'message.snapshot' | 'content.block_started' | 'content.block_delta' | 'content.block_completed' | 'tool.completed' | 'tool.cancelled' | 'agent.started' | 'agent.progress' | 'agent.completed' | 'interaction.requested' | 'interaction.responded' | 'interaction.cancelled' | 'system.status' | 'system.compact_boundary' | 'system.task_progress' | 'diagnostic.unsupported_native_event';
export interface ClaudeNormalizedEventBase {
    schemaVersion: 1;
    sequence?: number;
    /** Zero-based position when one native frame normalizes into multiple events. */
    sequencePart?: number;
    /** Total normalized events emitted from the same native frame. */
    sequenceParts?: number;
    runId: string;
    sessionId: string;
    messageId?: string;
    parentToolUseId?: string | null;
    agentId?: string;
    timestamp?: number;
}
export interface ClaudeMessageStartedEvent extends ClaudeNormalizedEventBase {
    type: 'message.started';
    messageId: string;
    sender?: 'assistant' | 'user';
}
export interface ClaudeMessageDeltaEvent extends ClaudeNormalizedEventBase {
    type: 'message.delta';
    stopReason?: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
    };
}
export interface ClaudeMessageSnapshotEvent extends ClaudeNormalizedEventBase {
    type: 'message.snapshot';
    uuid?: string;
    content: Array<{
        type: string;
        text?: string;
        thinking?: string;
        id?: string;
        name?: string;
        input?: any;
        [key: string]: any;
    }>;
}
export interface ClaudeContentBlockStartedEvent extends ClaudeNormalizedEventBase {
    type: 'content.block_started';
    blockIndex: number;
    blockType: 'text' | 'thinking' | 'tool_use' | 'server_tool_use' | 'redacted_thinking' | 'image' | 'document' | 'unknown';
    initialContent?: any;
}
export interface ClaudeContentBlockDeltaEvent extends ClaudeNormalizedEventBase {
    type: 'content.block_delta';
    blockIndex: number;
    deltaType: 'text_delta' | 'thinking_delta' | 'input_json_delta' | 'citations_delta' | 'signature_delta' | 'compaction_delta';
    text?: string;
    thinking?: string;
    partialJson?: string;
    citation?: any;
    signature?: string;
}
export interface ClaudeContentBlockCompletedEvent extends ClaudeNormalizedEventBase {
    type: 'content.block_completed';
    blockIndex: number;
    finalContent?: any;
}
export interface ClaudeToolCompletedEvent extends ClaudeNormalizedEventBase {
    type: 'tool.completed';
    toolUseId: string;
    output: any;
    isError?: boolean;
}
export interface ClaudeToolCancelledEvent extends ClaudeNormalizedEventBase {
    type: 'tool.cancelled';
    toolUseId: string;
}
export interface ClaudeAgentStartedEvent extends ClaudeNormalizedEventBase {
    type: 'agent.started';
    agentId: string;
    parentToolUseId: string;
    summary?: string;
}
export interface ClaudeAgentProgressEvent extends ClaudeNormalizedEventBase {
    type: 'agent.progress';
    agentId: string;
    summary?: string;
    recentTool?: string;
    totalTokens?: number;
}
export interface ClaudeAgentCompletedEvent extends ClaudeNormalizedEventBase {
    type: 'agent.completed';
    agentId: string;
    status: 'completed' | 'error';
    summary?: string;
}
export interface ClaudeSystemEvent extends ClaudeNormalizedEventBase {
    type: 'system.status' | 'system.compact_boundary' | 'system.task_progress';
    subtype: string;
    payload: any;
}
export interface ClaudeInteractionRequestedEvent extends ClaudeNormalizedEventBase {
    type: 'interaction.requested';
    interactionId: string;
    interactionType: 'permission' | 'user_dialog';
    request: any;
}
export interface ClaudeInteractionRespondedEvent extends ClaudeNormalizedEventBase {
    type: 'interaction.responded';
    interactionId: string;
    response: any;
}
export interface ClaudeInteractionCancelledEvent extends ClaudeNormalizedEventBase {
    type: 'interaction.cancelled';
    interactionId: string;
}
export interface ClaudeDiagnosticUnsupportedEvent extends ClaudeNormalizedEventBase {
    type: 'diagnostic.unsupported_native_event';
    nativeFrameType: string;
    preview: string;
}
type SplitEventType<T extends {
    type: string;
}, K extends T['type'] = T['type']> = K extends T['type'] ? Omit<T, 'type'> & {
    type: K;
} : never;
/** M2 contains only events the normalizer and assembler handle exhaustively. */
export type ClaudeNormalizedEvent = ClaudeMessageStartedEvent | ClaudeMessageDeltaEvent | ClaudeMessageSnapshotEvent | ClaudeContentBlockStartedEvent | ClaudeContentBlockDeltaEvent | ClaudeContentBlockCompletedEvent | ClaudeToolCompletedEvent | ClaudeToolCancelledEvent | ClaudeAgentStartedEvent | ClaudeAgentProgressEvent | ClaudeAgentCompletedEvent | SplitEventType<ClaudeSystemEvent> | ClaudeInteractionRequestedEvent | ClaudeInteractionRespondedEvent | ClaudeInteractionCancelledEvent | ClaudeDiagnosticUnsupportedEvent;
/** Compile-time guard: every declared event type must be represented in the union. */
export type ClaudeNormalizedEventUnionIsExhaustive = ClaudeNormalizedEventType extends ClaudeNormalizedEvent['type'] ? ClaudeNormalizedEvent['type'] extends ClaudeNormalizedEventType ? true : never : never;
export declare const CLAUDE_NORMALIZED_EVENT_UNION_IS_EXHAUSTIVE: ClaudeNormalizedEventUnionIsExhaustive;
type ClaudeNormalizedEventMembersAreExact = false extends {
    [K in ClaudeNormalizedEventType]: [Extract<ClaudeNormalizedEvent, {
        type: K;
    }>] extends [never] ? false : true;
}[ClaudeNormalizedEventType] ? never : true;
export declare const CLAUDE_NORMALIZED_EVENT_MEMBERS_ARE_EXACT: ClaudeNormalizedEventMembersAreExact;
export type ClaudeToolStatus = 'pending' | 'receiving-input' | 'ready' | 'running' | 'progress' | 'done' | 'error' | 'cancelled';
export interface ClaudeCanonicalBlock {
    index: number;
    type: string;
    text?: string;
    thinking?: string;
    tool_name?: string;
    tool_id?: string;
    input?: any;
    partialInput?: string;
    toolStatus?: ClaudeToolStatus;
    toolProgress?: unknown;
    toolSummary?: string;
    toolResult?: {
        content: any;
        isError?: boolean;
    };
    isPartial: boolean;
}
export interface ClaudeCanonicalMessage {
    messageId: string;
    uuid?: string;
    sender: 'assistant' | 'user';
    text: string;
    thinking?: string;
    blocks: ClaudeCanonicalBlock[];
    stopReason?: string;
}
export interface ClaudeChildAgentState {
    agentId: string;
    parentToolUseId: string;
    status: 'running' | 'completed' | 'error';
    summary?: string;
    recentTools?: string[];
    totalTokens?: number;
    messages: ClaudeCanonicalMessage[];
}
export interface ClaudeCanonicalInteraction {
    interactionId: string;
    type: 'permission' | 'user_dialog';
    status: 'pending' | 'responded' | 'cancelled';
    request: any;
    response?: any;
}
export interface ClaudeRunSnapshot {
    runId: string;
    sessionId: string;
    rootMessages: ClaudeCanonicalMessage[];
    childAgents: ClaudeChildAgentState[];
    interactions: ClaudeCanonicalInteraction[];
    systemMetadata: Record<string, any>;
    lastSequence?: number;
}
export {};
//# sourceMappingURL=claudeProtocol.d.ts.map