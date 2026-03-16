import asyncio
import numpy as np
from typing import List, Dict, Callable, Optional, Union
from dataclasses import dataclass
from abc import ABC, abstractmethod

# 装饰器：记录模型预测耗时
def timer_decorator(func: Callable) -> Callable:
    import time
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        print(f"[{func.__name__}] 耗时: {end_time - start_time:.4f}s")
        return result
    return wrapper

# 数据类：模型配置
@dataclass
class ModelConfig:
    model_name: str
    weight: float
    is_enabled: bool = True

# 抽象基类：基础模型
class BaseModel(ABC):
    def __init__(self, config: ModelConfig):
        self.config = config
        self.model_weights = None

    @abstractmethod
    @timer_decorator
    def predict(self, X: np.ndarray) -> np.ndarray:
        pass

# 具体模型实现：随机森林
class RandomForestModel(BaseModel):
    def __init__(self, config: ModelConfig, n_estimators: int = 100):
        super().__init__(config)
        self.n_estimators = n_estimators
        self._init_weights()

    def _init_weights(self):
        """初始化模型权重（模拟训练）"""
        self.model_weights = np.random.rand(self.n_estimators)
        self.model_weights /= self.model_weights.sum()  # 归一化

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.config.is_enabled:
            return np.zeros(X.shape[0])
        
        # 模拟随机森林预测：多棵树预测后加权
        tree_predictions = [np.random.randn(X.shape[0]) for _ in range(self.n_estimators)]
        final_pred = np.average(tree_predictions, weights=self.model_weights, axis=0)
        return final_pred * self.config.weight

# 具体模型实现：XGBoost
class XGBoostModel(BaseModel):
    def __init__(self, config: ModelConfig, max_depth: int = 5):
        super().__init__(config)
        self.max_depth = max_depth

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.config.is_enabled:
            return np.zeros(X.shape[0])
        
        # 模拟XGBoost预测：带复杂条件分支
        pred = np.zeros(X.shape[0])
        for i in range(X.shape[0]):
            if X[i].mean() > 0:
                pred[i] = np.exp(X[i].sum()) * 0.7
            elif X[i].std() < 1:
                pred[i] = np.log(X[i].sum() + 10) * 0.3
            else:
                pred[i] = np.random.rand() * self.config.weight
        return pred * self.config.weight

# 堆叠集成器（二级融合）
class StackingEnsemble:
    def __init__(self, base_models: List[BaseModel], meta_model: Callable):
        self.base_models = base_models
        self.meta_model = meta_model
        self._nested_cache: Dict[str, np.ndarray] = {}

    # 闭包：生成特征工程函数
    def _feature_engineering(self) -> Callable:
        def engineer(X: np.ndarray) -> np.ndarray:
            # 嵌套数据处理：拼接统计特征
            stats = np.hstack([
                np.mean(X, axis=1).reshape(-1, 1),
                np.std(X, axis=1).reshape(-1, 1),
                np.max(X, axis=1).reshape(-1, 1)
            ])
            return stats
        return engineer

    @timer_decorator
    async def predict_async(self, X: np.ndarray) -> np.ndarray:
        """异步预测：并行执行基模型预测"""
        # 过滤启用的模型
        enabled_models = [m for m in self.base_models if m.config.is_enabled]
        if not enabled_models:
            raise ValueError("无可用模型进行融合")

        # 异步执行所有基模型预测
        async def _single_model_predict(model: BaseModel):
            loop = asyncio.get_event_loop()
            pred = await loop.run_in_executor(None, model.predict, X)
            self._nested_cache[model.config.model_name] = pred
            return pred

        base_preds = await asyncio.gather(*[_single_model_predict(m) for m in enabled_models])
        base_preds_stack = np.column_stack(base_preds)

        # 特征工程（闭包调用）
        fe_func = self._feature_engineering()
        fe_features = fe_func(X)
        meta_X = np.hstack([base_preds_stack, fe_features])

        # 元模型预测（最终融合）
        final_pred = self.meta_model(meta_X)
        return final_pred

# 递归函数：调整模型权重
def adjust_weights(weights: List[float], target_sum: float = 1.0, depth: int = 0) -> List[float]:
    """递归归一化权重，模拟超参数调优"""
    if depth > 3:  # 递归终止条件
        return weights
    
    current_sum = sum(weights)
    if abs(current_sum - target_sum) < 1e-6:
        return weights
    
    adjusted = [w * target_sum / current_sum for w in weights]
    # 递归调优：轻微扰动后再次调整
    perturbed = [w * (1 + np.random.randn() * 0.01) for w in adjusted]
    return adjust_weights(perturbed, target_sum, depth + 1)

# 主函数：完整流程演示
async def main():
    # 1. 配置模型
    model_configs = [
        ModelConfig("random_forest", weight=0.4),
        ModelConfig("xgboost", weight=0.6)
    ]
    
    # 2. 初始化模型
    rf_model = RandomForestModel(model_configs[0], n_estimators=50)
    xgb_model = XGBoostModel(model_configs[1], max_depth=4)
    
    # 3. 调整权重（递归）
    raw_weights = [mc.weight for mc in model_configs]
    adjusted_weights = adjust_weights(raw_weights)
    for i, w in enumerate(adjusted_weights):
        model_configs[i].weight = w
    
    # 4. 定义元模型（简单线性融合）
    def meta_model(X: np.ndarray) -> np.ndarray:
        return np.sum(X * np.array([0.7, 0.3, 0.1, 0.1, 0.1]), axis=1)
    
    # 5. 初始化堆叠集成器
    ensemble = StackingEnsemble([rf_model, xgb_model], meta_model)
    
    # 6. 生成测试数据
    test_X = np.random.randn(100, 10)  # 100样本，10特征
    
    # 7. 异步预测
    try:
        final_predictions = await ensemble.predict_async(test_X)
        print(f"融合预测结果形状: {final_predictions.shape}")
        print(f"前5个预测值: {final_predictions[:5]}")
    except Exception as e:
        print(f"预测出错: {e}")

# 执行主流程
if __name__ == "__main__":
    # 修复Windows异步事件循环问题（兼容性处理）
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except:
        pass
    asyncio.run(main())