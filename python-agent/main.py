"""
Python 本地智能体 - 后端 API 服务（前后端分离）
启动 FastAPI 服务，提供智能体 REST API

使用方式:
    1. 复制 .env.example 为 .env 并修改配置
    2. pip install -r requirements.txt
    3. 确保 Ollama 已启动 (ollama serve)
    4. python main.py
    5. 前端访问 http://localhost:3000 (需单独启动前端)
    6. API 文档 http://localhost:8000/docs
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from config import settings

app = FastAPI(
    title="本地智能体平台",
    description="基于 LangChain + Ollama 的本地智能体系统，支持工具调用、对话记忆和 RAG",
    version="1.0.0",
)

# 跨域支持
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(router)


@app.get("/")
async def root():
    """根路径 - 服务状态"""
    return {
        "service": "本地智能体平台（后端API）",
        "version": "1.0.0",
        "model": settings.OLLAMA_MODEL,
        "ollama_url": settings.OLLAMA_BASE_URL,
        "api_docs": "/docs",
        "frontend": "http://localhost:3000",
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}


if __name__ == "__main__":
    print("=" * 50)
    print("  本地智能体平台 启动中...")
    print(f"  模型: {settings.OLLAMA_MODEL}")
    print(f"  Ollama: {settings.OLLAMA_BASE_URL}")
    print(f"  前端界面: http://localhost:3000 (需单独启动)")
    print(f"  API文档: http://localhost:{settings.SERVER_PORT}/docs")
    print("=" * 50)
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.SERVER_PORT,
        reload=True,
    )
