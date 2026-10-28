export class ClaudeReplayBuffer {
    buffer = [];
    sequenceCounter = 0;
    maxCapacity;
    constructor(maxCapacity = 500) {
        this.maxCapacity = Math.max(1, maxCapacity);
    }
    append(event) {
        this.sequenceCounter += 1;
        const sequenced = {
            sequence: this.sequenceCounter,
            event,
            timestamp: Date.now()
        };
        this.buffer.push(sequenced);
        if (this.buffer.length > this.maxCapacity) {
            this.buffer.shift();
        }
        return sequenced;
    }
    getLastSequence() {
        return this.sequenceCounter;
    }
    getEventsAfter(cursor) {
        if (this.buffer.length === 0) {
            return { type: 'replay', events: [] };
        }
        const oldestSequence = this.buffer[0].sequence;
        if (cursor < oldestSequence - 1) {
            return { type: 'fallback_snapshot', lastSequence: this.sequenceCounter };
        }
        const events = this.buffer.filter((item) => item.sequence > cursor);
        return { type: 'replay', events };
    }
}
export const CURRENT_SESSION_SCHEMA_VERSION = 2;
export function migrateSessionRecord(raw) {
    if (!raw || typeof raw !== 'object')
        return raw;
    const migrated = { ...raw };
    const currentVersion = typeof migrated.schemaVersion === 'number' ? migrated.schemaVersion : 1;
    if (currentVersion < 2) {
        migrated.schemaVersion = CURRENT_SESSION_SCHEMA_VERSION;
    }
    if (Array.isArray(migrated.messages)) {
        migrated.messages = migrated.messages.map((msg) => {
            if (!msg || typeof msg !== 'object')
                return msg;
            const normalizedMsg = { ...msg };
            if (!Array.isArray(normalizedMsg.childAgents)) {
                normalizedMsg.childAgents = [];
            }
            if (!Array.isArray(normalizedMsg.interactions)) {
                normalizedMsg.interactions = [];
            }
            if (Array.isArray(normalizedMsg.tools)) {
                normalizedMsg.tools = normalizedMsg.tools.map((tool) => {
                    if (!tool || typeof tool !== 'object')
                        return tool;
                    const normalizedTool = { ...tool };
                    if (!normalizedTool.status) {
                        normalizedTool.status = 'done';
                    }
                    if (!normalizedTool.type) {
                        normalizedTool.type = 'generic';
                    }
                    return normalizedTool;
                });
            }
            return normalizedMsg;
        });
    }
    else {
        migrated.messages = [];
    }
    return migrated;
}
