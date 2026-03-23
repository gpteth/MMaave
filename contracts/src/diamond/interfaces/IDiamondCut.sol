// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IDiamondCut - ERC-2535 Diamond Cut 接口
/// @notice 定义添加/替换/移除 facet 函数的标准接口
/// @dev 任何 ERC-2535 Diamond 必须实现此接口
interface IDiamondCut {
    /// @dev 操作类型枚举
    ///      Add:     添加新函数（选择器不能已存在）
    ///      Replace: 替换已有函数的 facet 实现（用于升级）
    ///      Remove:  移除函数（facetAddress 必须为 address(0)）
    enum FacetCutAction { Add, Replace, Remove }

    /// @dev 单次 cut 操作的参数
    struct FacetCut {
        address facetAddress;           // 目标 facet 地址（Remove 时必须为 address(0)）
        FacetCutAction action;          // 操作类型
        bytes4[] functionSelectors;     // 受影响的函数选择器列表
    }

    /// @notice 添加/替换/移除任意数量的函数，并可选执行初始化
    /// @param _diamondCut 要执行的 cut 操作数组
    /// @param _init 初始化合约地址（address(0) = 不初始化）
    /// @param _calldata 初始化调用数据
    function diamondCut(FacetCut[] calldata _diamondCut, address _init, bytes calldata _calldata) external;

    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);
}
