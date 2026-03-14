"""
这个文件展示所有 Python 语法的颜色高亮
"""
from typing import List, Dict, Optional
import os

# 常量定义 - 应该是亮蓝色
MAX_SIZE = 1000
DEFAULT_PORT = 8080
API_KEY = "secret"

# 内置异常 - 应该是橙红色
class CustomError(Exception):
    """自定义异常类"""
    pass

class ValidationError(ValueError):
    """验证错误"""
    pass

# 普通类 - 应该是青色加粗
class Person:
    """人类"""
    
    def __init__(self, name: str, age: int):
        """魔术方法 - 应该是紫色斜体"""
        self.name = name  # self 应该是浅蓝斜体
        self.age = age
    
    def __str__(self) -> str:
        """魔术方法"""
        return f"{self.name} is {self.age} years old"
    
    def __repr__(self):
        """魔术方法"""
        return f"Person(name='{self.name}', age={self.age})"
    
    def greet(self):
        """普通方法 - 方法名应该是黄色加粗"""
        print(f"Hello, I'm {self.name}")
    
    @classmethod
    def create_adult(cls, name: str):
        """类方法 - cls 应该是浅蓝斜体"""
        return cls(name, 18)
    
    @staticmethod
    def get_species():
        """静态方法"""
        return "Homo sapiens"

# 装饰器 - 应该是黄色
@property
def decorated_function():
    """装饰器函数"""
    pass

# 函数定义 - 函数名应该是黄色加粗
def calculate_sum(numbers: List[int]) -> int:
    """计算总和"""
    total = 0
    for num in numbers:
        total += num
    return total

def process_data(data: Dict[str, any]) -> Optional[str]:
    """处理数据"""
    if not data:
        raise ValidationError("Data cannot be empty")
    
    try:
        result = data.get("result")
        return str(result)
    except (KeyError, TypeError) as e:
        print(f"Error: {e}")
        return None
    finally:
        print("Processing complete")

# 各种数字格式 - 应该是不同的绿色/蓝色
decimal_num = 42
float_num = 3.14159
hex_num = 0xFF00AA
octal_num = 0o755
binary_num = 0b1010

# 字符串格式 - 应该是橙色
single_str = 'hello'
double_str = "world"
triple_str = """
multi-line
string
"""
fstring = f"Result: {decimal_num}"
raw_string = r"C:\path\to\file"

# 转义序列 - 应该是金黄色
escaped = "Line 1\nLine 2\tTabbed"
unicode_str = "Unicode: \u03B1\u03B2\u03B3"

# 布尔值和 None - 应该是蓝色
is_valid = True
is_enabled = False
default_value = None

# 内置函数 - 应该是黄色
length = len(single_str)
total = sum([1, 2, 3])
items = list(range(10))
mapping = dict(a=1, b=2)

# 类型提示 - 应该是青色
def typed_function(param: int) -> str:
    return str(param)

# 注释 - 应该是绿色斜体
# This is a single-line comment

"""
多行注释
应该也是绿色斜体
"""
