"""
项目全局配置
支持从 .env 文件加载，也可通过环境变量覆盖
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Ollama 本地模型
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "deepseek-r1:1.5b")

    # DashScope 云端模型（备用）
    DASHSCOPE_API_KEY: str = os.getenv("DASHSCOPE_API_KEY", "")
    DASHSCOPE_MODEL: str = os.getenv("DASHSCOPE_MODEL", "qwen-plus")

    # 向量数据库
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma")

    # 服务
    MCP_CONFIG_FILE: str = os.getenv("MCP_CONFIG_FILE", "mcp_servers.json")
    SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))


settings = Settings()
