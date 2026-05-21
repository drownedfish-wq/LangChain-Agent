"""
网页搜索工具 - 模拟搜索结果
可替换为真实搜索 API（如 Tavily、SerpAPI）
"""
from langchain_core.tools import tool


@tool
def web_search(query: str) -> str:
    """在网络上搜索信息。输入搜索关键词，返回搜索结果摘要。
    例如: 'Python 教程' 返回相关搜索结果
    """
    # 模拟搜索结果（可替换为 Tavily / SerpAPI 等真实搜索 API）
    mock_results = {
        "python": "Python是一种广泛使用的高级编程语言。官方文档: https://docs.python.org",
        "langchain": "LangChain是一个用于构建LLM应用的开源框架。官网: https://python.langchain.com",
        "ollama": "Ollama是一个本地运行大语言模型的工具。官网: https://ollama.com",
        "spring ai": "Spring AI是Spring生态的AI集成框架。官网: https://spring.io/projects/spring-ai",
    }

    query_lower = query.lower()
    for key, value in mock_results.items():
        if key in query_lower:
            return value

    return f"搜索 '{query}' 的结果：（这是模拟数据，可接入 Tavily/SerpAPI 等真实搜索API获取实际结果）"
