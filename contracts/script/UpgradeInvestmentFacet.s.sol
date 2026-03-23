// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/diamond/interfaces/IDiamondCut.sol";
import "../src/diamond/facets/InvestmentFacet.sol";

/// @title UpgradeInvestmentFacet - 升级 InvestmentFacet + 添加 investFromBalance
/// @notice Replace 已有 6 个选择器 + Add 新增 investFromBalance 选择器
contract UpgradeInvestmentFacet is Script {
    address constant DIAMOND = 0xB3197881Cd985bDd7D442F03d534FC37169e0C96;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. 部署新的 InvestmentFacet
        InvestmentFacet newFacet = new InvestmentFacet();
        console.log("New InvestmentFacet:", address(newFacet));

        // 2. 两个 cut: Replace 已有选择器 + Add 新选择器
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](2);

        // Replace 已有的 6 个函数
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(newFacet),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getExistingSelectors()
        });

        // Add 新增的 investFromBalance
        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(newFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: _getNewSelectors()
        });

        IDiamondCut(DIAMOND).diamondCut(cuts, address(0), "");
        console.log("diamondCut Replace + Add InvestmentFacet done");

        vm.stopBroadcast();
    }

    /// @dev 已有的 6 个选择器 (Replace)
    function _getExistingSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](6);
        s[0] = InvestmentFacet.register.selector;
        s[1] = InvestmentFacet.invest.selector;
        s[2] = InvestmentFacet.settle.selector;
        s[3] = InvestmentFacet.claimDailyReturn.selector;
        s[4] = InvestmentFacet.batchClaimDailyReturn.selector;
        s[5] = InvestmentFacet.settleAndBatchClaim.selector;
    }

    /// @dev 新增的选择器 (Add)
    function _getNewSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = InvestmentFacet.investFromBalance.selector;
    }
}
