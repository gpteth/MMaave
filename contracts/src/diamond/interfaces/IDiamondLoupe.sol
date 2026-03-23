// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IDiamondLoupe - ERC-2535 Diamond 自省接口
/// @notice 提供查询 Diamond 内部 facet 和函数映射的标准接口
/// @dev 用于 Diamond Explorer、Louper 等工具，也用于合约间的兼容性检查
interface IDiamondLoupe {
    /// @dev facet 地址及其注册的函数选择器
    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    /// @notice 返回所有 facet 及其函数选择器
    function facets() external view returns (Facet[] memory facets_);

    /// @notice 返回指定 facet 地址的所有函数选择器
    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory facetFunctionSelectors_);

    /// @notice 返回所有已注册的 facet 地址
    function facetAddresses() external view returns (address[] memory facetAddresses_);

    /// @notice 查询函数选择器对应的 facet 地址
    function facetAddress(bytes4 _functionSelector) external view returns (address facetAddress_);
}
