"""
文件读取工具 - 让智能体能够读取本地文件内容
"""
from langchain_core.tools import tool
from pathlib import Path


@tool
def read_file_content(file_path: str) -> str:
    """读取本地文件的内容。输入文件的绝对路径，返回文件内容字符串。
    支持 .txt, .py, .java, .json, .md, .csv 等文本文件。
    例如: 'D:/文档/notes.txt'
    """
    try:
        path = Path(file_path)
        if not path.exists():
            return f"错误：文件不存在 - {file_path}"
        if not path.is_file():
            return f"错误：路径不是文件 - {file_path}"

        # 限制文件大小（10MB）
        if path.stat().st_size > 10 * 1024 * 1024:
            return "错误：文件过大（超过10MB），请读取较小的文件"

        # 只允许读取文本文件
        text_extensions = {
            ".txt", ".py", ".java", ".js", ".ts", ".json", ".md",
            ".csv", ".xml", ".yaml", ".yml", ".html", ".css",
            ".sql", ".sh", ".bat", ".properties", ".conf", ".log",
        }
        if path.suffix.lower() not in text_extensions:
            return f"错误：不支持读取 {path.suffix} 格式的文件，仅支持文本文件"

        content = path.read_text(encoding="utf-8")
        # 截断过长内容
        if len(content) > 5000:
            content = content[:5000] + "\n\n... (内容已截断，共{}字符)".format(len(content))
        return content

    except UnicodeDecodeError:
        return "错误：文件编码无法识别，请确保是 UTF-8 文本文件"
    except Exception as e:
        return f"读取文件错误：{e}"
