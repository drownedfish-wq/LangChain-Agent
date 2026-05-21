"""
RAG 检索增强生成模块
支持文档加载、向量化、相似度检索
"""
import os
from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import settings


class DocumentRetriever:
    """文档检索器：加载文档 → 分块 → 向量化 → 相似度检索"""

    def __init__(self, collection_name: str = "default"):
        self.collection_name = collection_name
        self._embeddings = OllamaEmbeddings(
            model="nomic-embed-text",
            base_url=settings.OLLAMA_BASE_URL,
        )
        self._vectorstore: Chroma | None = None
        self._text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
        )

    @property
    def vectorstore(self) -> Chroma:
        """懒加载向量数据库"""
        if self._vectorstore is None:
            persist_dir = os.path.join(settings.CHROMA_PERSIST_DIR, self.collection_name)
            self._vectorstore = Chroma(
                collection_name=self.collection_name,
                embedding_function=self._embeddings,
                persist_directory=persist_dir,
            )
        return self._vectorstore

    def load_pdf(self, file_path: str) -> list[Document]:
        """加载 PDF 文件"""
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        return self._text_splitter.split_documents(docs)

    def load_text(self, file_path: str) -> list[Document]:
        """加载文本文件"""
        loader = TextLoader(file_path, encoding="utf-8")
        docs = loader.load()
        return self._text_splitter.split_documents(docs)

    def add_documents(self, documents: list[Document]):
        """将文档添加到向量数据库"""
        self.vectorstore.add_documents(documents)

    def add_file(self, file_path: str):
        """加载文件并添加到向量数据库（自动识别格式）"""
        if file_path.endswith(".pdf"):
            chunks = self.load_pdf(file_path)
        elif file_path.endswith(".txt") or file_path.endswith(".md"):
            chunks = self.load_text(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")

        self.add_documents(chunks)
        return len(chunks)

    def search(self, query: str, k: int = 3) -> list[Document]:
        """相似度检索，返回最相关的 k 个文档片段"""
        return self.vectorstore.similarity_search(query, k=k)

    def query_with_rag(self, query: str, llm, k: int = 3) -> str:
        """RAG 问答：检索相关文档 + LLM 生成回答"""
        retriever = self.vectorstore.as_retriever(search_kwargs={"k": k})

        prompt = ChatPromptTemplate.from_template(
            "请根据以下参考内容回答问题。如果参考内容中没有相关信息，请说'我没有找到相关信息'。\n\n"
            "参考内容:\n{context}\n\n"
            "问题: {question}\n\n"
            "回答:"
        )

        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)

        rag_chain = (
            {"context": retriever | format_docs, "question": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )

        return rag_chain.invoke(query)
