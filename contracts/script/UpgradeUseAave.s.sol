// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/diamond/interfaces/IDiamondCut.sol";
import "../src/diamond/facets/InvestmentFacet.sol";
import "../src/diamond/facets/WithdrawFacet.sol";
import "../src/diamond/facets/ConfigFacet.sol";

/// @title UpgradeUseAave - 添加 Aave 出入金开关功能
/// @notice 升级 3 个 facet + 添加 2 个新选择器:
///   1. InvestmentFacet: invest() 根据 useAave 切换 Aave/receiverWallet 路由
///   2. WithdrawFacet: withdraw() 根据 useAave 切换 Aave/receiverWallet 路由
///   3. ConfigFacet: 新增 setUseAave(bool) + useAave() getter
contract UpgradeUseAave is Script {
    address constant DIAMOND = 0xB3197881Cd985bDd7D442F03d534FC37169e0C96;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. 部署新 facets
        InvestmentFacet newInvestFacet = new InvestmentFacet();
        console.log("New InvestmentFacet:", address(newInvestFacet));

        WithdrawFacet newWithdrawFacet = new WithdrawFacet();
        console.log("New WithdrawFacet:", address(newWithdrawFacet));

        ConfigFacet newConfigFacet = new ConfigFacet();
        console.log("New ConfigFacet:", address(newConfigFacet));

        // 2. Replace 已有选择器 (3 个 facet)
        IDiamondCut.FacetCut[] memory replaceCuts = new IDiamondCut.FacetCut[](3);

        // Replace InvestmentFacet (7 个已有选择器)
        replaceCuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(newInvestFacet),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getInvestmentReplaceSelectors()
        });

        // Replace WithdrawFacet (2 个已有选择器)
        replaceCuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(newWithdrawFacet),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getWithdrawReplaceSelectors()
        });

        // Replace ConfigFacet (所有已有选择器)
        replaceCuts[2] = IDiamondCut.FacetCut({
            facetAddress: address(newConfigFacet),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getConfigReplaceSelectors()
        });

        IDiamondCut(DIAMOND).diamondCut(replaceCuts, address(0), "");
        console.log("[OK] diamondCut Replace done");

        // 3. Add 新选择器: setUseAave + useAave
        IDiamondCut.FacetCut[] memory addCuts = new IDiamondCut.FacetCut[](1);
        addCuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(newConfigFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: _getConfigAddSelectors()
        });

        IDiamondCut(DIAMOND).diamondCut(addCuts, address(0), "");
        console.log("[OK] diamondCut Add setUseAave + useAave done");

        // 4. 验证
        require(ConfigFacet(DIAMOND).useAave() == false, "useAave should default to false");
        console.log("[OK] useAave default = false (verified)");

        vm.stopBroadcast();
    }

    /// @dev InvestmentFacet 已有 7 个选择器 (Replace)
    function _getInvestmentReplaceSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](7);
        s[0] = InvestmentFacet.register.selector;
        s[1] = InvestmentFacet.invest.selector;
        s[2] = InvestmentFacet.investFromBalance.selector;
        s[3] = InvestmentFacet.settle.selector;
        s[4] = InvestmentFacet.claimDailyReturn.selector;
        s[5] = InvestmentFacet.batchClaimDailyReturn.selector;
        s[6] = InvestmentFacet.settleAndBatchClaim.selector;
    }

    /// @dev WithdrawFacet 已有 2 个选择器 (Replace)
    function _getWithdrawReplaceSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = WithdrawFacet.withdraw.selector;
        s[1] = WithdrawFacet.rescueTokens.selector;
    }

    /// @dev ConfigFacet 已有选择器 (Replace) — 包含上次 Aave 升级添加的 setAaveVault + aaveVault
    function _getConfigReplaceSelectors() internal pure returns (bytes4[] memory s) {
        bytes4[] memory buf = new bytes4[](80);
        uint256 i;
        // ── Admin 管理 ──
        buf[i++] = ConfigFacet.addAdmin.selector;
        buf[i++] = ConfigFacet.removeAdmin.selector;
        buf[i++] = ConfigFacet.hasRole.selector;
        // ── 会员控制 ──
        buf[i++] = ConfigFacet.freezeMember.selector;
        buf[i++] = ConfigFacet.unfreezeMember.selector;
        buf[i++] = ConfigFacet.pauseMember.selector;
        buf[i++] = ConfigFacet.unpauseMember.selector;
        buf[i++] = ConfigFacet.setCommunityLevel.selector;
        buf[i++] = ConfigFacet.setMemberVLevel.selector;
        buf[i++] = ConfigFacet.setMemberVLevelBatch.selector;
        buf[i++] = ConfigFacet.recalculateVLevels.selector;
        buf[i++] = ConfigFacet.setCommunityLevelBatch.selector;
        // ── 暂停 ──
        buf[i++] = ConfigFacet.pause.selector;
        buf[i++] = ConfigFacet.unpause.selector;
        // ── 参数 setter ──
        buf[i++] = ConfigFacet.setDailyReturnRate.selector;
        buf[i++] = ConfigFacet.setStaticDynamicSplit.selector;
        buf[i++] = ConfigFacet.setStaticDistribution.selector;
        buf[i++] = ConfigFacet.setReferralRates.selector;
        buf[i++] = ConfigFacet.setDynamicPoolSplit.selector;
        buf[i++] = ConfigFacet.setCapMultiplier.selector;
        buf[i++] = ConfigFacet.setWithdrawalFee.selector;
        buf[i++] = ConfigFacet.setMinInvestment.selector;
        buf[i++] = ConfigFacet.setMinWithdrawal.selector;
        buf[i++] = ConfigFacet.setSameLevelBonus.selector;
        buf[i++] = ConfigFacet.setVLevelThresholds.selector;
        buf[i++] = ConfigFacet.setVLevelRates.selector;
        buf[i++] = ConfigFacet.setVLevel7Threshold.selector;
        buf[i++] = ConfigFacet.setVLevel7Rate.selector;
        buf[i++] = ConfigFacet.setCommunityRates.selector;
        buf[i++] = ConfigFacet.setRestartMMCompPercent.selector;
        buf[i++] = ConfigFacet.setRestartReferralRate.selector;
        buf[i++] = ConfigFacet.setRestartReferralCap.selector;
        buf[i++] = ConfigFacet.setRestartMMReleaseRate.selector;
        buf[i++] = ConfigFacet.setPerpetualBCKPercent.selector;
        buf[i++] = ConfigFacet.setBCKPrice.selector;
        buf[i++] = ConfigFacet.setSettlementInterval.selector;
        buf[i++] = ConfigFacet.setReceiverWallet.selector;
        buf[i++] = ConfigFacet.setFeeCollector.selector;
        buf[i++] = ConfigFacet.setAaveVault.selector;
        // ── Getters ──
        buf[i++] = ConfigFacet.dailyReturnRate.selector;
        buf[i++] = ConfigFacet.staticPercent.selector;
        buf[i++] = ConfigFacet.dynamicPercent.selector;
        buf[i++] = ConfigFacet.staticToBalance.selector;
        buf[i++] = ConfigFacet.staticToBurn.selector;
        buf[i++] = ConfigFacet.staticToLock.selector;
        buf[i++] = ConfigFacet.referralGen1.selector;
        buf[i++] = ConfigFacet.referralGen2.selector;
        buf[i++] = ConfigFacet.referralGen3.selector;
        buf[i++] = ConfigFacet.referralSharePercent.selector;
        buf[i++] = ConfigFacet.teamSharePercent.selector;
        buf[i++] = ConfigFacet.capMultiplier.selector;
        buf[i++] = ConfigFacet.withdrawalFee.selector;
        buf[i++] = ConfigFacet.minInvestment.selector;
        buf[i++] = ConfigFacet.minWithdrawal.selector;
        buf[i++] = ConfigFacet.sameLevelBonus.selector;
        buf[i++] = ConfigFacet.sameLevelSharePercent.selector;
        buf[i++] = ConfigFacet.vLevelThresholds.selector;
        buf[i++] = ConfigFacet.vLevelRates.selector;
        buf[i++] = ConfigFacet.vLevelThreshold7.selector;
        buf[i++] = ConfigFacet.vLevelRate7.selector;
        buf[i++] = ConfigFacet.communityRates.selector;
        buf[i++] = ConfigFacet.restartMMCompPercent.selector;
        buf[i++] = ConfigFacet.restartReferralRate.selector;
        buf[i++] = ConfigFacet.restartReferralCap.selector;
        buf[i++] = ConfigFacet.restartMMReleaseRate.selector;
        buf[i++] = ConfigFacet.perpetualBCKPercent.selector;
        buf[i++] = ConfigFacet.bckPrice.selector;
        buf[i++] = ConfigFacet.receiverWallet.selector;
        buf[i++] = ConfigFacet.paused.selector;
        buf[i++] = ConfigFacet.settlementInterval.selector;
        buf[i++] = ConfigFacet.feeCollector.selector;
        buf[i++] = ConfigFacet.currentEpoch.selector;
        buf[i++] = ConfigFacet.lastSettledAt.selector;
        buf[i++] = ConfigFacet.isAdmin.selector;
        buf[i++] = ConfigFacet.aaveVault.selector;
        // Trim to actual length
        s = new bytes4[](i);
        for (uint256 j; j < i; j++) {
            s[j] = buf[j];
        }
    }

    /// @dev ConfigFacet 新增选择器 (Add)
    function _getConfigAddSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = ConfigFacet.setUseAave.selector;
        s[1] = ConfigFacet.useAave.selector;
    }
}
