// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDiamondLoupe.sol";
import "../libraries/LibDiamond.sol";

/// @title DiamondLoupeFacet - Diamond 自省查询
/// @notice 实现 ERC-2535 的 IDiamondLoupe 接口，用于查询 Diamond 的 facet 和函数映射
/// @dev ⚠️ 修改注意事项:
///      1. 这些都是 view 函数，不涉及存储写入
///      2. 前端和工具（如 Louper）依赖这些接口来展示 Diamond 结构
///      3. supportsInterface 用于 ERC-165 兼容性检查
contract DiamondLoupeFacet is IDiamondLoupe {
    /// @notice 返回所有 facet 及其函数选择器
    /// @dev 用于 Diamond Explorer 等工具展示完整的 facet 结构
    function facets() external view override returns (Facet[] memory facets_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 numFacets = ds.facetAddresses.length;
        facets_ = new Facet[](numFacets);
        for (uint256 i; i < numFacets; i++) {
            address facetAddress_ = ds.facetAddresses[i];
            facets_[i].facetAddress = facetAddress_;
            facets_[i].functionSelectors = ds.facetFunctionSelectors[facetAddress_].functionSelectors;
        }
    }

    /// @notice 返回指定 facet 的所有函数选择器
    function facetFunctionSelectors(address _facet)
        external view override returns (bytes4[] memory facetFunctionSelectors_)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facetFunctionSelectors_ = ds.facetFunctionSelectors[_facet].functionSelectors;
    }

    /// @notice 返回所有 facet 地址
    function facetAddresses() external view override returns (address[] memory facetAddresses_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facetAddresses_ = ds.facetAddresses;
    }

    /// @notice 查询某个函数选择器对应的 facet 地址
    /// @dev 如果选择器未注册，返回 address(0)
    function facetAddress(bytes4 _functionSelector) external view override returns (address facetAddress_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facetAddress_ = ds.selectorToFacetAndPosition[_functionSelector].facetAddress;
    }

    /// @notice ERC-165 接口支持查询
    function supportsInterface(bytes4 _interfaceId) external view returns (bool) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.supportedInterfaces[_interfaceId];
    }
}
