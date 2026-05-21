"""
计算器工具 - 支持数学表达式求值
"""
from langchain_core.tools import tool


@tool
def calculator(expression: str) -> str:
    """计算数学表达式的结果。输入一个数学表达式字符串，返回计算结果。
    支持加减乘除、幂运算、括号等。例如: '2 + 3 * 4' 或 '(10 - 2) ** 3'
    """
    try:
        # 安全求值：只允许数学运算
        allowed_chars = set("0123456789+-*/.() ")
        if not all(c in allowed_chars for c in expression):
            return "错误：表达式包含不允许的字符，只支持数字和基本运算符(+,-,*,/,**)"
        result = eval(expression)
        return f"{expression} = {result}"
    except ZeroDivisionError:
        return "错误：除数不能为零"
    except Exception as e:
        return f"计算错误：{e}"
