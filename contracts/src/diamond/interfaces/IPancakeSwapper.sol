// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPancakeSwapper - PancakeSwap 代币交换接口
/// @notice 静态收益处理时通过此接口进行 USDT → MM 的交换操作
/// @dev 实现合约需部署在 BSC 上并连接 PancakeSwap Router
interface IPancakeSwapper {
    /// @notice 用 USDT 买入 MM 并销毁（发送到 dead 地址）
    /// @param usdtAmount 花费的 USDT 数量
    /// @param minAmountOut 最低获得的 MM 数量（滑点保护，0 = 不限制）
    function buyAndBurn(uint256 usdtAmount, uint256 minAmountOut) external;

    /// @notice 用 USDT 买入 MM 并锁仓给指定用户
    /// @param usdtAmount 花费的 USDT 数量
    /// @param user 接收锁仓 MM 的用户地址
    /// @param minAmountOut 最低获得的 MM 数量（滑点保护，0 = 不限制）
    function buyForLock(uint256 usdtAmount, address user, uint256 minAmountOut) external;
}
