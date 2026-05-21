"""
天气查询工具 - 模拟天气数据
可替换为真实天气 API（如和风天气、OpenWeatherMap）
"""
from langchain_core.tools import tool


@tool
def get_weather(city: str) -> str:
    """查询指定城市的天气信息。输入城市名称，返回天气描述。
    例如: '北京' 返回 '北京: 晴, 25°C, 湿度45%'
    """
    # 模拟天气数据（可替换为真实 API）
    mock_data = {
        "北京": "晴, 25°C, 湿度45%, 北风3级",
        "上海": "多云, 28°C, 湿度65%, 东南风2级",
        "广州": "雷阵雨, 30°C, 湿度80%, 南风2级",
        "深圳": "阴, 29°C, 湿度75%, 南风3级",
        "成都": "小雨, 22°C, 湿度85%, 微风",
        "杭州": "多云转晴, 27°C, 湿度60%, 东风2级",
        "武汉": "晴, 31°C, 湿度55%, 南风3级",
        "西安": "晴, 33°C, 湿度35%, 西北风2级",
    }

    result = mock_data.get(city)
    if result:
        return f"{city}: {result}"
    else:
        return f"暂无{city}的天气数据（这是模拟数据，可接入真实天气API）"
