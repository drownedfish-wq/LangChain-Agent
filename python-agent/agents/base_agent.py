"""

智能体基类
封装 LLM 初始化、对话调用等公共逻辑
"""
from langchain_ollama import ChatOllama
from langchain_core.language_models import BaseChatModel

from config import settings


class BaseAgent:
    """智能体基类，提供 LLM 实例化和基础对话能力"""

    def __init__(
        self,
        model: str | None = None,
        base_url: str | None = None,
        temperature: float = 0.7,
        system_prompt: str = "你是一个有用的AI助手。",
    ):
        self.model_name = model or settings.OLLAMA_MODEL
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.temperature = temperature
        self.system_prompt = system_prompt
        self._llm: BaseChatModel | None = None

    @property
    def llm(self) -> BaseChatModel:
        """懒加载 LLM 实例"""
        if self._llm is None:
            self._llm = ChatOllama(
                model=self.model_name,
                base_url=self.base_url,
                temperature=self.temperature,
            )
        return self._llm

    def chat(self, message: str) -> str:
        """简单对话，不保留记忆"""
        from langchain_core.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=message),
        ]
        response = self.llm.invoke(messages)
        return response.content

    def chat_stream(self, message: str):
        """流式对话"""
        from langchain_core.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=message),
        ]
        for chunk in self.llm.stream(messages):
            yield chunk.content
