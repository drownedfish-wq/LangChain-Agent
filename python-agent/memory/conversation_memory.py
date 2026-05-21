"""
对话记忆管理
支持内存存储 + 会话隔离
"""
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.chat_history import InMemoryChatMessageHistory


class ConversationMemory:
    """对话记忆管理器，支持多会话隔离"""

    def __init__(self, max_messages: int = 20):
        self._stores: dict[str, InMemoryChatMessageHistory] = {}
        self.max_messages = max_messages

    def _get_store(self, conversation_id: str) -> InMemoryChatMessageHistory:
        """获取或创建会话存储"""
        if conversation_id not in self._stores:
            self._stores[conversation_id] = InMemoryChatMessageHistory()
        return self._stores[conversation_id]

    def get_history(self, conversation_id: str = "default") -> list[BaseMessage]:
        """获取指定会话的历史消息"""
        store = self._get_store(conversation_id)
        messages = store.messages
        # 保留最近 N 条消息，避免上下文过长
        if len(messages) > self.max_messages:
            messages = messages[-self.max_messages:]
        return messages

    def add_user_message(self, conversation_id: str, message: str):
        """添加用户消息"""
        store = self._get_store(conversation_id)
        store.add_user_message(message)

    def add_ai_message(self, conversation_id: str, message: str):
        """添加 AI 回复"""
        store = self._get_store(conversation_id)
        store.add_ai_message(message)

    def clear(self, conversation_id: str):
        """清除指定会话的历史"""
        if conversation_id in self._stores:
            del self._stores[conversation_id]

    def list_conversations(self) -> list[str]:
        """列出所有会话 ID"""
        return list(self._stores.keys())
