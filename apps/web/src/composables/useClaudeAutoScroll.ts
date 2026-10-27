import type { ComputedRef } from 'vue';
import { watch } from 'vue';
import type { ClaudeMessage } from '@hugremote/shared';

/**
 * Follow revisions of the currently running assistant message. The message row
 * is created once, then grows in place as thinking, text, tools and agent events
 * arrive, so watching only the message-array length is insufficient.
 */
export function watchClaudeLiveMessageForAutoScroll(
  liveMessage: ComputedRef<ClaudeMessage | null>,
  scrollToBottom: () => void
) {
  return watch(
    () => {
      const message = liveMessage.value;
      if (!message) return null;
      return {
        text: message.text || '',
        thinking: message.thinking || '',
        isThinking: Boolean(message.isThinking),
        isWorking: Boolean(message.isWorking),
        tools: message.tools || [],
        interactions: message.interactions || [],
        childAgents: message.childAgents || [],
      };
    },
    () => {
      scrollToBottom();
    },
    { deep: true, flush: 'post' }
  );
}
