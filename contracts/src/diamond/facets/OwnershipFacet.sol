// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IERC173.sol";
import "../libraries/LibDiamond.sol";

/// @title OwnershipFacet - Diamond 所有权管理
/// @notice 实现 ERC-173 标准，提供所有权查询和转让
/// @dev ⚠️ 修改注意事项:
///      1. owner 拥有 diamondCut 权限 — 转让所有权等同于转让 Diamond 完全控制权
///      2. transferOwnership 无需确认 — 转错地址将永久失去控制
///      3. 建议生产环境使用多签钱包作为 owner
contract OwnershipFacet is IERC173 {
    /// @notice 转让 Diamond 所有权
    /// @dev ⚠️ 不可逆操作! 确保 _newOwner 地址正确
    function transferOwnership(address _newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
    }

    /// @notice 查询当前 Diamond 所有者
    function owner() external view override returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }
}
