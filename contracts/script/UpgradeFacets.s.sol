// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/diamond/interfaces/IDiamondCut.sol";
import "../src/diamond/facets/ConfigFacet.sol";
import "../src/diamond/facets/InvestmentFacet.sol";

/// @title UpgradeFacets - 升级 ConfigFacet + InvestmentFacet
/// @notice 修复内容:
///   1. processStaticIncome try-catch (PancakeSwap 失败不阻塞结算)
///   2. 新增 recalculateVLevels (批量重算V级)
///   3. 新增 settleAndBatchClaim (一键推进epoch+结算)
contract UpgradeFacets is Script {
    address constant DIAMOND = 0xB3197881Cd985bDd7D442F03d534FC37169e0C96;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. 部署新的 facets
        ConfigFacet newConfig = new ConfigFacet();
        InvestmentFacet newInvestment = new InvestmentFacet();
        console.log("New ConfigFacet:", address(newConfig));
        console.log("New InvestmentFacet:", address(newInvestment));

        // 2. 准备 diamondCut 操作
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](3);

        // 2a. Replace: ConfigFacet 已有选择器 → 新地址
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(newConfig),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getConfigReplaceSelectors()
        });

        // 2b. Add: ConfigFacet 新函数 recalculateVLevels
        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(newConfig),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: _getConfigAddSelectors()
        });

        // 2c. Replace + Add: InvestmentFacet
        //     因为 LibMemePlus 修改了，所有引用它的函数都需要 Replace
        //     settleAndBatchClaim 是新函数需要 Add
        cuts[2] = IDiamondCut.FacetCut({
            facetAddress: address(newInvestment),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getInvestmentReplaceSelectors()
        });

        // 3. 执行 diamondCut
        IDiamondCut(DIAMOND).diamondCut(cuts, address(0), "");
        console.log("diamondCut executed (Replace ConfigFacet + Add recalculateVLevels + Replace InvestmentFacet)");

        // 4. 单独 Add settleAndBatchClaim（不能和 Replace 混在同一个 FacetCut 里）
        IDiamondCut.FacetCut[] memory addCuts = new IDiamondCut.FacetCut[](1);
        addCuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(newInvestment),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: _getInvestmentAddSelectors()
        });
        IDiamondCut(DIAMOND).diamondCut(addCuts, address(0), "");
        console.log("diamondCut executed (Add settleAndBatchClaim)");

        vm.stopBroadcast();
    }

    /// @dev ConfigFacet 已有选择器（需要 Replace 到新地址）
    function _getConfigReplaceSelectors() internal pure returns (bytes4[] memory) {
        bytes4[] memory s = new bytes4[](70);
        uint256 i;
        s[i++] = ConfigFacet.addAdmin.selector;
        s[i++] = ConfigFacet.removeAdmin.selector;
        s[i++] = ConfigFacet.hasRole.selector;
        s[i++] = ConfigFacet.freezeMember.selector;
        s[i++] = ConfigFacet.unfreezeMember.selector;
        s[i++] = ConfigFacet.pauseMember.selector;
        s[i++] = ConfigFacet.unpauseMember.selector;
        s[i++] = ConfigFacet.setCommunityLevel.selector;
        s[i++] = ConfigFacet.setMemberVLevel.selector;
        s[i++] = ConfigFacet.setMemberVLevelBatch.selector;
        s[i++] = ConfigFacet.setCommunityLevelBatch.selector;
        s[i++] = ConfigFacet.pause.selector;
        s[i++] = ConfigFacet.unpause.selector;
        s[i++] = ConfigFacet.setDailyReturnRate.selector;
        s[i++] = ConfigFacet.setStaticDynamicSplit.selector;
        s[i++] = ConfigFacet.setStaticDistribution.selector;
        s[i++] = ConfigFacet.setReferralRates.selector;
        s[i++] = ConfigFacet.setDynamicPoolSplit.selector;
        s[i++] = ConfigFacet.setCapMultiplier.selector;
        s[i++] = ConfigFacet.setWithdrawalFee.selector;
        s[i++] = ConfigFacet.setMinInvestment.selector;
        s[i++] = ConfigFacet.setMinWithdrawal.selector;
        s[i++] = ConfigFacet.setSameLevelBonus.selector;
        s[i++] = ConfigFacet.setVLevelThresholds.selector;
        s[i++] = ConfigFacet.setVLevelRates.selector;
        s[i++] = ConfigFacet.setCommunityRates.selector;
        s[i++] = ConfigFacet.setRestartMMCompPercent.selector;
        s[i++] = ConfigFacet.setRestartReferralRate.selector;
        s[i++] = ConfigFacet.setRestartReferralCap.selector;
        s[i++] = ConfigFacet.setRestartMMReleaseRate.selector;
        s[i++] = ConfigFacet.setPerpetualBCKPercent.selector;
        s[i++] = ConfigFacet.setBCKPrice.selector;
        s[i++] = ConfigFacet.setSettlementInterval.selector;
        s[i++] = ConfigFacet.setReceiverWallet.selector;
        s[i++] = ConfigFacet.setFeeCollector.selector;
        s[i++] = ConfigFacet.dailyReturnRate.selector;
        s[i++] = ConfigFacet.staticPercent.selector;
        s[i++] = ConfigFacet.dynamicPercent.selector;
        s[i++] = ConfigFacet.staticToBalance.selector;
        s[i++] = ConfigFacet.staticToBurn.selector;
        s[i++] = ConfigFacet.staticToLock.selector;
        s[i++] = ConfigFacet.referralGen1.selector;
        s[i++] = ConfigFacet.referralGen2.selector;
        s[i++] = ConfigFacet.referralGen3.selector;
        s[i++] = ConfigFacet.referralSharePercent.selector;
        s[i++] = ConfigFacet.teamSharePercent.selector;
        s[i++] = ConfigFacet.capMultiplier.selector;
        s[i++] = ConfigFacet.withdrawalFee.selector;
        s[i++] = ConfigFacet.minInvestment.selector;
        s[i++] = ConfigFacet.minWithdrawal.selector;
        s[i++] = ConfigFacet.sameLevelBonus.selector;
        s[i++] = ConfigFacet.vLevelThresholds.selector;
        s[i++] = ConfigFacet.vLevelRates.selector;
        s[i++] = ConfigFacet.communityRates.selector;
        s[i++] = ConfigFacet.restartMMCompPercent.selector;
        s[i++] = ConfigFacet.restartReferralRate.selector;
        s[i++] = ConfigFacet.restartReferralCap.selector;
        s[i++] = ConfigFacet.restartMMReleaseRate.selector;
        s[i++] = ConfigFacet.perpetualBCKPercent.selector;
        s[i++] = ConfigFacet.bckPrice.selector;
        s[i++] = ConfigFacet.receiverWallet.selector;
        s[i++] = ConfigFacet.paused.selector;
        s[i++] = ConfigFacet.settlementInterval.selector;
        s[i++] = ConfigFacet.feeCollector.selector;
        s[i++] = ConfigFacet.currentEpoch.selector;
        s[i++] = ConfigFacet.lastSettledAt.selector;
        s[i++] = ConfigFacet.isAdmin.selector;
        assembly { mstore(s, i) }
        return s;
    }

    /// @dev ConfigFacet 新增选择器
    function _getConfigAddSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = ConfigFacet.recalculateVLevels.selector;
    }

    /// @dev InvestmentFacet 已有选择器（需要 Replace）
    function _getInvestmentReplaceSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](5);
        s[0] = InvestmentFacet.register.selector;
        s[1] = InvestmentFacet.invest.selector;
        s[2] = InvestmentFacet.settle.selector;
        s[3] = InvestmentFacet.claimDailyReturn.selector;
        s[4] = InvestmentFacet.batchClaimDailyReturn.selector;
    }

    /// @dev InvestmentFacet 新增选择器
    function _getInvestmentAddSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = InvestmentFacet.settleAndBatchClaim.selector;
    }
}
