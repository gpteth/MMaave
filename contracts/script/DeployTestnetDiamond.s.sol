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

/// @title DeployTestnetDiamond - BSC 测试网全套部署
/// @notice 部署 Mock Token + Diamond + 所有 Facet
contract DeployTestnetDiamond is Script {
    address internal _diamondCutFacet;
    address internal _diamondLoupeFacet;
    address internal _ownershipFacet;
    address internal _configFacet;
    address internal _investmentFacet;
    address internal _restartFacet;
    address internal _withdrawFacet;
    address internal _viewFacet;
    address internal _dataCleanFacet;
    address internal _diamondInit;
    address internal _diamond;

    address internal _usdt;
    address internal _mmToken;
    address internal _bckToken;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address feeCollector = vm.envOr("FEE_COLLECTOR_ADDRESS", deployer);
        address receiverWallet = vm.envOr("RECEIVER_WALLET_ADDRESS", deployer);

        vm.startBroadcast(deployerKey);

        // ── 1. Token 地址 ──
        _usdt = 0xa76480DeA857aA9FDb1b93C95CCD4258e38BF062;  // 测试网 USDT

        // 部署 MM / BCK mock token
        MockERC20 mmToken = new MockERC20("Test MM", "MM", 18);
        MockERC20 bckToken = new MockERC20("Test BCK", "BCK", 18);
        _mmToken = address(mmToken);
        _bckToken = address(bckToken);

        mmToken.mint(deployer, 1_000_000e18);
        bckToken.mint(deployer, 1_000_000e18);

        console.log("=== Tokens ===");
        console.log("USDT:", _usdt);
        console.log("MM Token:", _mmToken);
        console.log("BCK Token:", _bckToken);

        // ── 2. 部署所有 Facet ──
        _deployFacets();

        // ── 3. 部署 Diamond ──
        _diamond = address(new Diamond(deployer, _diamondCutFacet));
        console.log("Diamond:", _diamond);

        // ── 4. diamondCut 注册所有 Facet + 初始化 ──
        _performDiamondCut(deployer, admin, feeCollector, receiverWallet);

        // ── 5. USDT 授权需要用户自行在前端操作 ──

        vm.stopBroadcast();

        _logAll(deployer, admin);
    }

    function _deployFacets() internal {
        _diamondCutFacet = address(new DiamondCutFacet());
        _diamondLoupeFacet = address(new DiamondLoupeFacet());
        _ownershipFacet = address(new OwnershipFacet());
        _configFacet = address(new ConfigFacet());
        _investmentFacet = address(new InvestmentFacet());
        _restartFacet = address(new RestartFacet());
        _withdrawFacet = address(new WithdrawFacet());
        _viewFacet = address(new ViewFacet());
        _dataCleanFacet = address(new DataCleanFacet());
        _diamondInit = address(new DiamondInit());
    }

    function _performDiamondCut(
        address deployer,
        address admin,
        address feeCollector,
        address receiverWallet
    ) internal {
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](8);
        cuts[0] = _buildCut(_diamondLoupeFacet, _getLoupeSelectors());
        cuts[1] = _buildCut(_ownershipFacet, _getOwnerSelectors());
        cuts[2] = _buildCut(_configFacet, _getConfigSelectors());
        cuts[3] = _buildCut(_investmentFacet, _getInvestmentSelectors());
        cuts[4] = _buildCut(_restartFacet, _getRestartSelectors());
        cuts[5] = _buildCut(_withdrawFacet, _getWithdrawSelectors());
        cuts[6] = _buildCut(_viewFacet, _getViewSelectors());
        cuts[7] = _buildCut(_dataCleanFacet, _getDataCleanSelectors());

        DiamondInit.InitArgs memory initArgs = DiamondInit.InitArgs({
            owner: deployer,
            admin: admin,
            feeCollector: feeCollector,
            receiverWallet: receiverWallet,
            usdt: _usdt,
            pancakeSwapper: address(0),   // 测试网不需要 PancakeSwapper
            mmToken: _mmToken,
            bckToken: _bckToken
        });

        IDiamondCut(_diamond).diamondCut(
            cuts,
            _diamondInit,
            abi.encodeWithSelector(DiamondInit.init.selector, initArgs)
        );
    }

    function _buildCut(address facet, bytes4[] memory selectors) internal pure returns (IDiamondCut.FacetCut memory) {
        return IDiamondCut.FacetCut({
            facetAddress: facet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });
    }

    function _logAll(address deployer, address admin) internal view {
        console.log("");
        console.log("========================================");
        console.log("  BSC Testnet Diamond Deployed!");
        console.log("========================================");
        console.log("Diamond (MEMEPLUS):", _diamond);
        console.log("USDT:", _usdt);
        console.log("MM Token:", _mmToken);
        console.log("BCK Token:", _bckToken);
        console.log("Owner:", deployer);
        console.log("Admin:", admin);
        console.log("----------------------------------------");
        console.log("DiamondCutFacet:", _diamondCutFacet);
        console.log("DiamondLoupeFacet:", _diamondLoupeFacet);
        console.log("OwnershipFacet:", _ownershipFacet);
        console.log("ConfigFacet:", _configFacet);
        console.log("InvestmentFacet:", _investmentFacet);
        console.log("RestartFacet:", _restartFacet);
        console.log("WithdrawFacet:", _withdrawFacet);
        console.log("ViewFacet:", _viewFacet);
        console.log("DataCleanFacet:", _dataCleanFacet);
        console.log("DiamondInit:", _diamondInit);
        console.log("========================================");
    }

    // ======================== Selector Helpers ========================

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
