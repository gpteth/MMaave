// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IERC173 - 合约所有权标准接口
/// @notice ERC-173: 提供所有权查询和转让的标准接口
/// @dev Diamond 通过 OwnershipFacet 实现此接口
interface IERC173 {
    /// @notice 所有权转让事件
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice 查询合约所有者
    function owner() external view returns (address owner_);

    /// @notice 转让所有权
    /// @param _newOwner 新所有者地址
    function transferOwnership(address _newOwner) external;
}
