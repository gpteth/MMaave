// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/LibDiamond.sol";
import "./interfaces/IDiamondCut.sol";
import "./interfaces/IDiamondLoupe.sol";
import "./interfaces/IERC173.sol";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                     ERC-2535 Diamond Proxy 主合约                            ║
// ║                                                                              ║
// ║  ⚠️ 修改注意事项:                                                            ║
// ║  1. 此合约部署后不可升级（它是代理本身）。所有业务逻辑在 facet 中              ║
// ║  2. fallback() 中的 assembly 是核心路由逻辑，极度谨慎修改                     ║
// ║  3. 不要在 Diamond 合约中定义 public/external 函数                            ║
// ║     （会变成"不可变函数"，无法通过 diamondCut 移除）                           ║
// ║  4. receive() 保留用于接收 BNB，若不需要可移除                                ║
// ║  5. constructor 只注册 diamondCut 函数，后续通过 diamondCut 添加其他 facet     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/// @title MemePlus Diamond Proxy
/// @notice ERC-2535 Diamond 代理合约 - 所有外部调用通过 fallback 路由到对应 facet
/// @dev 部署流程:
///   1. 部署 DiamondCutFacet
///   2. 部署 Diamond(owner, diamondCutFacetAddr) — constructor 自动注册 diamondCut()
///   3. 部署其他 facet + DiamondInit
///   4. 调用 diamondCut() 批量注册所有 facet 的函数选择器，并调用 DiamondInit.init()
contract Diamond {
    /// @param _contractOwner Diamond 所有者（拥有 diamondCut 权限）
    /// @param _diamondCutFacet DiamondCutFacet 合约地址
    constructor(address _contractOwner, address _diamondCutFacet) payable {
        // 设置合约所有者（存储在 DiamondStorage 中）
        LibDiamond.setContractOwner(_contractOwner);

        // 注册 diamondCut() 函数选择器 → DiamondCutFacet
        // 这是唯一在 constructor 中注册的函数，后续所有 facet 通过它来添加
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory functionSelectors = new bytes4[](1);
        functionSelectors[0] = IDiamondCut.diamondCut.selector;
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: _diamondCutFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });
        LibDiamond.diamondCut(cut, address(0), "");
    }

    /// @notice 核心路由：将所有未匹配的调用 delegatecall 到对应的 facet
    /// @dev 工作流程:
    ///   1. 从 DiamondStorage 中查找 msg.sig (函数选择器) 对应的 facet 地址
    ///   2. 如果找不到 facet，revert（函数不存在）
    ///   3. 使用 delegatecall 调用 facet（在 Diamond 的存储上下文中执行）
    ///   4. 返回 facet 的返回值，或回滚 facet 的 revert
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        // 手动定位 DiamondStorage 的 slot
        assembly {
            ds.slot := position
        }
        // 通过函数选择器查找目标 facet 地址
        address facet = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
        // delegatecall 到 facet — facet 代码在 Diamond 的存储上下文中执行
        assembly {
            // 复制 calldata（函数选择器 + 参数）
            calldatacopy(0, 0, calldatasize())
            // 执行 delegatecall：facet 代码 + Diamond 存储
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // 复制返回数据
            returndatacopy(0, 0, returndatasize())
            // 根据执行结果决定 return 还是 revert
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    /// @notice 接收 BNB（如果不需要可移除）
    receive() external payable {}
}
