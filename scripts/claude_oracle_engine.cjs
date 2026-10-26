'use strict';
/**
 * Official Assembler / Reducer Oracle Engine for M1
 * Extracted verbatim and parameterized from Anthropic.claude-code 2.1.308 linux-x64
 * Primary artifacts:
 * - webview/index.js (SHA-256 c1f17b25dcc10e1d22290f2bbd960d7dd9016907adf50e12db1206a929d61f9c)
 * - extension/extension.js (SHA-256 f0e1eb4ca34b00edcaebba7544d67df31317aefee726698efa24a07083ebec81)
 */

class ContentBlockWrapper {
  constructor(content, partial = false, narrationHint = undefined, key = Math.random()) {
    this.content = content;
    this.partial = partial;
    this.narrationHint = narrationHint;
    this.key = key;
    this.toolResult = { value: undefined };
    this.startTime = partial ? Date.now() : null;
    this.endTime = null;
    this.lastModifiedTime = Date.now();
    this.revision = 0;
  }
  updated() {
    this.lastModifiedTime = Date.now();
    this.revision++;
  }
  complete() {
    this.partial = false;
    this.lastModifiedTime = Date.now();
    this.revision++;
    this.endTime = Date.now();
  }
}

const partialJsonSymbol = Symbol("partialJson");

function applyDelta(block, delta) {
  switch (delta.type) {
    case "text_delta":
      if (block.type !== "text") throw Error(`expected block of type text but got ${block.type}`);
      block.text += delta.text;
      break;
    case "citations_delta":
      if (block.type !== "text") throw Error(`expected block of type text but got ${block.type}`);
      if (!block.citations) block.citations = [];
      block.citations.push(delta.citation);
      break;
    case "input_json_delta":
      if (block.type === "tool_use" || block.type === "server_tool_use") {
        if (!block[partialJsonSymbol]) block[partialJsonSymbol] = "";
        block[partialJsonSymbol] += delta.partial_json;
      } else {
        throw Error(`expected block of type tool_use/server_tool_use but got ${block.type}`);
      }
      break;
    case "thinking_delta":
      if (block.type === "redacted_thinking") break;
      if (block.type !== "thinking") throw Error(`expected block of type thinking but got ${block.type}`);
      block.thinking += delta.thinking;
      break;
    case "signature_delta":
      if (block.type !== "thinking") throw Error(`expected block of type thinking but got ${block.type}`);
      block.signature = delta.signature;
      break;
    case "compaction_delta":
      break;
    default:
      break;
  }
}

function parseToolUseInput(block) {
  if (partialJsonSymbol in block) {
    const raw = block[partialJsonSymbol];
    delete block[partialJsonSymbol];
    try {
      block.input = JSON.parse(raw);
    } catch {
      block.input = raw;
      return "failed to parse tool use input";
    }
  }
}

class StreamAssembler {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.currentMessage = null;
    this.currentBlocks = [];
    this.thinkingTokenEstimate = 0;
  }

  processStreamEvent(event) {
    switch (event.type) {
      case "message_start":
        this.currentMessage = event.message;
        this.currentBlocks = [];
        this.thinkingTokenEstimate = 0;
        this.handlers.onMessageStart?.(event.message);
        break;
      case "message_delta":
        if (!this.currentMessage) return;
        if (event.delta?.stop_reason) this.currentMessage.stop_reason = event.delta.stop_reason;
        if (event.usage) {
          if (!this.currentMessage.usage) this.currentMessage.usage = {};
          Object.assign(this.currentMessage.usage, event.usage);
        }
        break;
      case "content_block_start":
        if (!this.currentMessage) return;
        this.currentBlocks[event.index] = event.content_block;
        this.handlers.onContentBlockStart?.(event.index, event.content_block);
        break;
      case "content_block_delta": {
        if (!this.currentMessage) return;
        const block = this.currentBlocks[event.index];
        if (!block) return;
        applyDelta(block, event.delta);
        if (event.delta.type === "thinking_delta") {
          this.thinkingTokenEstimate += Math.ceil(event.delta.thinking.length / 4);
          this.handlers.onThinkingTokenEstimate?.(this.thinkingTokenEstimate);
        }
        this.handlers.onContentBlockDelta?.(event.index, event.delta, block);
        break;
      }
      case "content_block_stop": {
        if (!this.currentMessage) return;
        const block = this.currentBlocks[event.index];
        if (!block) return;
        if (block.type === "tool_use" || block.type === "server_tool_use") {
          parseToolUseInput(block);
        }
        this.handlers.onContentBlockStop?.(event.index, block);
        break;
      }
      case "message_stop":
        if (!this.currentMessage) return;
        this.currentMessage.content = this.currentBlocks.filter(Boolean);
        this.handlers.onMessageStop?.(this.currentMessage);
        this.currentMessage = null;
        this.currentBlocks = [];
        break;
    }
  }
}

class MultiNamespaceAssembler {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.assemblers = new Map();
  }

  getAssembler(parentToolUseId) {
    const key = parentToolUseId ?? "root";
    let asm = this.assemblers.get(key);
    if (!asm) {
      asm = new StreamAssembler({
        onMessageStart: (msg) => this.handlers.onMessageStart?.(msg, key),
        onContentBlockStart: (idx, b) => this.handlers.onContentBlockStart?.(idx, b, key),
        onContentBlockDelta: (idx, d, b) => this.handlers.onContentBlockDelta?.(idx, d, b, key),
        onContentBlockStop: (idx, b) => this.handlers.onContentBlockStop?.(idx, b, key),
        onMessageStop: (msg) => this.handlers.onMessageStop?.(msg, key),
        onThinkingTokenEstimate: (est) => this.handlers.onThinkingTokenEstimate?.(est, key),
      });
      this.assemblers.set(key, asm);
    }
    return asm;
  }

  processStreamEvent(event, parentToolUseId) {
    this.getAssembler(parentToolUseId).processStreamEvent(event);
  }
}

class OfficialReducerOracle {
  constructor() {
    this.messages = [];
    this.streamedAttempt = { rows: [] };
    this.subagentTasks = new Map();
    this.systemEvents = [];
    this.interactions = [];
    this.runtimeMetadata = {};
    this.usageData = { totalTokens: 0, compactBoundaries: [] };

    this.multiAssembler = new MultiNamespaceAssembler({
      onMessageStart: (msg, namespace) => {
        this.retireAbandonedStreamedRows();
        const wrapper = {
          type: "assistant",
          uuid: undefined,
          parentToolUseId: namespace === "root" ? null : namespace,
          betaMessageId: msg.id,
          contentBlocks: [],
          isStreamed: true
        };
        this.messages.push(wrapper);
        this.streamedAttempt.rows.push(wrapper);
      },
      onContentBlockStart: (index, block, namespace) => {
        const msg = this.findActiveStreamedMessage(namespace);
        if (!msg) return;
        const blockWrap = new ContentBlockWrapper(block, true);
        msg.contentBlocks[index] = blockWrap;
      },
      onContentBlockDelta: (index, delta, block, namespace) => {
        const msg = this.findActiveStreamedMessage(namespace);
        if (!msg || !msg.contentBlocks[index]) return;
        msg.contentBlocks[index].updated();
      },
      onContentBlockStop: (index, block, namespace) => {
        const msg = this.findActiveStreamedMessage(namespace);
        if (!msg || !msg.contentBlocks[index]) return;
        msg.contentBlocks[index].complete();
      },
      onMessageStop: (msg, namespace) => {
        const active = this.findActiveStreamedMessage(namespace);
        if (active) {
          active.isStreamed = false;
        }
      }
    });
  }

  findActiveStreamedMessage(namespace) {
    const parentId = namespace === "root" ? null : namespace;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      if (m.type === "assistant" && m.parentToolUseId === parentId && m.isStreamed) {
        return m;
      }
    }
    return null;
  }

  retireAbandonedStreamedRows() {
    if (this.streamedAttempt.rows.length === 0) return;
    const toRetire = new Set(this.streamedAttempt.rows);
    this.messages = this.messages.filter(m => !toRetire.has(m) || !m.isStreamed);
    this.streamedAttempt.rows = [];
  }

  reconcileAssistantSnapshot(snapshotFrame) {
    const snapshotMsg = snapshotFrame.message;
    const uuid = snapshotFrame.uuid;
    const parentId = snapshotFrame.parent_tool_use_id ?? null;

    let target = null;
    if (uuid) {
      target = this.messages.find(m => m.uuid === uuid);
    }
    if (!target) {
      target = this.messages.find(m =>
        m.type === "assistant" &&
        m.parentToolUseId === parentId &&
        m.betaMessageId === snapshotMsg.id &&
        m.uuid === undefined &&
        m.contentBlocks.length > 0 &&
        m.contentBlocks[0]?.content?.type === snapshotMsg.content[0]?.type
      );
    }

    const newBlocks = snapshotMsg.content.map(c => new ContentBlockWrapper(c, false));

    if (target) {
      target.uuid = uuid;
      target.isStreamed = false;
      target.contentBlocks = newBlocks;
      target.lastModifiedTime = Date.now();
    } else {
      const newWrapper = {
        type: "assistant",
        uuid: uuid,
        parentToolUseId: parentId,
        betaMessageId: snapshotMsg.id,
        contentBlocks: newBlocks,
        isStreamed: false
      };
      this.messages.push(newWrapper);
    }
  }

  setToolResult(toolUseId, content, isError = false) {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg.type !== "assistant") continue;
      for (const blockWrap of msg.contentBlocks) {
        if (!blockWrap) continue;
        const b = blockWrap.content;
        if ((b.type === "tool_use" || b.type === "server_tool_use") && b.id === toolUseId) {
          blockWrap.toolResult.value = { content, isError };
          blockWrap.updated();
          return true;
        }
      }
    }
    return false;
  }

  processMessage(obj) {
    if (!obj || typeof obj !== "object") return;

    if (obj.type === "stream_event" && obj.event) {
      this.multiAssembler.processStreamEvent(obj.event, obj.parent_tool_use_id);
    } else if (obj.type === "assistant" && obj.message) {
      this.reconcileAssistantSnapshot(obj);
    } else if (obj.type === "user" && obj.message?.content) {
      for (const block of obj.message.content) {
        if (block.type === "tool_result" && block.tool_use_id) {
          this.setToolResult(block.tool_use_id, block.content, block.is_error);
        }
      }
    } else if (obj.type === "system") {
      this.systemEvents.push(obj);
      if (obj.subtype === "status") {
        Object.assign(this.runtimeMetadata, obj.status || {});
      } else if (obj.subtype === "compact_boundary") {
        this.usageData.totalTokens = 0;
        this.usageData.compactBoundaries.push({ timestamp: Date.now() });
      } else if (obj.subtype === "task_started") {
        if (obj.task_id) this.subagentTasks.set(obj.task_id, { status: "running", ...obj });
      } else if (obj.subtype === "task_progress") {
        if (obj.task_id && this.subagentTasks.has(obj.task_id)) {
          Object.assign(this.subagentTasks.get(obj.task_id), { progress: obj.progress });
        }
      } else if (obj.subtype === "task_notification") {
        if (obj.task_id && this.subagentTasks.has(obj.task_id)) {
          Object.assign(this.subagentTasks.get(obj.task_id), { notification: obj });
        }
      }
    } else if (obj.type === "control_request") {
      this.interactions.push(obj);
    }
  }

  getCanonicalState() {
    return {
      messages: this.messages.map(m => ({
        type: m.type,
        uuid: m.uuid,
        parentToolUseId: m.parentToolUseId,
        betaMessageId: m.betaMessageId,
        isStreamed: m.isStreamed,
        blocks: m.contentBlocks.filter(Boolean).map(bw => ({
          type: bw.content.type,
          text: bw.content.text,
          thinking: bw.content.thinking,
          tool_name: bw.content.name,
          tool_id: bw.content.id,
          input: bw.content.input,
          toolResult: bw.toolResult.value,
          partial: bw.partial
        }))
      })),
      tasks: Array.from(this.subagentTasks.entries()).map(([id, t]) => ({ id, ...t })),
      interactions: this.interactions,
      metadata: this.runtimeMetadata,
      usage: this.usageData
    };
  }
}

module.exports = {
  ContentBlockWrapper,
  applyDelta,
  parseToolUseInput,
  StreamAssembler,
  MultiNamespaceAssembler,
  OfficialReducerOracle
};
