import fs from 'fs';
import path from 'path';
import os from 'os';
import { getTelegramConfig } from './config.js';
const STATE_FILE = path.join(os.homedir(), '.config', 'hugremote', 'telegram_topics.json');
class TopicManager {
    state = {
        enabledChats: {},
        bindings: {},
    };
    constructor() {
        this.loadState();
    }
    loadState() {
        if (fs.existsSync(STATE_FILE)) {
            try {
                const raw = fs.readFileSync(STATE_FILE, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    this.state = {
                        enabledChats: parsed.enabledChats || {},
                        bindings: parsed.bindings || {},
                    };
                }
            }
            catch (err) {
                console.error('[TopicManager] Error reading state:', err);
            }
        }
    }
    saveState() {
        try {
            const dir = path.dirname(STATE_FILE);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf8');
        }
        catch (err) {
            console.error('[TopicManager] Error saving state:', err);
        }
    }
    isTopicModeEnabled(chatId) {
        if (this.state.enabledChats[chatId] !== undefined) {
            return this.state.enabledChats[chatId];
        }
        return getTelegramConfig().topicModeDefault;
    }
    setTopicMode(chatId, enabled) {
        this.state.enabledChats[chatId] = enabled;
        this.saveState();
    }
    getBindingKey(chatId, threadId) {
        return `${chatId}:${threadId}`;
    }
    getBinding(chatId, threadId) {
        const key = this.getBindingKey(chatId, threadId);
        return this.state.bindings[key];
    }
    bind(chatId, threadId, sessionId, sessionName) {
        const key = this.getBindingKey(chatId, threadId);
        this.state.bindings[key] = {
            chatId,
            threadId,
            sessionId,
            sessionName,
            updatedAt: Date.now(),
        };
        this.saveState();
    }
    unbind(chatId, threadId) {
        const key = this.getBindingKey(chatId, threadId);
        delete this.state.bindings[key];
        this.saveState();
    }
    unbindSession(sessionId) {
        let changed = false;
        for (const [key, b] of Object.entries(this.state.bindings)) {
            if (b.sessionId === sessionId) {
                delete this.state.bindings[key];
                changed = true;
            }
        }
        if (changed)
            this.saveState();
    }
    getAllBindingsForChat(chatId) {
        return Object.values(this.state.bindings).filter((b) => b.chatId === chatId);
    }
    /**
     * Attempts to auto-rename a Telegram forum topic (best-effort, similar to Hermes Agent).
     */
    async autoRenameTopic(api, chatId, threadId, title) {
        if (!threadId || threadId === 1)
            return false;
        try {
            const cleanTitle = title.trim().slice(0, 60); // Telegram topic max length ~128 chars, keep concise
            if (!cleanTitle)
                return false;
            await api.editForumTopic(chatId, threadId, { name: cleanTitle });
            return true;
        }
        catch (_) {
            // Best-effort rename; errors (such as missing edit rights or private chat limitations) are silently ignored
            return false;
        }
    }
}
export const topicManager = new TopicManager();
