// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDiamondCut.sol";
import "../libraries/LibDiamond.sol";

/// @title DiamondCutFacet - Diamond 升级入口
/// @notice 实现 ERC-2535 的 diamondCut() 函数，用于添加/替换/移除 facet 函数
/// @dev ⚠️ 修改注意事项:
///      1. 这是 Diamond 最关键的 facet — 如果此 facet 坏了，整个 Diamond 无法升级
///      2. 仅 owner 可调用（通过 enforceIsContractOwner 验证）
///      3. 此 facet 的选择器在 Diamond constructor 中注册，是第一个被添加的 facet
///      4. 升级此 facet 时要用 Replace 操作将 diamondCut 选择器指向新地址
///      5. 切勿 Remove diamondCut 选择器（否则无法再添加/替换任何函数）
contract DiamondCutFacet is IDiamondCut {
    /// @notice 添加/替换/移除函数并可选执行初始化
    /// @param _diamondCut FacetCut 数组 — 每项指定 facet 地址、操作类型、函数选择器
    /// @param _init 初始化合约地址（address(0) = 不初始化）
    /// @param _calldata 初始化调用数据（abi.encodeWithSelector(init.selector, args)）
    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }
}
