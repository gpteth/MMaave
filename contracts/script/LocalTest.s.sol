// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/diamond/Diamond.sol";
import "../src/diamond/interfaces/IDiamondCut.sol";
import "../src/diamond/facets/DiamondCutFacet.sol";
import "../src/diamond/facets/DiamondLoupeFacet.sol";
import "../src/diamond/facets/OwnershipFacet.sol";
import "../src/diamond/facets/ConfigFacet.sol";
import "../src/diamond/facets/InvestmentFacet.sol";
import "../src/diamond/facets/RestartFacet.sol";
import "../src/diamond/facets/WithdrawFacet.sol";
import "../src/diamond/facets/ViewFacet.sol";
import "../src/diamond/facets/DataCleanFacet.sol";
import "../src/diamond/initializers/DiamondInit.sol";
import "../test/mocks/MockERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title LocalTest - 本地 Anvil 链完整部署 + 投资 + 奖励验证
contract LocalTest is Script {
    address diamond;
    MockERC20 usdt;
    MockERC20 mmToken;
    MockERC20 bckToken;

    // Anvil 默认账号
    address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address user1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address user2 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address user3 = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    uint256 deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 user1Key = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 user2Key = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    uint256 user3Key = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

    function run() external {
        vm.startBroadcast(deployerKey);

        // ── 1. 部署 Mock Tokens ──
        usdt = new MockERC20("Test USDT", "USDT", 18);
        mmToken = new MockERC20("Test MM", "MM", 18);
        bckToken = new MockERC20("Test BCK", "BCK", 18);

        console.log("USDT:", address(usdt));

        // ── 2. 部署所有 Facet ──
        address diamondCutFacet = address(new DiamondCutFacet());
        address diamondLoupeFacet = address(new DiamondLoupeFacet());
        address ownershipFacet = address(new OwnershipFacet());
        address configFacet = address(new ConfigFacet());
        address investmentFacet = address(new InvestmentFacet());
        address restartFacet = address(new RestartFacet());
        address withdrawFacet = address(new WithdrawFacet());
        address viewFacet = address(new ViewFacet());
        address dataCleanFacet = address(new DataCleanFacet());
        address diamondInit = address(new DiamondInit());

        // ── 3. 部署 Diamond ──
        diamond = address(new Diamond(deployer, diamondCutFacet));
        console.log("Diamond:", diamond);

        // ── 4. diamondCut 注册所有 Facet + 初始化 ──
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](8);
        cuts[0] = _buildCut(diamondLoupeFacet, _getLoupeSelectors());
        cuts[1] = _buildCut(ownershipFacet, _getOwnerSelectors());
        cuts[2] = _buildCut(configFacet, _getConfigSelectors());
        cuts[3] = _buildCut(investmentFacet, _getInvestmentSelectors());
        cuts[4] = _buildCut(restartFacet, _getRestartSelectors());
        cuts[5] = _buildCut(withdrawFacet, _getWithdrawSelectors());
        cuts[6] = _buildCut(viewFacet, _getViewSelectors());
        cuts[7] = _buildCut(dataCleanFacet, _getDataCleanSelectors());

        DiamondInit.InitArgs memory initArgs = DiamondInit.InitArgs({
            owner: deployer,
            admin: deployer,
            feeCollector: deployer,
            receiverWallet: deployer,
            usdt: address(usdt),
            pancakeSwapper: address(0),
            mmToken: address(mmToken),
            bckToken: address(bckToken)
        });

        IDiamondCut(diamond).diamondCut(
            cuts,
            diamondInit,
            abi.encodeWithSelector(DiamondInit.init.selector, initArgs)
        );

        // ── 5. 铸造 USDT 给所有用户 ──
        usdt.mint(deployer, 10_000_000e18);
        usdt.mint(user1, 1_000_000e18);
        usdt.mint(user2, 1_000_000e18);
        usdt.mint(user3, 1_000_000e18);

        // deployer 授权 Diamond（作为 receiverWallet 需要授权）
        usdt.approve(diamond, type(uint256).max);

        vm.stopBroadcast();

        // ── 6. 验证配置 ──
        _verifyConfig();

        // ── 7. 模拟投资流程 ──
        _testInvestFlow();

        // ── 8. 模拟结算和奖励分配 ──
        _testSettleAndRewards();

        console.log("");
        console.log("========================================");
        console.log("  ALL TESTS PASSED!");
        console.log("========================================");
    }

    function _verifyConfig() internal view {
        console.log("");
        console.log("=== Verifying Config ===");

        // 推荐奖
        require(ConfigFacet(diamond).referralGen1() == 5000, "referralGen1 != 5000");
        require(ConfigFacet(diamond).referralGen2() == 5000, "referralGen2 != 5000");
        require(ConfigFacet(diamond).referralGen3() == 0, "referralGen3 != 0");
        require(ConfigFacet(diamond).referralSharePercent() == 2000, "referralSharePercent != 2000");
        require(ConfigFacet(diamond).teamSharePercent() == 8000, "teamSharePercent != 8000");
        console.log("[OK] Referral config correct");

        // V等级门槛
        require(ConfigFacet(diamond).vLevelThresholds(0) == 3_000e18, "V1 threshold wrong");
        require(ConfigFacet(diamond).vLevelThresholds(1) == 10_000e18, "V2 threshold wrong");
        require(ConfigFacet(diamond).vLevelThresholds(2) == 50_000e18, "V3 threshold wrong");
        require(ConfigFacet(diamond).vLevelThresholds(3) == 150_000e18, "V4 threshold wrong");
        require(ConfigFacet(diamond).vLevelThresholds(4) == 500_000e18, "V5 threshold wrong");
        require(ConfigFacet(diamond).vLevelThresholds(5) == 1_000_000e18, "V6 threshold wrong");
        require(ConfigFacet(diamond).vLevelThreshold7() == 2_000_000e18, "V7 threshold wrong");
        console.log("[OK] V-Level thresholds correct");

        // V等级费率
        require(ConfigFacet(diamond).vLevelRates(0) == 1000, "V1 rate wrong");
        require(ConfigFacet(diamond).vLevelRates(1) == 2000, "V2 rate wrong");
        require(ConfigFacet(diamond).vLevelRates(2) == 3000, "V3 rate wrong");
        require(ConfigFacet(diamond).vLevelRates(3) == 4000, "V4 rate wrong");
        require(ConfigFacet(diamond).vLevelRates(4) == 5000, "V5 rate wrong");
        require(ConfigFacet(diamond).vLevelRates(5) == 6000, "V6 rate wrong");
        require(ConfigFacet(diamond).vLevelRate7() == 7000, "V7 rate wrong");
        console.log("[OK] V-Level rates correct");

        // 同级奖
        require(ConfigFacet(diamond).sameLevelBonus() == 1000, "sameLevelBonus wrong");
        console.log("[OK] Same-level bonus correct");
    }

    function _testInvestFlow() internal {
        console.log("");
        console.log("=== Testing Investment Flow ===");

        // deployer 先投资（作为根节点，需要有投资额才能接收推荐奖）
        vm.startBroadcast(deployerKey);
        InvestmentFacet(diamond).invest(1_000e18, address(0));
        usdt.transfer(diamond, 100_000e18); // 预存资金到 Diamond 做 receiverWallet
        vm.stopBroadcast();
        console.log("[OK] Deployer invested 1,000 USDT (root node)");

        // user1 注册 + 投资（推荐人 = deployer）
        vm.startBroadcast(user1Key);
        usdt.approve(diamond, type(uint256).max);
        InvestmentFacet(diamond).invest(10_000e18, deployer);
        vm.stopBroadcast();
        console.log("[OK] User1 invested 10,000 USDT (referrer: deployer)");

        // user2 注册 + 投资（推荐人 = user1）
        vm.startBroadcast(user2Key);
        usdt.approve(diamond, type(uint256).max);
        InvestmentFacet(diamond).invest(5_000e18, user1);
        vm.stopBroadcast();
        console.log("[OK] User2 invested 5,000 USDT (referrer: user1)");

        // user3 注册 + 投资（推荐人 = user2）
        vm.startBroadcast(user3Key);
        usdt.approve(diamond, type(uint256).max);
        InvestmentFacet(diamond).invest(2_000e18, user2);
        vm.stopBroadcast();
        console.log("[OK] User3 invested 2,000 USDT (referrer: user2)");

        // 验证团队业绩
        uint256 deployerTeam = ViewFacet(diamond).getTeamPerformance(deployer);
        uint256 user1Team = ViewFacet(diamond).getTeamPerformance(user1);
        console.log("Deployer team performance:", deployerTeam / 1e18);
        console.log("User1 team performance:", user1Team / 1e18);
    }

    function _testSettleAndRewards() internal {
        console.log("");
        console.log("=== Testing Settlement & Rewards ===");

        // 快进 1 天
        vm.warp(block.timestamp + 1 days);

        // 结算
        vm.startBroadcast(deployerKey);
        InvestmentFacet(diamond).settle();
        vm.stopBroadcast();
        console.log("[OK] Settlement completed (epoch advanced)");

        // 为 user3 领取日收益（触发推荐奖+团队奖分配）
        vm.startBroadcast(user3Key);
        InvestmentFacet(diamond).claimDailyReturn(user3);
        vm.stopBroadcast();
        console.log("[OK] User3 claimed daily return");

        // 检查上线是否收到推荐奖 (balance 在第10个位置, index 9)
        (,,,,,,,,, uint256 user2Balance,,) = ViewFacet(diamond).getMemberInfo(user2);
        (,,,,,,,,, uint256 user1Balance,,) = ViewFacet(diamond).getMemberInfo(user1);
        (,,,,,,,,, uint256 deployerBalance,,) = ViewFacet(diamond).getMemberInfo(deployer);

        // getMemberInfo 返回 12 个值，balance 在第 10 个位置 (index 9)
        // referrer, vLevel, communityLevel, isActive, isFrozen, isPaused, isRestarted,
        // totalInvested, totalWithdrawn, balance, totalEarned, directReferralCount
        console.log("User2 balance (1st gen referral):", user2Balance);
        console.log("User1 balance (2nd gen referral):", user1Balance);
        console.log("Deployer balance:", deployerBalance);

        // user3 日收益 = 2000 * 0.8% = 16 USDT
        // 动态 = 16 * 30% = 4.8 USDT
        // 推荐池 = 4.8 * 20% = 0.96 USDT
        // user2 (1代) = 0.96 * 50% = 0.48 USDT
        // user1 (2代): user1 只有 1 个直推，2代推荐奖需 ≥2 直推，不适用

        require(user2Balance > 0, "User2 should have referral reward");
        console.log("[OK] Referral rewards distributed correctly");

        // 为 user1 领取日收益
        vm.startBroadcast(user1Key);
        InvestmentFacet(diamond).claimDailyReturn(user1);
        vm.stopBroadcast();
        console.log("[OK] User1 claimed daily return");

        // deployer 应该收到 user1 的推荐奖
        (,,,,,,,,, uint256 deployerBalance2,,) = ViewFacet(diamond).getMemberInfo(deployer);
        console.log("Deployer balance after user1 claim:", deployerBalance2);
        require(deployerBalance2 > deployerBalance, "Deployer should get referral from user1");
        console.log("[OK] Deployer received referral reward from user1");
    }

    // ======================== Helpers ========================

    function _buildCut(address facet, bytes4[] memory selectors) internal pure returns (IDiamondCut.FacetCut memory) {
        return IDiamondCut.FacetCut({
            facetAddress: facet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });
    }

    function _getLoupeSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](5);
        s[0] = DiamondLoupeFacet.facets.selector;
        s[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        s[2] = DiamondLoupeFacet.facetAddresses.selector;
        s[3] = DiamondLoupeFacet.facetAddress.selector;
        s[4] = DiamondLoupeFacet.supportsInterface.selector;
    }

    function _getOwnerSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = OwnershipFacet.transferOwnership.selector;
        s[1] = OwnershipFacet.owner.selector;
    }

    function _getConfigSelectors() internal pure returns (bytes4[] memory) {
        bytes4[] memory s = new bytes4[](75);
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
        s[i++] = ConfigFacet.setVLevel7Threshold.selector;
        s[i++] = ConfigFacet.setVLevel7Rate.selector;
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
        s[i++] = ConfigFacet.vLevelThreshold7.selector;
        s[i++] = ConfigFacet.vLevelRate7.selector;
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

    function _getInvestmentSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](6);
        s[0] = InvestmentFacet.register.selector;
        s[1] = InvestmentFacet.invest.selector;
        s[2] = InvestmentFacet.settle.selector;
        s[3] = InvestmentFacet.claimDailyReturn.selector;
        s[4] = InvestmentFacet.batchClaimDailyReturn.selector;
        s[5] = InvestmentFacet.settleAndBatchClaim.selector;
    }

    function _getRestartSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](4);
        s[0] = RestartFacet.restart.selector;
        s[1] = RestartFacet.globalRestart.selector;
        s[2] = RestartFacet.claimBCKRelease.selector;
        s[3] = RestartFacet.claimMMCompensation.selector;
    }

    function _getWithdrawSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = WithdrawFacet.withdraw.selector;
        s[1] = WithdrawFacet.rescueTokens.selector;
    }

    function _getViewSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](15);
        s[0] = ViewFacet.getMemberInfo.selector;
        s[1] = ViewFacet.getOrders.selector;
        s[2] = ViewFacet.getOrderCount.selector;
        s[3] = ViewFacet.getDirectReferrals.selector;
        s[4] = ViewFacet.getTeamPerformance.selector;
        s[5] = ViewFacet.getBranchPerformance.selector;
        s[6] = ViewFacet.getRestartInfo.selector;
        s[7] = ViewFacet.getTokenLock.selector;
        s[8] = ViewFacet.getBCKLock.selector;
        s[9] = ViewFacet.getCommunityEarned.selector;
        s[10] = ViewFacet.getSmallZonePerformance.selector;
        s[11] = ViewFacet.getAllMembersCount.selector;
        s[12] = ViewFacet.getMemberAtIndex.selector;
        s[13] = ViewFacet.isMemberRegistered.selector;
        s[14] = ViewFacet.getTeamInfo.selector;
    }

    function _getDataCleanSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = DataCleanFacet.purgeNonAdminData.selector;
    }
}
