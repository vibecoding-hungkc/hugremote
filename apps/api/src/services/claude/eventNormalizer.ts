import {
  ClaudeNormalizedEvent,
  CLAUDE_PROTOCOL_VERSION
} from '@hugremote/shared';
import type {
  ClaudeContentBlockStartedEvent,
  ClaudeContentBlockDeltaEvent
} from '@hugremote/shared';

export interface NormalizerOptions {
  sessionId: string;
  runId: string;
  nativeSessionId?: string;
  nativeRunId?: string;
}

const MAX_DIAGNOSTIC_LABEL = 80;
const KNOWN_BLOCK_TYPES = new Set([
  'text', 'thinking', 'tool_use', 'server_tool_use', 'redacted_thinking', 'image', 'document'
]);
const KNOWN_DELTA_TYPES = new Set([
  'text_delta', 'thinking_delta', 'input_json_delta', 'citations_delta', 'signature_delta', 'compaction_delta'
]);

export class ClaudeEventNormalizer {
  private readonly sessionId: string;
  private readonly runId: string;
  private nativeSessionId?: string;
  private nativeRunId?: string;
  private readonly currentMessageIds = new Map<string, string>();
  private readonly blockTypes = new Map<string, string>();
  private syntheticId = 0;

  constructor(options: NormalizerOptions) {
    this.sessionId = options.sessionId;
    this.runId = options.runId;
    this.nativeSessionId = options.nativeSessionId;
    this.nativeRunId = options.nativeRunId;
  }

  bindNativeSession(nativeSessionId: string): void {
    if (nativeSessionId && this.nativeSessionId === undefined) this.nativeSessionId = nativeSessionId;
  }

  bindNativeRun(nativeRunId: string): void {
    if (nativeRunId && this.nativeRunId === undefined) this.nativeRunId = nativeRunId;
  }

  private namespaceKey(parentToolUseId: string | null): string {
    return parentToolUseId ?? 'root';
  }

  private nextSyntheticId(prefix: string): string {
    this.syntheticId += 1;
    return `${prefix}-${this.syntheticId}`;
  }

  private diagnosticPreview(frame: Record<string, unknown>): string {
    return `keys:${Object.keys(frame).sort().slice(0, 12).join(',')}`.slice(0, 120);
  }

  private diagnosticLabel(value: unknown): string {
    const label = typeof value === 'string' ? value : typeof value;
    return label.slice(0, MAX_DIAGNOSTIC_LABEL);
  }

  private blockKey(parentToolUseId: string | null, messageId: string, blockIndex: number): string {
    return `${this.namespaceKey(parentToolUseId)}:${messageId}:${blockIndex}`;
  }

  private sanitizeControlRequest(subtype: string, request: unknown): Record<string, unknown> {
    if (!request || typeof request !== 'object') return {};
    const req = request as Record<string, unknown>;

    if (subtype === 'request_user_dialog') {
      const sanitized: Record<string, unknown> = {
        subtype: 'request_user_dialog',
      };
      if (typeof req.question === 'string') sanitized.question = req.question.slice(0, 4096);
      if (typeof req.message === 'string') sanitized.message = req.message.slice(0, 4096);
      if (typeof req.title === 'string') sanitized.title = req.title.slice(0, 256);
      if (Array.isArray(req.options)) {
        sanitized.options = req.options
          .filter((opt): opt is Record<string, unknown> => Boolean(opt && typeof opt === 'object'))
          .slice(0, 50)
          .map((opt) => ({
            id: typeof opt.id === 'string' ? opt.id.slice(0, 128) : String(opt.id || ''),
            label: typeof opt.label === 'string' ? opt.label.slice(0, 256) : String(opt.label || ''),
          }));
      }
      return sanitized;
    }

    const toolName = typeof req.tool_name === 'string' ? req.tool_name.slice(0, 128) : (typeof req.tool === 'string' ? req.tool.slice(0, 128) : undefined);
    const sanitized: Record<string, unknown> = {
      subtype: typeof req.subtype === 'string' ? req.subtype.slice(0, 64) : 'can_use_tool',
    };
    if (toolName !== undefined) sanitized.tool_name = toolName;
    if (req.input !== undefined) sanitized.input = this.boundInput(req.input);
    if (Array.isArray(req.permission_suggestions)) {
      sanitized.permission_suggestions = req.permission_suggestions.slice(0, 10).map((s) => (typeof s === 'string' ? s.slice(0, 256) : s));
    }
    return sanitized;
  }

  private boundInput(input: unknown): unknown {
    if (input === null || input === undefined) return input;
    try {
      const serialized = JSON.stringify(input);
      if (serialized.length <= 64 * 1024) return input;
      return { _truncated: true, preview: serialized.slice(0, 2048) };
    } catch (_) {
      return String(input).slice(0, 2048);
    }
  }

  private diagnostic(
    nativeFrameType: string,
    preview: string,
    sequence?: number,
    parentToolUseId: string | null = null
  ): ClaudeNormalizedEvent {
    return {
      schemaVersion: CLAUDE_PROTOCOL_VERSION,
      runId: this.runId,
      sessionId: this.sessionId,
      parentToolUseId,
      sequence,
      type: 'diagnostic.unsupported_native_event',
      nativeFrameType: this.diagnosticLabel(nativeFrameType),
      preview: preview.slice(0, 120),
      timestamp: Date.now()
    };
  }

  private ensureMessageId(parentToolUseId: string | null): string {
    const key = this.namespaceKey(parentToolUseId);
    const existing = this.currentMessageIds.get(key);
    if (existing) return existing;
    const generated = this.nextSyntheticId('orphan-message');
    this.currentMessageIds.set(key, generated);
    return generated;
  }

  normalizeFrame(input: any): ClaudeNormalizedEvent[] {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return [this.diagnostic(typeof input, `primitive:${typeof input}`)];
    }

    let frame = input;
    let sequence: number | undefined;
    if (input.transport_event === 'semantic-envelope') {
      if (!Number.isSafeInteger(input.sequence) || !input.frame || typeof input.frame !== 'object' || Array.isArray(input.frame)) {
        return [this.diagnostic('invalid_schema.semantic-envelope', this.diagnosticPreview(input))];
      }
      sequence = input.sequence;
      frame = input.frame;
    }

    if (typeof frame.session_id === 'string' && this.nativeSessionId === undefined) {
      this.nativeSessionId = frame.session_id;
    }
    if (typeof frame.run_id === 'string' && this.nativeRunId === undefined) {
      this.nativeRunId = frame.run_id;
    }
    if (
      (typeof frame.session_id === 'string' && this.nativeSessionId && frame.session_id !== this.nativeSessionId) ||
      (typeof frame.run_id === 'string' && this.nativeRunId && frame.run_id !== this.nativeRunId)
    ) {
      return [this.diagnostic('scope_mismatch', this.diagnosticPreview(frame), sequence)];
    }

    const parentToolUseId: string | null = typeof frame.parent_tool_use_id === 'string'
      ? frame.parent_tool_use_id
      : null;
    const namespaceKey = this.namespaceKey(parentToolUseId);
    const base = {
      schemaVersion: CLAUDE_PROTOCOL_VERSION as 1,
      runId: this.runId,
      sessionId: this.sessionId,
      parentToolUseId,
      sequence,
      timestamp: Date.now()
    };

    // 1. Stream events
    if (frame.type === 'stream_event' && frame.event) {
      const ev = frame.event;
      switch (ev.type) {
        case 'message_start': {
          const messageId = typeof ev.message?.id === 'string'
            ? ev.message.id
            : this.nextSyntheticId('message');
          this.currentMessageIds.set(namespaceKey, messageId);
          return [
            {
              ...base,
              type: 'message.started',
              messageId,
              sender: 'assistant'
            }
          ];
        }

        case 'content_block_start': {
          const messageId = this.ensureMessageId(parentToolUseId);
          const blockType = ev.content_block?.type;
          if (!Number.isSafeInteger(ev.index) || typeof blockType !== 'string' || !KNOWN_BLOCK_TYPES.has(blockType)) {
            return [this.diagnostic('invalid_schema.content_block_start', this.diagnosticPreview(ev), sequence, parentToolUseId)];
          }
          const normalizedBlockType = blockType as ClaudeContentBlockStartedEvent['blockType'];
          this.blockTypes.set(this.blockKey(parentToolUseId, messageId, ev.index), normalizedBlockType);
          return [
            {
              ...base,
              type: 'content.block_started',
              messageId,
              blockIndex: ev.index,
              blockType: normalizedBlockType,
              initialContent: ev.content_block
            }
          ];
        }

        case 'content_block_delta': {
          const messageId = this.ensureMessageId(parentToolUseId);
          const deltaType = ev.delta?.type;
          if (!Number.isSafeInteger(ev.index) || typeof deltaType !== 'string' || !KNOWN_DELTA_TYPES.has(deltaType)) {
            return [this.diagnostic('invalid_schema.content_block_delta', this.diagnosticPreview(ev), sequence, parentToolUseId)];
          }
          const normalizedDeltaType = deltaType as ClaudeContentBlockDeltaEvent['deltaType'];
          const blockType = this.blockTypes.get(this.blockKey(parentToolUseId, messageId, ev.index));
          const compatible =
            (normalizedDeltaType === 'text_delta' || normalizedDeltaType === 'citations_delta') ? blockType === 'text' :
            normalizedDeltaType === 'thinking_delta' ? blockType === 'thinking' || blockType === 'redacted_thinking' :
            normalizedDeltaType === 'signature_delta' ? blockType === 'thinking' :
            normalizedDeltaType === 'input_json_delta' ? blockType === 'tool_use' || blockType === 'server_tool_use' :
            normalizedDeltaType === 'compaction_delta';
          if (!compatible) {
            return [this.diagnostic('invalid_delta_block_type', `delta:${normalizedDeltaType};block:${blockType ?? 'missing'}`, sequence, parentToolUseId)];
          }
          return [
            {
              ...base,
              type: 'content.block_delta',
              messageId,
              blockIndex: ev.index,
              deltaType: normalizedDeltaType,
              text: ev.delta?.text,
              thinking: blockType === 'redacted_thinking' ? undefined : ev.delta?.thinking,
              partialJson: ev.delta?.partial_json,
              citation: ev.delta?.citation,
              signature: ev.delta?.signature
            }
          ];
        }

        case 'content_block_stop': {
          const messageId = this.ensureMessageId(parentToolUseId);
          if (!Number.isSafeInteger(ev.index)) {
            return [this.diagnostic('invalid_schema.content_block_stop', this.diagnosticPreview(ev), sequence, parentToolUseId)];
          }
          this.blockTypes.delete(this.blockKey(parentToolUseId, messageId, ev.index));
          return [
            {
              ...base,
              type: 'content.block_completed',
              messageId,
              blockIndex: ev.index
            }
          ];
        }

        case 'message_delta':
          return [
            {
              ...base,
              type: 'message.delta',
              messageId: this.ensureMessageId(parentToolUseId),
              stopReason: ev.delta?.stop_reason,
              usage: ev.usage
                ? {
                    inputTokens: ev.usage.input_tokens,
                    outputTokens: ev.usage.output_tokens
                  }
                : undefined
            }
          ];

        case 'message_stop':
          return [
            {
              ...base,
              type: 'message.delta',
              messageId: this.ensureMessageId(parentToolUseId),
              stopReason: 'end_turn'
            }
          ];

        default:
          return [
            {
              ...base,
              type: 'diagnostic.unsupported_native_event',
              nativeFrameType: this.diagnosticLabel(`stream_event.${String(ev.type)}`),
              preview: this.diagnosticPreview(ev)
            }
          ];
      }
    }

    // 2. Assistant authoritative snapshot
    if (frame.type === 'assistant' && frame.message) {
      if (!Array.isArray(frame.message.content)) {
        return [this.diagnostic('invalid_schema.assistant_content', this.diagnosticPreview(frame), sequence, parentToolUseId)];
      }
      const messageId = typeof frame.message.id === 'string'
        ? frame.message.id
        : this.ensureMessageId(parentToolUseId);
      this.currentMessageIds.set(namespaceKey, messageId);
      return [
        {
          ...base,
          type: 'message.snapshot',
          messageId,
          uuid: typeof frame.uuid === 'string' ? frame.uuid : undefined,
          content: frame.message.content
        }
      ];
    }

    // 3. User tool results
    if (frame.type === 'user' && frame.message?.content) {
      if (!Array.isArray(frame.message.content)) {
        return [this.diagnostic('invalid_schema.user_content', this.diagnosticPreview(frame), sequence, parentToolUseId)];
      }
      const results: ClaudeNormalizedEvent[] = [];
      for (const block of frame.message.content) {
        if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
          results.push({
            ...base,
            type: 'tool.completed',
            toolUseId: block.tool_use_id,
            output: block.content,
            isError: block.is_error
          });
        }
      }
      if (results.length > 0) {
        return results.map((event, sequencePart) => ({
          ...event,
          sequencePart: sequence === undefined ? undefined : sequencePart,
          sequenceParts: sequence === undefined ? undefined : results.length
        }));
      }
      return [
        {
          ...base,
          type: 'message.started',
          messageId: `user-msg-${Date.now()}`,
          sender: 'user'
        }
      ];
    }

    // 4. System events
    if (frame.type === 'system') {
      if (typeof frame.subtype !== 'string') {
        return [this.diagnostic('invalid_schema.system', this.diagnosticPreview(frame), sequence, parentToolUseId)];
      }
      const subtype = frame.subtype;
      if (subtype === 'task_started') {
        const agentId = typeof frame.task_id === 'string' ? frame.task_id : `agent-${Date.now()}`;
        const parentId = typeof frame.tool_use_id === 'string' ? frame.tool_use_id : (parentToolUseId ?? '');
        return [
          {
            ...base,
            type: 'agent.started',
            agentId,
            parentToolUseId: parentId,
            summary: typeof frame.description === 'string' ? frame.description : undefined
          }
        ];
      }
      if (subtype === 'task_progress') {
        const agentId = typeof frame.task_id === 'string' ? frame.task_id : `agent-${Date.now()}`;
        return [
          {
            ...base,
            type: 'agent.progress',
            agentId,
            summary: typeof frame.summary === 'string' ? frame.summary : undefined,
            recentTool: typeof frame.last_tool_name === 'string' ? frame.last_tool_name : undefined,
            totalTokens: typeof frame.usage?.total_tokens === 'number' ? frame.usage.total_tokens : undefined
          }
        ];
      }
      if (subtype === 'task_notification' || subtype === 'task_updated') {
        const agentId = typeof frame.task_id === 'string' ? frame.task_id : `agent-${Date.now()}`;
        const isCompleted = frame.status === 'completed';
        const isError = frame.status === 'error' || frame.status === 'failed';
        if (isCompleted || isError) {
          return [
            {
              ...base,
              type: 'agent.completed',
              agentId,
              status: isError ? 'error' : 'completed',
              summary: typeof frame.summary === 'string' ? frame.summary : undefined
            }
          ];
        }
      }

      let eventType: 'system.status' | 'system.compact_boundary' | 'system.task_progress' = 'system.status';
      if (subtype === 'compact_boundary') eventType = 'system.compact_boundary';
      else if (subtype.startsWith('task_')) eventType = 'system.task_progress';

      return [
        {
          ...base,
          type: eventType,
          subtype,
          payload: frame
        }
      ];
    }

    // 5. Control requests (interactive permissions, dialogs)
    if (frame.type === 'control_request') {
      const subtype = frame.request?.subtype || frame.subtype || 'permission';
      return [
        {
          ...base,
          type: 'interaction.requested',
          interactionId: frame.request_id || frame.uuid || `req-${Date.now()}`,
          interactionType: subtype === 'request_user_dialog' ? 'user_dialog' : 'permission',
          request: this.sanitizeControlRequest(subtype, frame.request)
        }
      ];
    }

    // 6. Result summary
    if (frame.type === 'result') {
      return [
        {
          ...base,
          type: 'system.status',
          subtype: 'result',
          payload: frame
        }
      ];
    }

    // 7. Unknown or unsupported native frame. Only field names are exposed;
    // raw native values stay backend-only to avoid leaking unbounded payloads.
    return [
      {
        ...base,
        type: 'diagnostic.unsupported_native_event',
        nativeFrameType: this.diagnosticLabel(frame.type || 'unknown'),
        preview: this.diagnosticPreview(frame)
      }
    ];
  }
}
