"""
工具模块
注册所有可被智能体调用的工具
"""
from tools.calculator import calculator
from tools.weather import get_weather
from tools.search import web_search
from tools.file_reader import read_file_content

ALL_TOOLS = [calculator, get_weather, web_search, read_file_content]

__all__ = ["ALL_TOOLS", "calculator", "get_weather", "web_search", "read_file_content"]
