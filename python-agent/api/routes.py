"""
FastAPI 路由定义
提供智能体相关的 REST API 接口
"""
import json
import logging
import os
import shutil
import httpx
from fastapi import APIRouter, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.chat_agent import ChatAgent
from agents.tool_agent import ToolAgent
from rag.document_retriever import DocumentRetriever
from config import settings
from mcp_client import mcp_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["智能体"])

# 全局智能体实例
chat_agent = ChatAgent()
tool_agent = ToolAgent()

# 当前使用的模型（可动态切换）
current_model = settings.OLLAMA_MODEL


# ============ 请求模型 ============

class ChatRequest(BaseModel):
    message: str
    conversation_id: str = "default"

class ToolRequest(BaseModel):
    message: str

class FileUploadRequest(BaseModel):
    file_path: str
    collection_name: str = "default"

class RAGQueryRequest(BaseModel):
    query: str
    collection_name: str = "default"

class ModelSwitchRequest(BaseModel):
    model: str


# ============ 模型管理接口 ============

@router.get("/models")
async def list_models():
    """获取 Ollama 已安装的模型列表"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            data = resp.json()
            models = [
                {
                    "name": m["name"],
                    "size": round(m.get("size", 0) / 1e9, 2),  # GB
                    "modified": m.get("modified_at", ""),
                }
                for m in data.get("models", [])
            ]
            return {"models": models, "current": current_model}
    except Exception as e:
        return {"models": [], "current": current_model, "error": str(e)}


@router.post("/models/switch")
async def switch_model(req: ModelSwitchRequest):
    """切换当前使用的模型"""
    global current_model, chat_agent, tool_agent
    current_model = req.model
    # 重新创建智能体实例
    chat_agent = ChatAgent(model=current_model)
    tool_agent = ToolAgent(model=current_model)
    return {"message": f"已切换到模型 {current_model}", "current": current_model}


# ============ 文件上传接口 ============

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/files/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传文件到服务器，返回文件路径（可用于 RAG 或文件读取工具）"""
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        return {
            "message": f"文件 {file.filename} 上传成功",
            "file_path": file_path.replace("\\", "/"),
            "size": len(content),
        }
    except Exception as e:
        return {"error": f"上传失败: {e}"}


# ============ 基础对话接口 ============

@router.get("/chat/simple")
async def simple_chat(query: str = Query(..., description="用户输入")):
    """简单对话（无记忆）"""
    try:
        agent = ChatAgent()
        response = agent.chat(query)
        return {"response": response}
    except Exception as e:
        logger.error(f"对话失败: {e}")
        return {"error": f"模型调用失败，请检查 Ollama 是否已启动。详情: {e}"}


@router.post("/chat/memory")
async def memory_chat(req: ChatRequest):
    """带记忆的对话（支持多会话）"""
    try:
        response = chat_agent.chat(req.message, req.conversation_id)
        return {
            "response": response,
            "conversation_id": req.conversation_id,
        }
    except Exception as e:
        logger.error(f"记忆对话失败: {e}")
        return {"error": f"模型调用失败，请检查 Ollama 是否已启动。详情: {e}"}


@router.post("/chat/stream")
async def stream_chat(req: ChatRequest):
    """流式对话（SSE）"""
    def event_generator():
        for chunk in chat_agent.chat_stream(req.message, req.conversation_id):
            yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@router.delete("/chat/history/{conversation_id}")
async def clear_history(conversation_id: str):
    """清除会话历史"""
    chat_agent.clear_history(conversation_id)
    return {"message": f"会话 {conversation_id} 历史已清除"}


@router.get("/chat/conversations")
async def list_conversations():
    """列出所有会话"""
    return {"conversations": chat_agent.list_conversations()}


# ============ 工具调用智能体接口 ============

@router.post("/tool/run")
async def tool_run(req: ToolRequest):
    """运行工具调用智能体（ReAct 模式）"""
    try:
        response = await tool_agent.arun(req.message)
        return {"response": response}
    except Exception as e:
        logger.error(f"工具智能体失败: {e}")
        return {"error": f"模型调用失败，请检查 Ollama 是否已启动。详情: {e}"}


@router.get("/mcp/status")
async def mcp_status():
    return await mcp_manager.status()


@router.post("/mcp/reload")
async def mcp_reload():
    global tool_agent
    try:
        mcp_manager.clear_cache()
        await tool_agent.ensure_mcp_tools(force_reload=True)
        return await mcp_manager.status()
    except Exception as e:
        logger.error(f"MCP reload failed: {e}")
        return {"error": str(e)}


@router.post("/tool/stream")
async def tool_stream(req: ToolRequest):
    """流式运行工具调用智能体"""
    def event_generator():
        for chunk in tool_agent.run_stream(req.message):
            yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


# ============ RAG 检索增强接口 ============

@router.post("/rag/upload")
async def rag_upload(req: FileUploadRequest):
    """上传文件到知识库"""
    retriever = DocumentRetriever(collection_name=req.collection_name)
    chunk_count = retriever.add_file(req.file_path)
    return {
        "message": f"文件已添加到知识库 '{req.collection_name}'",
        "chunks": chunk_count,
    }


@router.post("/rag/query")
async def rag_query(req: RAGQueryRequest):
    """RAG 问答：基于知识库检索回答问题"""
    retriever = DocumentRetriever(collection_name=req.collection_name)
    from langchain_ollama import ChatOllama
    from config import settings

    llm = ChatOllama(
        model=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_BASE_URL,
    )
    response = retriever.query_with_rag(req.query, llm)
    return {"response": response}


@router.post("/rag/search")
async def rag_search(req: RAGQueryRequest):
    """相似度检索（不经过 LLM）"""
    retriever = DocumentRetriever(collection_name=req.collection_name)
    docs = retriever.search(req.query)
    return {
        "results": [
            {"content": doc.page_content, "metadata": doc.metadata}
            for doc in docs
        ]
    }
