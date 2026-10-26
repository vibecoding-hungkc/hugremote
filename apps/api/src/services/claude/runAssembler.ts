import type {
  ClaudeCanonicalBlock,
  ClaudeCanonicalMessage,
  ClaudeChildAgentState,
  ClaudeNormalizedEvent,
  ClaudeRunSnapshot
} from '@hugremote/shared';

interface MutableRunSnapshot extends ClaudeRunSnapshot {
  diagnostics: Array<{
    nativeFrameType: string;
    preview: string;
  }>;
}

const MAX_DIAGNOSTICS = 100;
const SUPPORTED_EVENT_TYPES: Record<ClaudeNormalizedEvent['type'], true> = {
  'message.started': true,
  'message.delta': true,
  'message.snapshot': true,
  'content.block_started': true,
  'content.block_delta': true,
  'content.block_completed': true,
  'tool.completed': true,
  'interaction.requested': true,
  'system.status': true,
  'system.compact_boundary': true,
  'system.task_progress': true,
  'diagnostic.unsupported_native_event': true,
};

/**
 * Builds canonical response state from versioned normalized events.
 * One instance owns exactly one session/run tuple; events from other scopes are rejected.
 */
export class ClaudeRunAssembler {
  private state?: MutableRunSnapshot;
  private readonly messageOrder: ClaudeCanonicalMessage[] = [];
  private readonly preScopeDiagnostics: MutableRunSnapshot['diagnostics'] = [];
  private lastSequencePart = -1;

  applyNormalizedEvent(event: ClaudeNormalizedEvent): boolean {
    if (event.schemaVersion !== 1 || !Object.hasOwn(SUPPORTED_EVENT_TYPES, event.type)) return false;
    const isDiagnostic = event.type === 'diagnostic.unsupported_native_event';
    if (isDiagnostic && !this.state) {
      this.appendDiagnostic(this.preScopeDiagnostics, event);
      return true;
    }
    if (this.state && (event.runId !== this.state.runId || event.sessionId !== this.state.sessionId)) return false;

    if (!isDiagnostic && event.sequence !== undefined && this.state?.lastSequence !== undefined) {
      if (event.sequence < this.state.lastSequence) return false;
      if (event.sequence === this.state.lastSequence) {
        const validNextPart = event.sequenceParts !== undefined &&
          event.sequencePart !== undefined &&
          event.sequencePart === this.lastSequencePart + 1 &&
          event.sequencePart < event.sequenceParts;
        if (!validNextPart) return false;
      }
    }

    const initializedHere = !this.state;
    if (initializedHere) {
      this.state = {
        runId: event.runId,
        sessionId: event.sessionId,
        rootMessages: [],
        childAgents: [],
        interactions: [],
        systemMetadata: {},
        diagnostics: this.preScopeDiagnostics.splice(0)
      };
    }

    const accepted = this.applyEvent(event);
    if (!accepted && initializedHere) {
      this.preScopeDiagnostics.push(...this.state!.diagnostics);
      this.state = undefined;
    }
    if (accepted && !isDiagnostic && event.sequence !== undefined) {
      this.state!.lastSequence = event.sequence;
      this.lastSequencePart = event.sequencePart ?? 0;
    }
    return accepted;
  }

  private applyEvent(event: ClaudeNormalizedEvent): boolean {
    const state = this.state!;
    switch (event.type) {
      case 'message.started':
        this.upsertMessage(event.messageId, event.parentToolUseId, event.sender ?? 'assistant');
        return true;
      case 'message.delta': {
        if (!event.messageId) return false;
        const message = this.upsertMessage(event.messageId, event.parentToolUseId, 'assistant');
        if (event.stopReason !== undefined) message.stopReason = event.stopReason;
        return true;
      }
      case 'content.block_started': {
        if (!event.messageId) return false;
        const message = this.upsertMessage(event.messageId, event.parentToolUseId, 'assistant');
        message.blocks[event.blockIndex] = this.blockFromNative(event.blockIndex, event.blockType, event.initialContent, true);
        this.rebuildMessageText(message);
        return true;
      }
      case 'content.block_delta': {
        if (!event.messageId) return false;
        const message = this.upsertMessage(event.messageId, event.parentToolUseId, 'assistant');
        const block = message.blocks[event.blockIndex] ?? this.blockFromNative(event.blockIndex, this.blockTypeForDelta(event.deltaType), undefined, true);
        message.blocks[event.blockIndex] = block;
        this.applyBlockDelta(block, event);
        this.rebuildMessageText(message);
        return true;
      }
      case 'content.block_completed': {
        if (!event.messageId) return false;
        const message = this.findMessage(event.messageId, event.parentToolUseId);
        const block = message?.blocks[event.blockIndex];
        if (!block) return false;
        block.isPartial = false;
        if ((block.type === 'tool_use' || block.type === 'server_tool_use') && typeof block.input === 'string') {
          try {
            block.input = JSON.parse(block.input);
          } catch {
            // Keep the bounded raw partial input for a future explicit tool error diagnostic.
          }
        }
        return true;
      }
      case 'message.snapshot':
        this.applySnapshot(event.messageId ?? this.syntheticMessageId(), event.parentToolUseId, event.uuid, event.content);
        return true;
      case 'tool.completed':
        return this.applyToolResult(event.toolUseId, event.output, event.isError);
      case 'interaction.requested':
        state.interactions.push({
          interactionId: event.interactionId,
          type: event.interactionType,
          status: 'pending',
          request: event.request
        });
        return true;
      case 'system.status':
        state.systemMetadata.status = event.payload;
        return true;
      case 'system.compact_boundary':
        state.systemMetadata.compactBoundary = event.payload;
        return true;
      case 'system.task_progress':
        state.systemMetadata.taskProgress = event.payload;
        return true;
      case 'diagnostic.unsupported_native_event':
        this.appendDiagnostic(state.diagnostics, event);
        return true;
    }
    return this.assertNever(event);
  }

  private appendDiagnostic(
    target: MutableRunSnapshot['diagnostics'],
    event: Extract<ClaudeNormalizedEvent, { type: 'diagnostic.unsupported_native_event' }>
  ): void {
    target.push({ nativeFrameType: event.nativeFrameType, preview: event.preview });
    if (target.length > MAX_DIAGNOSTICS) target.splice(0, target.length - MAX_DIAGNOSTICS);
  }

  private assertNever(event: never): never {
    throw new Error(`Unhandled normalized event: ${String((event as { type?: unknown }).type)}`);
  }

  getSnapshot(): MutableRunSnapshot {
    if (!this.state) {
      return {
        runId: '',
        sessionId: '',
        rootMessages: [],
        childAgents: [],
        interactions: [],
        systemMetadata: {},
        diagnostics: structuredClone(this.preScopeDiagnostics)
      };
    }
    return structuredClone(this.state);
  }

  private messagesFor(parentToolUseId?: string | null): ClaudeCanonicalMessage[] {
    if (!parentToolUseId) return this.state!.rootMessages;
    let agent = this.state!.childAgents.find(item => item.parentToolUseId === parentToolUseId);
    if (!agent) {
      agent = {
        agentId: `agent:${parentToolUseId}`,
        parentToolUseId,
        status: 'running',
        messages: []
      };
      this.state!.childAgents.push(agent);
    }
    return agent.messages;
  }

  private upsertMessage(
    messageId: string,
    parentToolUseId?: string | null,
    sender: 'assistant' | 'user' = 'assistant'
  ): ClaudeCanonicalMessage {
    const messages = this.messagesFor(parentToolUseId);
    let message = this.findLast(messages, item => item.messageId === messageId);
    if (!message) {
      message = { messageId, sender, text: '', blocks: [] };
      messages.push(message);
      this.messageOrder.push(message);
    }
    return message;
  }

  private findMessage(messageId: string, parentToolUseId?: string | null): ClaudeCanonicalMessage | undefined {
    return this.findLast(this.messagesFor(parentToolUseId), item => item.messageId === messageId);
  }

  private applySnapshot(
    messageId: string,
    parentToolUseId: string | null | undefined,
    uuid: string | undefined,
    content: Array<Record<string, any>>
  ): void {
    const messages = this.messagesFor(parentToolUseId);
    const firstType = content[0]?.type;
    let message = uuid ? this.findLast(messages, item => item.uuid === uuid) : undefined;
    if (!message) {
      message = this.findLast(messages, item =>
        item.messageId === messageId &&
        item.uuid === undefined &&
        item.blocks.length > 0 &&
        item.blocks[0]?.type === firstType
      );
    }
    if (!message) {
      message = { messageId, sender: 'assistant', text: '', blocks: [] };
      messages.push(message);
      this.messageOrder.push(message);
    }
    message.uuid = uuid ?? message.uuid;
    message.blocks = content.map((block, index) => this.blockFromNative(index, block.type ?? 'unknown', block, false));
    this.rebuildMessageText(message);
  }

  private blockFromNative(index: number, type: string, native: any, partial: boolean): ClaudeCanonicalBlock {
    const block: ClaudeCanonicalBlock = { index, type, isPartial: partial };
    if (type === 'text') block.text = native?.text ?? '';
    if (type === 'thinking') block.thinking = native?.thinking ?? '';
    if (type === 'tool_use' || type === 'server_tool_use') {
      block.tool_id = native?.id;
      block.tool_name = native?.name;
      block.input = native?.input ?? '';
    }
    return block;
  }

  private blockTypeForDelta(deltaType: string): string {
    if (deltaType === 'thinking_delta' || deltaType === 'signature_delta') return 'thinking';
    if (deltaType === 'input_json_delta') return 'tool_use';
    return 'text';
  }

  private applyBlockDelta(block: ClaudeCanonicalBlock, event: Extract<ClaudeNormalizedEvent, { type: 'content.block_delta' }>): void {
    if (event.deltaType === 'text_delta' && event.text !== undefined) {
      block.text = `${block.text ?? ''}${event.text}`;
    } else if (event.deltaType === 'thinking_delta' && event.thinking !== undefined) {
      block.thinking = `${block.thinking ?? ''}${event.thinking}`;
    } else if (event.deltaType === 'input_json_delta' && event.partialJson !== undefined) {
      block.input = `${typeof block.input === 'string' ? block.input : ''}${event.partialJson}`;
    } else if (event.deltaType === 'signature_delta' && event.signature !== undefined) {
      (block as any).signature = event.signature;
    } else if (event.deltaType === 'citations_delta' && event.citation !== undefined) {
      const citations = ((block as any).citations ??= []);
      citations.push(event.citation);
    }
  }

  private applyToolResult(toolUseId: string, output: any, isError?: boolean): boolean {
    for (let messageIndex = this.messageOrder.length - 1; messageIndex >= 0; messageIndex--) {
      const blocks = this.messageOrder[messageIndex].blocks;
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        if (blocks[blockIndex]?.tool_id === toolUseId) {
          blocks[blockIndex].toolResult = { content: output, isError };
          blocks[blockIndex].isPartial = false;
          return true;
        }
      }
    }
    return false;
  }

  private rebuildMessageText(message: ClaudeCanonicalMessage): void {
    message.text = message.blocks.map(block => block?.text ?? '').join('');
    const thinking = message.blocks.map(block => block?.thinking ?? '').join('');
    if (thinking) message.thinking = thinking;
    else delete message.thinking;
  }

  private syntheticMessageId(): string {
    const count = this.state!.rootMessages.length + this.state!.childAgents.reduce((sum, agent) => sum + agent.messages.length, 0);
    return `snapshot-message-${count + 1}`;
  }

  private findLast<T>(values: T[], predicate: (value: T) => boolean): T | undefined {
    for (let index = values.length - 1; index >= 0; index--) {
      if (predicate(values[index])) return values[index];
    }
    return undefined;
  }
}
