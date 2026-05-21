"""
带记忆的对话智能体
支持多轮对话 + 会话隔离
"""
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.chat_history import InMemoryChatMessageHistory

from agents.base_agent import BaseAgent
from memory.conversation_memory import ConversationMemory


class ChatAgent(BaseAgent):
    """带对话记忆的智能体，支持多会话隔离"""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.memory = ConversationMemory()

    def chat(self, message: str, conversation_id: str = "default") -> str:
        """带记忆的对话，自动维护对话历史"""
        # 获取历史消息
        history = self.memory.get_history(conversation_id)

        # 构建消息列表
        messages = [SystemMessage(content=self.system_prompt)]
        messages.extend(history)
        messages.append(HumanMessage(content=message))

        # 调用 LLM
        response = self.llm.invoke(messages)

        # 存储本轮对话
        self.memory.add_user_message(conversation_id, message)
        self.memory.add_ai_message(conversation_id, response.content)

        return response.content

    def chat_stream(self, message: str, conversation_id: str = "default"):
        """带记忆的流式对话"""
        history = self.memory.get_history(conversation_id)

        messages = [SystemMessage(content=self.system_prompt)]
        messages.extend(history)
        messages.append(HumanMessage(content=message))

        full_response = ""
        for chunk in self.llm.stream(messages):
            full_response += chunk.content
            yield chunk.content

        # 流式结束后存储完整回复
        self.memory.add_user_message(conversation_id, message)
        self.memory.add_ai_message(conversation_id, full_response)

    def clear_history(self, conversation_id: str = "default"):
        """清除指定会话的历史"""
        self.memory.clear(conversation_id)

    def list_conversations(self) -> list[str]:
        """列出所有会话 ID"""
        return self.memory.list_conversations()
