"""
测试 Monaco Editor 中 Python 语法高亮的各种颜色
"""

# 导入语句
import os
from typing import List, Dict, Optional
from collections import Counter

# 常量定义（全大写）
MAX_SIZE = 100
DEFAULT_TIMEOUT = 30
API_KEY = "secret-key"

# 内置异常类
class CustomError(Exception):
    """自定义异常类"""
    pass

# 装饰器定义
@property
def example_decorator(func):
    """装饰器示例"""
    def wrapper(*args, **kwargs):
        print("Before function call")
        result = func(*args, **kwargs)
        print("After function call")
        return result
    return wrapper

# 类定义
class DataProcessor:
    """数据处理器类"""
    
    def __init__(self, name: str, size: int = 100):
        """初始化方法（魔术方法）"""
        self.name = name  # 实例变量
        self.size = size
        self._private_var = None  # 私有变量
        
    @classmethod
    def from_config(cls, config: Dict):
        """类方法"""
        return cls(config.get('name', 'default'))
    
    @staticmethod
    def validate_input(data: str) -> bool:
        """静态方法"""
        return len(data) > 0
    
    def process_data(self, data: List[str]) -> Dict:
        """实例方法"""
        result = {}
        
        # 控制流关键字
        if not data:
            raise ValueError("Data cannot be empty")
        
        for item in data:
            if item in result:
                result[item] += 1
            else:
                result[item] = 1
        
        return result
    
    async def async_process(self, data):
        """异步方法"""
        await self._do_async_work(data)
    
    def __str__(self) -> str:
        """魔术方法 - 字符串表示"""
        return f"DataProcessor(name={self.name})"
    
    def __repr__(self) -> str:
        """魔术方法 - 对象表示"""
        return f"DataProcessor(name={self.name}, size={self.size})"

# 函数定义
def calculate_statistics(numbers: List[float]) -> Dict[str, float]:
    """计算统计数据"""
    if not numbers:
        return {}
    
    # 数字字面量测试
    total = sum(numbers)
    count = len(numbers)
    average = total / count
    
    # 十六进制数
    hex_value = 0xFF
    # 八进制数
    oct_value = 0o77
    # 二进制数
    bin_value = 0b1010
    # 浮点数
    float_value = 3.14159
    # 科学计数法
    sci_value = 1.23e-4
    
    return {
        'total': total,
        'average': average,
        'count': count,
        'max': max(numbers),
        'min': min(numbers)
    }

# 使用内置函数
def use_builtins():
    """测试内置函数高亮"""
    data = list(range(10))
    filtered = filter(lambda x: x > 5, data)
    mapped = map(str, filtered)
    result = ''.join(mapped)
    
    print(f"Result: {result}")
    print(f"Type: {type(result)}")
    print(f"Length: {len(result)}")
    
    # 类型关键字
    is_string = isinstance(result, str)
    is_number = isinstance(result, (int, float))
    
    return result

# f-string 测试
def test_fstrings():
    """测试 f-string 语法高亮"""
    name = "Python"
    version = 3.11
    
    # 单引号 f-string
    msg1 = f'Hello, {name}!'
    # 双引号 f-string
    msg2 = f"Version: {version}"
    # 多行 f-string
    msg3 = f"""
    Language: {name}
    Version: {version}
    Status: {'Active' if version >= 3.0 else 'Legacy'}
    """
    
    return msg1, msg2, msg3

# 字符串转义序列
def test_strings():
    """测试字符串高亮"""
    single = 'Single quote string'
    double = "Double quote string"
    triple_single = '''Triple single quote
    multiline string'''
    triple_double = """Triple double quote
    multiline string"""
    
    # 转义序列
    escaped = "Line 1\nLine 2\tTabbed\r\nWindows line"
    raw_string = r"Raw string with \n no escape"
    
    return single, double, escaped, raw_string

# 布尔和 None
def test_constants():
    """测试常量高亮"""
    is_true = True
    is_false = False
    nothing = None
    ellipsis = ...
    
    return is_true, is_false, nothing

# Lambda 和高阶函数
def test_lambda():
    """测试 lambda 表达式"""
    square = lambda x: x ** 2
    add = lambda x, y: x + y
    
    numbers = [1, 2, 3, 4, 5]
    squared = list(map(square, numbers))
    
    return squared

# 异常处理
def test_exceptions():
    """测试异常类高亮"""
    try:
        result = 10 / 0
    except ZeroDivisionError as e:
        print(f"Error: {e}")
    except (ValueError, TypeError) as e:
        print(f"Type error: {e}")
    except Exception as e:
        print(f"Unknown error: {e}")
    finally:
        print("Cleanup")

# 主函数
if __name__ == "__main__":
    # 使用所有功能
    processor = DataProcessor("test", 50)
    stats = calculate_statistics([1.0, 2.0, 3.0, 4.0, 5.0])
    builtin_test = use_builtins()
    fstring_test = test_fstrings()
    
    print("All tests completed!")
