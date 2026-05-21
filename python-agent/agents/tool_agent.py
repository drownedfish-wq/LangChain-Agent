"""
工具调用智能体（Tool-calling Agent）
基于 LangGraph 的 create_react_agent 实现 ReAct 模式
AI 自主决定调用哪个工具、传什么参数
"""
from langgraph.prebuilt import create_react_agent

from agents.base_agent import BaseAgent
from tools import ALL_TOOLS
from mcp_client import mcp_manager

SYSTEM_PROMPT = (
    "你是一个有用的AI助手。你可以使用工具来帮助回答问题。"
    "请先用思考分析问题，再决定是否需要使用工具。"
    "如果不需要工具，直接回答即可。"
)


class ToolAgent(BaseAgent):
    """支持工具调用的智能体，AI 可自主选择并调用工具"""

    def __init__(self, tools=None, **kwargs):
        super().__init__(**kwargs)
        self.tools = tools or ALL_TOOLS
        self._graph = None
        self._mcp_loaded = False

    @property
    def graph(self):
        """懒加载 ReAct Agent 图"""
        if self._graph is None:
            self._graph = create_react_agent(
                model=self.llm,
                tools=self.tools,
                prompt=SYSTEM_PROMPT,
            )
        return self._graph

    async def ensure_mcp_tools(self, force_reload: bool = False):
        if self._mcp_loaded and not force_reload:
            return self.tools

        mcp_tools = await mcp_manager.get_tools(force_reload=force_reload)
        existing_names = {getattr(tool, "name", "") for tool in self.tools}
        merged_tools = list(self.tools)
        for tool in mcp_tools:
            if getattr(tool, "name", "") not in existing_names:
                merged_tools.append(tool)

        self.tools = merged_tools
        self._graph = None
        self._mcp_loaded = True
        return self.tools

    def run(self, message: str) -> str:
        """运行智能体，自动决策是否使用工具"""
        result = self.graph.invoke(
            {"messages": [("user", message)]},
        )
        # 提取最后一条 AI 消息作为输出
        ai_messages = [
            m for m in result["messages"] if m.type == "ai"
        ]
        if ai_messages:
            return ai_messages[-1].content
        return ""

    async def arun(self, message: str) -> str:
        """Run with local tools plus configured MCP tools."""
        await self.ensure_mcp_tools()
        result = await self.graph.ainvoke(
            {"messages": [("user", message)]},
        )
        ai_messages = [
            m for m in result["messages"] if m.type == "ai"
        ]
        if ai_messages:
            return ai_messages[-1].content
        return ""

    def run_stream(self, message: str):
        """流式运行智能体"""
        for event in self.graph.stream(
            {"messages": [("user", message)]},
            stream_mode="values",
        ):
            if "messages" in event and event["messages"]:
                last_msg = event["messages"][-1]
                if last_msg.type == "tool":
                    yield f"[工具返回: {last_msg.content}]\n"
                elif last_msg.type == "ai" and last_msg.content:
                    # 只在消息有实际内容时输出（跳过工具调用中间态）
                    if not last_msg.tool_calls:
                        yield last_msg.content
