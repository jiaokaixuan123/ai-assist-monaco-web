"""
Python 语法高亮测试文件
用于验证 Monaco Editor 的语法高亮是否正确工作
"""

# ==================== 导入测试 ====================
import sys
import os
from typing import List, Dict, Optional, Union
from dataclasses import dataclass
from enum import Enum


# ==================== 常量和变量 ====================
CONSTANT_NUMBER = 42
CONSTANT_STRING = "Hello, World!"
CONSTANT_FLOAT = 3.14159


global_variable = None


# ==================== 装饰器测试 ====================
def simple_decorator(func):
    """简单装饰器"""
    def wrapper(*args, **kwargs):
        print(f"调用函数: {func.__name__}")
        return func(*args, **kwargs)
    return wrapper


@simple_decorator
def decorated_function():
    """被装饰的函数"""
    return "装饰器测试"


# ==================== 类定义测试 ====================
@dataclass
class Person:
    """数据类示例"""
    name: str
    age: int
    email: Optional[str] = None
    
    def greet(self) -> str:
        """问候方法"""
        return f"Hello, I'm {self.name}, {self.age} years old"


class Color(Enum):
    """枚举类示例"""
    RED = 1
    GREEN = 2
    BLUE = 3 
    


class Calculator:
    """计算器类示例"""
    
    CLASS_CONSTANT = 100
    
    def __init__(self, initial_value: int = 0):
        """初始化方法"""
        self.value = initial_value
        self._history: List[int] = []
    
    @property
    def current_value(self) -> int:
        """属性装饰器"""
        return self.value
    
    @staticmethod
    def add_numbers(a: int, b: int) -> int:
        """静态方法"""
        return a + b
    
    @classmethod
    def from_string(cls, value_str: str) -> 'Calculator':
        """类方法"""
        return cls(int(value_str))
    
    def calculate(self, operation: str, operand: int) -> int:
        """计算方法"""
        if operation == '+':
            self.value += operand
        elif operation == '-':
            self.value -= operand
        elif operation == '*':
            self.value *= operand
        elif operation == '/':
            self.value //= operand if operand != 0 else 1
        
        self._history.append(self.value)
        return self.value


# ==================== 异步函数测试 ====================
async def async_function(delay: float) -> str:
    """异步函数示例"""
    # 模拟异步操作
    result = f"异步操作完成，延迟: {delay}秒"
    return result


async def async_generator(n: int):
    """异步生成器"""
    for i in range(n):
        yield i * i




# ==================== 生成器和推导式 ====================
def number_generator(n: int):
    """普通生成器"""
    for i in range(n):
        yield i * 2


def comprehension_examples():
    """各种推导式示例"""
    # 列表推导式
    squares = [x**2 for x in range(10)]
    
    # 字典推导式
    square_dict = {x: x**2 for x in range(5)}
    
    # 集合推导式
    even_set = {x for x in range(20) if x % 2 == 0}
    
    # 生成器表达式
    gen = (x * 3 for x in range(10))
    
    return squares, square_dict, even_set, list(gen)


# ==================== 字符串测试 ====================
def string_examples():
    """字符串格式化示例"""
    name = "Python"
    version = 3.11
    
    # 普通字符串
    simple = "Hello, World!"
    
    # 单引号字符串
    single = 'Single quoted'
    
    # 三引号字符串
    multi = """
    这是一个
    多行字符串
    """
    
    # f-string
    formatted = f"语言: {name}, 版本: {version}"
    formatted_expr = f"计算结果: {2 + 2}"
    
    # r-string (原始字符串)
    raw = r"C:\Users\Path\To\File"
    
    # 字符串拼接
    concat = "Hello, " + "World!"
    
    # 转义序列
    escaped = "Tab:\t, 换行:\n, 引号:\", 反斜杠:\\"
    
    return simple, single, multi, formatted, raw, concat, escaped


# ==================== 数字测试 ====================
def number_examples():
    """各种数字格式"""
    # 整数
    decimal = 42
    negative = -100
    
    # 浮点数
    float_num = 3.14
    scientific = 1.5e10
    
    # 十六进制
    hex_num = 0xFF
    
    # 八进制
    oct_num = 0o77
    
    # 二进制
    bin_num = 0b1010
    
    # 复数
    complex_num = 3 + 4j
    
    return decimal, float_num, hex_num, oct_num, bin_num, complex_num


# ==================== 控制流测试 ====================
def control_flow_examples(value: int) -> str:
    """控制流语句"""
    result = []
    
    # if-elif-else
    if value > 0:
        result.append("正数")
    elif value < 0:
        result.append("负数")
    else:
        result.append("零")
    
    # for 循环
    for i in range(5):
        if i == 3:
            continue
        if i == 10:
            break
        result.append(f"循环: {i}")
    
    # while 循环
    count = 0
    while count < 3:
        result.append(f"while: {count}")
        count += 1
    
    # try-except-finally
    try:
        division = 10 / value
        result.append(f"除法结果: {division}")
    except ZeroDivisionError:
        result.append("除零错误")
    except Exception as e:
        result.append(f"其他错误: {e}")
    finally:
        result.append("清理工作")
    
    # with 语句
    with open(__file__, 'r', encoding='utf-8') as f:
        line_count = len(f.readlines())
        result.append(f"文件行数: {line_count}")
    
    return " | ".join(result)


# ==================== Lambda 和高阶函数 ====================
def functional_programming():
    """函数式编程示例"""
    numbers = [1, 2, 3, 4, 5]
    
    # lambda 表达式
    square = lambda x: x ** 2
    add = lambda a, b: a + b
    
    # map
    squared = list(map(lambda x: x ** 2, numbers))
    
    # filter
    evens = list(filter(lambda x: x % 2 == 0, numbers))
    
    # reduce (需要 from functools import reduce)
    # total = reduce(lambda a, b: a + b, numbers)
    
    return squared, evens


# ==================== 类型注解测试 ====================
def type_annotations(
    name: str,
    age: int,
    scores: List[float],
    metadata: Dict[str, Union[str, int]],
    optional_value: Optional[str] = None
) -> Dict[str, any]:
    """完整的类型注解示例"""
    return {
        'name': name,
        'age': age,
        'average_score': sum(scores) / len(scores) if scores else 0,
        'metadata': metadata,
        'has_optional': optional_value is not None
    }


# ==================== 主函数 ====================
def main():
    """主函数 - 测试所有功能"""
    print("=" * 60)
    print("Python 语法高亮测试")
    print("=" * 60)
    
    # 测试装饰器
    print("\n1. 装饰器测试:")
    print(decorated_function())
    
    # 测试类
    print("\n2. 类测试:")
    person = Person("Alice", 30, "alice@example.com")
    print(person.greet())
    
    # 测试计算器
    print("\n3. 计算器测试:")
    calc = Calculator(10)
    print(f"初始值: {calc.current_value}")
    calc.calculate('+', 5)
    print(f"加5后: {calc.current_value}")
    
    # 测试枚举
    print("\n4. 枚举测试:")
    print(f"颜色: {Color.RED.name} = {Color.RED.value}")
    
    # 测试推导式
    print("\n5. 推导式测试:")
    squares, square_dict, even_set, gen_list = comprehension_examples()
    print(f"平方列表: {squares[:5]}")
    print(f"平方字典: {square_dict}")
    
    # 测试字符串
    print("\n6. 字符串测试:")
    strings = string_examples()
    print(f"f-string: {strings[3]}")
    
    # 测试数字
    print("\n7. 数字测试:")
    numbers = number_examples()
    print(f"十六进制: {numbers[2]}, 二进制: {numbers[4]}")
    
    # 测试控制流
    print("\n8. 控制流测试:")
    flow_result = control_flow_examples(5)
    print(flow_result[:100] + "...")
    
    # 测试函数式编程
    print("\n9. 函数式编程测试:")
    squared, evens = functional_programming()
    print(f"平方: {squared}, 偶数: {evens}")
    
    # 测试类型注解
    print("\n10. 类型注解测试:")
    result = type_annotations(
        "Bob",
        25,
        [85.5, 90.0, 88.5],
        {"course": "Python", "semester": 1}
    )
    print(f"结果: {result}")
    
    print("\n" + "=" * 60)
    print("✅ 所有测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
