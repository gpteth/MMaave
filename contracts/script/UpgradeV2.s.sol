// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/diamond/interfaces/IDiamondCut.sol";
import "../src/diamond/facets/ConfigFacet.sol";
import "../src/diamond/facets/InvestmentFacet.sol";
import "../src/diamond/initializers/DiamondInitV2.sol";

/// @title UpgradeV2 - V7 等级扩展升级
/// @notice 升级内容:
///   1. 推荐奖: 2代制 (Gen1=50%, Gen2=50%, Gen3=0), 推荐池=20%, 团队池=80%
///   2. V等级: V1-V6 门槛/费率调整 + 新增 V7 (门槛 200万, 费率 70%)
///   3. ConfigFacet 新增 V7 setter/getter
///   4. InvestmentFacet 更新 LibMemePlus 逻辑支持 V7
contract UpgradeV2 is Script {
    address constant DIAMOND = 0xB3197881Cd985bDd7D442F03d534FC37169e0C96;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. 部署新合约
        ConfigFacet newConfig = new ConfigFacet();
        InvestmentFacet newInvestment = new InvestmentFacet();
        DiamondInitV2 initV2 = new DiamondInitV2();
        console.log("New ConfigFacet:", address(newConfig));
        console.log("New InvestmentFacet:", address(newInvestment));
        console.log("DiamondInitV2:", address(initV2));

        // 2. 准备 diamondCut 操作
        //    Replace 已有选择器 + Add 新选择器 + Init 设置参数
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](3);

        // 2a. Replace: ConfigFacet 已有 71 个选择器 → 新地址
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(newConfig),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getConfigReplaceSelectors()
        });

        // 2b. Add: ConfigFacet 4 个新函数 (V7 setter/getter)
        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(newConfig),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: _getConfigAddSelectors()
        });

        // 2c. Replace: InvestmentFacet → 新地址 (LibMemePlus V7 逻辑更新)
        cuts[2] = IDiamondCut.FacetCut({
            facetAddress: address(newInvestment),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getInvestmentReplaceSelectors()
        });

        // 2d. Replace: ViewFacet 不需要（只用 getSmallZonePerformance，未修改）

        // 注: RestartFacet/WithdrawFacet 不引用修改过的 LibMemePlus 函数，无需升级

        // 3. 执行 diamondCut + DiamondInitV2 初始化（设置新参数值）
        IDiamondCut(DIAMOND).diamondCut(
            cuts,
            address(initV2),
            abi.encodeWithSelector(DiamondInitV2.init.selector)
        );
        console.log("[OK] diamondCut executed with DiamondInitV2");

        // 4. 验证新参数
        require(ConfigFacet(DIAMOND).referralGen1() == 5000, "referralGen1");
        require(ConfigFacet(DIAMOND).referralGen2() == 5000, "referralGen2");
        require(ConfigFacet(DIAMOND).referralGen3() == 0, "referralGen3");
        require(ConfigFacet(DIAMOND).referralSharePercent() == 2000, "referralSharePercent");
        require(ConfigFacet(DIAMOND).teamSharePercent() == 7000, "teamSharePercent");
        require(ConfigFacet(DIAMOND).vLevelThreshold7() == 2_000_000e18, "vLevelThreshold7");
        require(ConfigFacet(DIAMOND).vLevelRate7() == 7000, "vLevelRate7");
        console.log("[OK] All parameters verified");

        vm.stopBroadcast();
    }

    /// @dev ConfigFacet 已有 71 个选择器（70 初始 + 1 recalculateVLevels）
    function _getConfigReplaceSelectors() internal pure returns (bytes4[] memory) {
        bytes4[] memory s = new bytes4[](71);
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
        s[i++] = ConfigFacet.recalculateVLevels.selector;
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

    /// @dev ConfigFacet 新增 4 个选择器 (V7)
    function _getConfigAddSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](4);
        s[0] = ConfigFacet.setVLevel7Threshold.selector;
        s[1] = ConfigFacet.setVLevel7Rate.selector;
        s[2] = ConfigFacet.vLevelThreshold7.selector;
        s[3] = ConfigFacet.vLevelRate7.selector;
    }

    /// @dev InvestmentFacet 已有 6 个选择器
    function _getInvestmentReplaceSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](6);
        s[0] = InvestmentFacet.register.selector;
        s[1] = InvestmentFacet.invest.selector;
        s[2] = InvestmentFacet.settle.selector;
        s[3] = InvestmentFacet.claimDailyReturn.selector;
        s[4] = InvestmentFacet.batchClaimDailyReturn.selector;
        s[5] = InvestmentFacet.settleAndBatchClaim.selector;
    }
}
