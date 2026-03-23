// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/MemePlus.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "../src/external/PancakeSwapper.sol";
import "./mocks/MockERC20.sol";
import "./mocks/MockPancakeRouter.sol";

/**
 * @title MemePlusTest
 * @notice Full integration tests for MemePlus covering invest, daily return,
 *         bonus distribution, withdrawal, restart, and admin functions.
 *         All contracts deployed behind UUPS proxies.
 */
contract MemePlusTest is Test {
    MemePlus public mp;
    PancakeSwapper public swapper;
    MockERC20 public usdt;
    MockERC20 public mmToken;
    MockPancakeRouter public pancakeRouter;

    // Keep impl references for upgrade tests
    MemePlus public mpImpl;
    PancakeSwapper public swapperImpl;

    address public owner = address(this);
    address public feeCollector = makeAddr("feeCollector");
    address public receiverWallet = makeAddr("receiverWallet");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public dave = makeAddr("dave");
    address public eve = makeAddr("eve");
    address public frank = makeAddr("frank");

    uint256 constant INVEST_100 = 100e18;
    uint256 constant INVEST_1000 = 1000e18;
    uint256 constant INVEST_10000 = 10_000e18;

    function setUp() public {
        // Deploy tokens
        usdt = new MockERC20("USDT", "USDT", 18);
        mmToken = new MockERC20("MM Token", "MM", 18);

        // Deploy mocks
        pancakeRouter = new MockPancakeRouter(address(mmToken));

        // Deploy PancakeSwapper via proxy
        swapperImpl = new PancakeSwapper(address(pancakeRouter), address(usdt), address(mmToken));
        ERC1967Proxy swapperProxy = new ERC1967Proxy(
            address(swapperImpl),
            abi.encodeCall(PancakeSwapper.initialize, (owner))
        );
        swapper = PancakeSwapper(address(swapperProxy));

        // Deploy MemePlus via proxy
        mpImpl = new MemePlus(
            address(usdt),
            address(swapperProxy),
            address(mmToken),
            address(mmToken) // bckToken placeholder
        );
        ERC1967Proxy mpProxy = new ERC1967Proxy(
            address(mpImpl),
            abi.encodeCall(MemePlus.initialize, (owner, feeCollector, receiverWallet))
        );
        mp = MemePlus(address(mpProxy));

        // Set authorizations
        swapper.setAuthorized(address(mp), true);

        // Initialize V5 epoch-based settlement
        mp.initializeV5();

        // Initialize V6 DSR (Discrete Staking Rewards)
        mp.initializeV6();

        // Fund receiver wallet with USDT for withdrawals and approve MemePlus
        usdt.mint(receiverWallet, 1_000_000e18);
        vm.prank(receiverWallet);
        usdt.approve(address(mp), type(uint256).max);

        // Fund test users
        usdt.mint(alice, 100_000e18);
        usdt.mint(bob, 100_000e18);
        usdt.mint(charlie, 100_000e18);
        usdt.mint(dave, 100_000e18);
        usdt.mint(eve, 100_000e18);
        usdt.mint(frank, 100_000e18);

        // Approve MemePlus for users
        vm.prank(alice);
        usdt.approve(address(mp), type(uint256).max);
        vm.prank(bob);
        usdt.approve(address(mp), type(uint256).max);
        vm.prank(charlie);
        usdt.approve(address(mp), type(uint256).max);
        vm.prank(dave);
        usdt.approve(address(mp), type(uint256).max);
        vm.prank(eve);
        usdt.approve(address(mp), type(uint256).max);
        vm.prank(frank);
        usdt.approve(address(mp), type(uint256).max);
    }

    // ======================== Proxy Tests ========================

    function test_Version() public view {
        assertEq(mp.VERSION(), 6);
    }

    function test_CannotReinitialize() public {
        vm.expectRevert(abi.encodeWithSelector(Initializable.InvalidInitialization.selector));
        mp.initialize(alice, alice, alice);
    }

    function test_ImplementationCannotBeInitialized() public {
        vm.expectRevert(abi.encodeWithSelector(Initializable.InvalidInitialization.selector));
        mpImpl.initialize(alice, alice, alice);
    }

    function test_SwapperImplementationCannotBeInitialized() public {
        vm.expectRevert(abi.encodeWithSelector(Initializable.InvalidInitialization.selector));
        swapperImpl.initialize(alice);
    }

    function test_UpgradeOnlyOwner() public {
        MemePlus newImpl = new MemePlus(
            address(usdt),
            address(swapper),
            address(mmToken),
            address(mmToken) // bckToken placeholder
        );
        vm.prank(alice);
        vm.expectRevert();
        mp.upgradeToAndCall(address(newImpl), "");
    }

    function test_UpgradeSucceeds() public {
        // Invest first to create state
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        // Deploy new implementation
        MemePlus newImpl = new MemePlus(
            address(usdt),
            address(swapper),
            address(mmToken),
            address(mmToken) // bckToken placeholder
        );

        // Upgrade
        mp.upgradeToAndCall(address(newImpl), "");

        // Verify state preserved after upgrade
        assertTrue(mp.isMemberRegistered(alice));
        (, , , , , , , uint256 totalInvested, , , , ) = mp.getMemberInfo(alice);
        assertEq(totalInvested, INVEST_1000);
        assertEq(mp.owner(), owner);
        assertEq(mp.feeCollector(), feeCollector);
    }

    function test_SwapperUpgradeSucceeds() public {
        PancakeSwapper newSwapperImpl = new PancakeSwapper(address(pancakeRouter), address(usdt), address(mmToken));
        swapper.upgradeToAndCall(address(newSwapperImpl), "");
        assertEq(swapper.owner(), owner);
    }

    // ======================== Config Tests ========================

    function test_DefaultConfig() public view {
        assertEq(mp.dailyReturnRate(), 80);
        assertEq(mp.staticPercent(), 7000);
        assertEq(mp.dynamicPercent(), 3000);
        assertEq(mp.withdrawalFee(), 500);
        assertEq(mp.capMultiplier(), 250);
        assertEq(mp.minInvestment(), 100e18);
        assertEq(mp.minWithdrawal(), 10e18);
        assertEq(mp.restartReferralRate(), 1000);   // 10%
        assertEq(mp.perpetualBCKPercent(), 2000);    // 20%
    }

    function test_SetConfig() public {
        mp.setDailyReturnRate(200);
        assertEq(mp.dailyReturnRate(), 200);

        mp.setWithdrawalFee(300);
        assertEq(mp.withdrawalFee(), 300);

        mp.setMinInvestment(200e18);
        assertEq(mp.minInvestment(), 200e18);
    }

    function test_SetStaticDynamicSplit() public {
        mp.setStaticDynamicSplit(6000, 4000);
        assertEq(mp.staticPercent(), 6000);
        assertEq(mp.dynamicPercent(), 4000);
    }

    function test_RevertSetSplitNotSumTo10000() public {
        vm.expectRevert(abi.encodeWithSelector(MPStorage.MustSumTo10000.selector));
        mp.setStaticDynamicSplit(5000, 4000);
    }

    function test_RevertWithdrawalFeeTooHigh() public {
        vm.expectRevert(abi.encodeWithSelector(MPStorage.FeeTooHigh.selector));
        mp.setWithdrawalFee(5001);
    }

    function test_AdminManagement() public {
        address admin = makeAddr("admin");
        mp.addAdmin(admin);
        assertTrue(mp.isAdmin(admin));

        mp.removeAdmin(admin);
        assertFalse(mp.isAdmin(admin));
    }

    function test_SetCommunityLevel() public {
        // First register alice
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        mp.setCommunityLevel(alice, 3);
        (, , uint8 communityLevel, , , , , , , , , ) = mp.getMemberInfo(alice);
        assertEq(communityLevel, 3);
    }

    function test_RevertSetCommunityLevelInvalid() public {
        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidLevel.selector));
        mp.setCommunityLevel(alice, 6);
    }

    function test_PauseUnpause() public {
        mp.pause();
        assertTrue(mp.paused());

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.ContractPaused.selector));
        mp.invest(INVEST_100, address(0));

        mp.unpause();
        assertFalse(mp.paused());
    }

    // ======================== Investment Tests ========================

    function test_InvestBasic() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        assertTrue(mp.isMemberRegistered(alice));
        (
            address referrer, uint8 vLevel, , bool isActive, , , ,
            uint256 totalInvested, , , , uint256 directCount
        ) = mp.getMemberInfo(alice);

        assertEq(referrer, address(0));
        assertEq(vLevel, 0);
        assertTrue(isActive);
        assertEq(totalInvested, INVEST_100);
        assertEq(directCount, 0);
        assertEq(mp.getOrders(alice).length, 1);
    }

    function test_InvestWithReferrer() public {
        // Alice invests first (no referrer)
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        // Bob invests with alice as referrer
        vm.prank(bob);
        mp.invest(INVEST_100, alice);

        (address referrer, , , , , , , , , , , ) = mp.getMemberInfo(bob);
        assertEq(referrer, alice);

        // Alice should have 1 direct referral
        address[] memory refs = mp.getDirectReferrals(alice);
        assertEq(refs.length, 1);
        assertEq(refs[0], bob);

        (, , , , , , , , , , , uint256 directCount) = mp.getMemberInfo(alice);
        assertEq(directCount, 1);
    }

    function test_InvestMultipleOrders() public {
        vm.startPrank(alice);
        mp.invest(INVEST_100, address(0));
        mp.invest(200e18, address(0));
        vm.stopPrank();

        assertEq(mp.getOrders(alice).length, 2);
        (, , , , , , , uint256 totalInvested, , , , ) = mp.getMemberInfo(alice);
        assertEq(totalInvested, 300e18);
    }

    function test_RevertInvestBelowMin() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.BelowMinInvestment.selector));
        mp.invest(50e18, address(0));
    }

    function test_RevertInvestNotMultipleOf100() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.NotMultipleOf100.selector));
        mp.invest(150e18, address(0));
    }

    function test_RevertInvestFrozenAccount() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        mp.freezeMember(alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.AccountFrozen.selector));
        mp.invest(INVEST_100, address(0));
    }

    function test_RevertCannotReferSelf() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.CannotReferSelf.selector));
        mp.invest(INVEST_100, alice);
    }

    // ======================== Team Performance Tests ========================

    function test_TeamPerformanceUpdated() public {
        // Alice -> Bob -> Charlie
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_100, alice);
        vm.prank(charlie);
        mp.invest(INVEST_1000, bob);

        // Alice team perf should include bob + charlie (use getTeamInfo)
        (uint256 aliceTeamPerf,,,) = mp.getTeamInfo(alice);
        assertEq(aliceTeamPerf, INVEST_100 + INVEST_1000);

        // Bob team perf should include charlie
        (uint256 bobTeamPerf,,,) = mp.getTeamInfo(bob);
        assertEq(bobTeamPerf, INVEST_1000);
    }

    function test_BranchPerformance() public {
        // Alice -> Bob, Alice -> Charlie
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);
        vm.prank(charlie);
        mp.invest(500e18, alice);

        assertEq(mp.getBranchPerformance(alice, bob), INVEST_1000);
        assertEq(mp.getBranchPerformance(alice, charlie), 500e18);
    }

    function test_SmallZonePerformance() public {
        // Alice -> Bob (1000), Alice -> Charlie (500)
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);
        vm.prank(charlie);
        mp.invest(500e18, alice);

        // Total = 1500, max branch = 1000, small zone = 500
        (, uint256 smallZone,,) = mp.getTeamInfo(alice);
        assertEq(smallZone, 500e18);
    }

    // ======================== Daily Return Tests ========================

    function test_ClaimDailyReturn() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        // Advance 1 day
        vm.warp(block.timestamp + 1 days);
        mp.settle();

        mp.claimDailyReturn(alice);

        // 1000 * 0.8% = 8 USDT daily return
        // 70% static = 5.6 USDT
        // 60% of static to balance = 3.36 USDT
        (, , , , , , , , , uint256 balance, uint256 totalEarned, ) = mp.getMemberInfo(alice);
        assertEq(balance, 3.36e18);
        assertEq(totalEarned, 3.36e18);
    }

    function test_ClaimDailyReturnMultipleDays() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        // Advance 5 days
        vm.warp(block.timestamp + 5 days);
        mp.settle();

        mp.claimDailyReturn(alice);

        // 1000 * 0.8% * 5 = 40 USDT daily return
        // 70% static = 28 USDT
        // 60% of static to balance = 16.8 USDT
        (, , , , , , , , , uint256 balance, , ) = mp.getMemberInfo(alice);
        assertEq(balance, 16.8e18);
    }

    function test_UserCappedAt2_5x() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        // 2.5x cap = 250 USDT total raw return per user
        // Daily return = 0.8 USDT/day
        // After 313 days (250/0.8) the user should be capped
        vm.warp(block.timestamp + 400 days);

        mp.claimDailyReturn(alice);

        // Check DSR state: activeStake should be 0 (fully capped)
        (uint128 activeStake, , uint256 totalRawReturn, ) = mp.getDSRInfo(alice);
        assertEq(activeStake, 0);
        assertEq(totalRawReturn, 250e18); // 2.5x of 100
    }

    function test_BatchClaimDailyReturn() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_100, alice);

        vm.warp(block.timestamp + 1 days);
        mp.settle();

        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        mp.batchClaimDailyReturn(users);

        (, , , , , , , , , uint256 aliceBalance, , ) = mp.getMemberInfo(alice);
        (, , , , , , , , , uint256 bobBalance, , ) = mp.getMemberInfo(bob);
        assertTrue(aliceBalance > 0);
        assertTrue(bobBalance > 0);
    }

    function test_RevertClaimNotActive() public {
        vm.expectRevert(abi.encodeWithSelector(MPStorage.NotActive.selector));
        mp.claimDailyReturn(alice);
    }

    // ======================== Settlement Tests ========================

    function test_SettleAdvancesEpoch() public {
        // With DSR, epoch auto-advances from genesisTimestamp
        vm.warp(block.timestamp + 1 days);
        // settle() syncs legacy state
        mp.settle();
        assertEq(mp.currentEpoch(), 1); // legacy state synced
    }

    function test_SettleAdvancesMultipleEpochs() public {
        vm.warp(block.timestamp + 5 days);
        // epoch auto-calculated from timestamp
        mp.settle();
        assertEq(mp.currentEpoch(), 5); // legacy state synced
    }

    function test_SettleIsAlwaysCallable() public {
        // With DSR, settle() never reverts - it just updates the accumulator
        mp.settle();
        assertEq(mp.currentEpoch(), 0);
    }

    function test_SettleAndClaim() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        vm.warp(block.timestamp + 1 days);
        mp.settle();
        mp.claimDailyReturn(alice);

        // 1000 * 0.8% * 1 day = 8 USDT, 70% static * 60% to balance = 3.36 USDT
        (, , , , , , , , , uint256 balance, , ) = mp.getMemberInfo(alice);
        assertEq(balance, 3.36e18);
    }

    function test_ClaimWithoutSettleGetsZero() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        // No time passed, epoch still 0 → 0 rewards even with DSR auto-settlement
        mp.claimDailyReturn(alice);

        (, , , , , , , , , uint256 balance, , ) = mp.getMemberInfo(alice);
        assertEq(balance, 0);
    }

    // ======================== Referral Reward Tests ========================

    function test_ReferralRewardsGeneration1() public {
        // Alice -> Bob
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);

        vm.warp(block.timestamp + 1 days);
        mp.settle();
        mp.claimDailyReturn(bob);

        (, , , , , , , , , , uint256 aliceEarned, ) = mp.getMemberInfo(alice);
        assertTrue(aliceEarned > 0);
    }

    function test_ReferralRewards3Generations() public {
        // alice -> bob -> charlie -> dave
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        // Alice needs 3 direct referrals to unlock gen 3
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);
        vm.prank(charlie);
        mp.invest(INVEST_1000, alice);
        vm.prank(dave);
        mp.invest(INVEST_1000, alice);

        // Now eve invests under bob
        vm.prank(eve);
        mp.invest(INVEST_1000, bob);

        vm.warp(block.timestamp + 1 days);
        mp.settle();
        uint256 aliceBalanceBefore;
        (, , , , , , , , , aliceBalanceBefore, , ) = mp.getMemberInfo(alice);

        // Claim for eve - alice should get G2 reward (eve is gen2 under alice via bob)
        mp.claimDailyReturn(eve);

        (, , , , , , , , , uint256 aliceBalanceAfter, , ) = mp.getMemberInfo(alice);
        assertTrue(aliceBalanceAfter > aliceBalanceBefore, "Alice should earn referral from eve");
    }

    // ======================== Withdrawal Tests ========================

    function test_WithdrawBasic() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        // Advance 10 days to accumulate balance
        vm.warp(block.timestamp + 10 days);
        mp.settle();
        mp.claimDailyReturn(alice);

        (, , , , , , , , , uint256 balance, , ) = mp.getMemberInfo(alice);
        assertTrue(balance >= 10e18, "Should have at least 10 USDT balance");

        uint256 aliceUsdtBefore = usdt.balanceOf(alice);

        // Withdraw 10 USDT
        vm.prank(alice);
        mp.withdraw(10e18);

        uint256 aliceUsdtAfter = usdt.balanceOf(alice);
        // 5% fee, so net = 9.5 USDT
        assertEq(aliceUsdtAfter - aliceUsdtBefore, 9.5e18);

        // Fee collector should get 0.5 USDT
        assertEq(usdt.balanceOf(feeCollector), 0.5e18);
    }

    function test_RevertWithdrawBelowMin() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        vm.warp(block.timestamp + 10 days);
        mp.settle();
        mp.claimDailyReturn(alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.BelowMinWithdrawal.selector));
        mp.withdraw(5e18);
    }

    function test_RevertWithdrawNotMultipleOf10() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        vm.warp(block.timestamp + 10 days);
        mp.settle();
        mp.claimDailyReturn(alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.NotMultipleOf10.selector));
        mp.withdraw(15e18);
    }

    function test_RevertWithdrawInsufficientBalance() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.InsufficientBalance.selector));
        mp.withdraw(10e18);
    }

    // ======================== Restart Tests ========================

    function test_RestartUser() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        // Advance and claim some returns
        vm.warp(block.timestamp + 5 days);
        mp.settle();
        mp.claimDailyReturn(alice);

        // Withdraw some
        vm.prank(alice);
        mp.withdraw(10e18);

        // Save values before restart (restart clears them to 0)
        (, , , , , , , uint256 preInvested, uint256 preWithdrawn, , , ) = mp.getMemberInfo(alice);

        // Restart alice
        mp.restart(alice);

        (, , , bool isActive, , , bool isRestarted, uint256 totalInvested, uint256 totalWithdrawn, uint256 balance, , ) = mp.getMemberInfo(alice);
        assertFalse(isActive);
        assertTrue(isRestarted);
        assertEq(balance, 0);
        assertEq(totalInvested, 0);
        assertEq(totalWithdrawn, 0);

        // Check restart info
        (uint128 unreturned, uint128 refEarned) = mp.getRestartInfo(alice);
        assertEq(unreturned, uint128(preInvested - preWithdrawn));
        assertEq(refEarned, 0);

        // Check token lock (30% of unreturned)
        (uint128 lockAmount, uint128 originalAmount, ) = mp.getTokenLock(alice);
        assertEq(lockAmount, uint128((uint256(unreturned) * 3000) / 10000));
        assertEq(originalAmount, lockAmount);

        // Orders should be cleared
        assertEq(mp.getOrders(alice).length, 0);
    }

    function test_GlobalRestart() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_100, alice);

        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        mp.globalRestart(users);

        (, , , bool aliceActive, , , bool aliceRestarted, , , , , ) = mp.getMemberInfo(alice);
        (, , , bool bobActive, , , bool bobRestarted, , , , , ) = mp.getMemberInfo(bob);
        assertFalse(aliceActive);
        assertTrue(aliceRestarted);
        assertFalse(bobActive);
        assertTrue(bobRestarted);
    }

    function test_RestartReferralCompensation() public {
        // Alice -> Bob. Restart Alice. Bob invests more. Alice gets 10% compensation.
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        vm.prank(bob);
        mp.invest(INVEST_100, alice);

        // Restart alice
        mp.restart(alice);

        (uint128 unreturned, ) = mp.getRestartInfo(alice);
        assertTrue(unreturned > 0);

        // New user invests with alice as referrer
        vm.prank(charlie);
        mp.invest(INVEST_1000, alice);

        // Alice should have earned 10% of charlie's 1000 = 100
        (, uint128 refEarned) = mp.getRestartInfo(alice);
        assertEq(refEarned, 100e18);

        // Alice's balance should include the compensation
        (, , , , , , , , , uint256 aliceBalance, , ) = mp.getMemberInfo(alice);
        assertEq(aliceBalance, 100e18);
    }

    function test_RestartReferralCompensationCapped() public {
        // Alice invests 100, restart, unreturned ~100
        // Cap = 1.5x * 100 = 150
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        mp.restart(alice);

        (uint128 unreturned, ) = mp.getRestartInfo(alice);
        // cap = 1.5x * unreturned
        uint256 cap = (uint256(unreturned) * 150) / 100;

        // Charlie invests huge amount under alice
        vm.prank(charlie);
        mp.invest(INVEST_10000, alice);

        // 10% of 10000 = 1000, but capped at 150
        (, uint128 refEarned) = mp.getRestartInfo(alice);
        assertEq(refEarned, uint128(cap));
    }

    function test_RestartBCKGift() public {
        // Set BCK price and fund contract with BCK (mmToken used as bckToken in test)
        mp.setBCKPrice(0.5e18); // 0.5 USDT per BCK
        mmToken.mint(address(mp), 100_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        mp.restart(alice);

        // unreturned = 1000, BCK = 1000 * 20% / 0.5 = 400 BCK
        // BCK is stored in _bckLocks mapping, not transferred directly
        (uint128 unreturned, ) = mp.getRestartInfo(alice);
        uint256 expectedBCK = (uint256(unreturned) * 2000 / 10000) * 1e18 / 0.5e18;
        (uint128 bckLockAmount, uint128 bckOriginal, ) = mp.getBCKLock(alice);
        assertEq(uint256(bckLockAmount), expectedBCK);
        assertEq(bckOriginal, bckLockAmount);
    }

    function test_RestartBCKGiftSkippedWhenPriceZero() public {
        // bckPrice is 0 by default, so no BCK should be gifted
        mmToken.mint(address(mp), 100_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        uint256 bckBefore = mmToken.balanceOf(alice);
        mp.restart(alice);
        uint256 bckAfter = mmToken.balanceOf(alice);

        assertEq(bckAfter, bckBefore); // No BCK gifted
    }

    function test_ClaimMMCompensation() public {
        // Fund MemePlus with MM tokens for compensation
        mmToken.mint(address(mp), 10_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        mp.restart(alice);

        (uint128 lockAmount, uint128 originalAmount, ) = mp.getTokenLock(alice);
        assertTrue(lockAmount > 0);
        assertEq(lockAmount, originalAmount);

        // Advance 10 days
        vm.warp(block.timestamp + 10 days);

        uint256 mmBefore = mmToken.balanceOf(alice);

        vm.prank(alice);
        mp.claimMMCompensation(alice);

        uint256 mmAfter = mmToken.balanceOf(alice);
        // 1% per day * 10 days = 10% released (linear from originalAmount)
        uint256 expectedRelease = (uint256(originalAmount) * 100 * 10) / 10000;
        assertEq(mmAfter - mmBefore, expectedRelease);
    }

    function test_RevertClaimMMNotRestarted() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.NotRestarted.selector));
        mp.claimMMCompensation(alice);
    }

    // ======================== V-Level Tests ========================

    function test_VLevelUpgrade() public {
        // Need small zone >= 10,000 for V1
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        // Two branches under alice, each with > 10k
        vm.prank(bob);
        mp.invest(INVEST_10000, alice);
        vm.prank(charlie);
        mp.invest(INVEST_10000, alice);

        // Alice small zone = min(10000, 10000) = 10000 >= V1 threshold
        (, uint8 vLevel, , , , , , , , , , ) = mp.getMemberInfo(alice);
        assertEq(vLevel, 1);
    }

    // ======================== Community Income Tests ========================

    function test_CommunityIncome() public {
        // Alice -> Bob. Alice has community level 3 (rate 15%)
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        mp.setCommunityLevel(alice, 3);

        vm.prank(bob);
        mp.invest(INVEST_1000, alice);

        // Alice should receive community income = 1000 * 15% = 150
        uint256 communityEarned = mp.getCommunityEarned(alice);
        assertEq(communityEarned, 150e18);
    }

    function test_CommunityIncomeLevelDifferential() public {
        // alice(L3) -> bob(L1) -> charlie
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);

        mp.setCommunityLevel(alice, 3); // 15%
        mp.setCommunityLevel(bob, 1);   // 20%

        vm.prank(charlie);
        mp.invest(INVEST_1000, bob);

        uint256 bobCommunity = mp.getCommunityEarned(bob);
        uint256 aliceCommunity = mp.getCommunityEarned(alice);
        assertEq(bobCommunity, 200e18); // 1000 * 20%
        assertEq(aliceCommunity, 0);     // L3 rate < L1 rate, no differential
    }

    function test_CommunityIncomeNotInCap() public {
        // Community income should NOT count toward 2.5x cap
        vm.prank(alice);
        mp.invest(INVEST_100, address(0)); // cap = 250 USDT
        mp.setCommunityLevel(alice, 1); // 20%

        // Bob invests large amount under alice
        vm.prank(bob);
        mp.invest(INVEST_10000, alice); // Alice gets 20% = 2000 community income

        uint256 communityEarned = mp.getCommunityEarned(alice);
        assertEq(communityEarned, 2000e18); // Not capped at 250

        (, , , , , , , , , uint256 balance, , ) = mp.getMemberInfo(alice);
        assertTrue(balance >= 2000e18); // Community income added to balance
    }

    // ======================== Freeze/Pause Tests ========================

    function test_FreezeMember() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        mp.freezeMember(alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.AccountFrozen.selector));
        mp.invest(INVEST_100, address(0));
    }

    function test_PauseMember() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        mp.pauseMember(alice);

        (, , , , , bool isPaused, , , , , , ) = mp.getMemberInfo(alice);
        assertTrue(isPaused);

        mp.unpauseMember(alice);
        (, , , , , isPaused, , , , , , ) = mp.getMemberInfo(alice);
        assertFalse(isPaused);
    }

    // ======================== View Function Tests ========================

    function test_GetTeamInfo() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);

        (uint256 teamPerf, uint256 smallZone, uint256 directCount, uint8 vLevel) = mp.getTeamInfo(alice);
        assertEq(teamPerf, INVEST_1000);
        assertEq(smallZone, 0);
        assertEq(directCount, 1);
        assertEq(vLevel, 0);
    }

    function test_GetAllMembers() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_100, alice);

        assertEq(mp.getAllMembersCount(), 2);
        assertEq(mp.getMemberAtIndex(0), alice);
        assertEq(mp.getMemberAtIndex(1), bob);
    }

    function test_RevertGetMemberAtInvalidIndex() public {
        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidIndex.selector));
        mp.getMemberAtIndex(0);
    }

    // ======================== Emergency Tests ========================

    function test_RescueTokens() public {
        usdt.mint(address(mp), 1000e18);
        mp.rescueTokens(address(usdt), 1000e18);
        assertEq(usdt.balanceOf(owner), 1000e18);
    }

    // ======================== PancakeSwapper Tests ========================

    function test_PancakeSwapperBuyAndBurn() public {
        usdt.mint(address(swapper), 1000e18);
        swapper.buyAndBurn(1000e18, 0);
        assertEq(swapper.totalBurned(), 1000e18);
    }

    function test_RevertPancakeSwapperUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PancakeSwapper.NotAuthorized.selector));
        swapper.buyAndBurn(1000e18, 0);
    }

    // ======================== Security Audit Fix Tests ========================

    function test_ClaimMMCompensationFullRelease() public {
        // Verify 100% claimable after 100 days (1% per day)
        mmToken.mint(address(mp), 10_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        mp.restart(alice);

        (, uint128 originalAmount, ) = mp.getTokenLock(alice);
        assertTrue(originalAmount > 0);

        // Advance 100 days (1% * 100 = 100%)
        vm.warp(block.timestamp + 100 days);

        uint256 mmBefore = mmToken.balanceOf(alice);
        vm.prank(alice);
        mp.claimMMCompensation(alice);
        uint256 mmAfter = mmToken.balanceOf(alice);

        // Should release entire original amount
        assertEq(mmAfter - mmBefore, originalAmount);

        // Lock remaining should be 0
        (uint128 remaining, , ) = mp.getTokenLock(alice);
        assertEq(remaining, 0);
    }

    function test_ClaimMMCompensationLinearMultipleClaims() public {
        // Verify linear release works correctly across multiple claims
        mmToken.mint(address(mp), 10_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        mp.restart(alice);

        (, uint128 originalAmount, ) = mp.getTokenLock(alice);

        // Claim after 10 days
        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        mp.claimMMCompensation(alice);
        uint256 claimed1 = mmToken.balanceOf(alice);
        uint256 expected10days = (uint256(originalAmount) * 100 * 10) / 10000;
        assertEq(claimed1, expected10days);

        // Claim after 20 more days (30 total)
        vm.warp(block.timestamp + 20 days);
        vm.prank(alice);
        mp.claimMMCompensation(alice);
        uint256 claimed2 = mmToken.balanceOf(alice);
        uint256 expected30days = (uint256(originalAmount) * 100 * 30) / 10000;
        assertEq(claimed2, expected30days);
    }

    function test_RevertBatchTooLarge() public {
        address[] memory users = new address[](101);
        for (uint256 i; i < 101; i++) {
            users[i] = address(uint160(i + 100));
        }
        vm.expectRevert(abi.encodeWithSelector(MPStorage.BatchTooLarge.selector));
        mp.batchClaimDailyReturn(users);
    }

    function test_RevertReferrerNotRegistered() public {
        // Try to invest with unregistered referrer
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.ReferrerNotRegistered.selector));
        mp.invest(INVEST_100, bob);
    }

    function test_RevertVLevelRatesNotAscending() public {
        uint16[6] memory badRates = [uint16(2200), 2000, 1800, 1500, 1000, 500];
        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidLevel.selector));
        mp.setVLevelRates(badRates);
    }

    function test_RevertCommunityRatesNotDescending() public {
        uint16[5] memory badRates = [uint16(500), 1000, 1500, 1800, 2000];
        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidLevel.selector));
        mp.setCommunityRates(badRates);
    }

    function test_Ownable2Step() public {
        address newOwner = makeAddr("newOwner");

        // Start transfer
        mp.transferOwnership(newOwner);
        // Owner should still be this contract until accepted
        assertEq(mp.owner(), address(this));

        // Accept transfer
        vm.prank(newOwner);
        mp.acceptOwnership();
        assertEq(mp.owner(), newOwner);
    }

    // ======================== AccessControl Tests ========================

    function test_OwnerHasDefaultAdminRole() public view {
        assertTrue(mp.hasRole(mp.DEFAULT_ADMIN_ROLE(), owner));
    }

    function test_OwnerHasAdminRole() public view {
        assertTrue(mp.hasRole(mp.ADMIN_ROLE(), owner));
    }

    function test_GrantAdminRoleViaAddAdmin() public {
        address admin = makeAddr("admin");
        mp.addAdmin(admin);
        assertTrue(mp.hasRole(mp.ADMIN_ROLE(), admin));
        assertTrue(mp.isAdmin(admin)); // backward compat
    }

    function test_RevokeAdminRoleViaRemoveAdmin() public {
        address admin = makeAddr("admin");
        mp.addAdmin(admin);
        mp.removeAdmin(admin);
        assertFalse(mp.hasRole(mp.ADMIN_ROLE(), admin));
        assertFalse(mp.isAdmin(admin));
    }

    function test_AdminCanCallOnlyAdminFunctions() public {
        address admin = makeAddr("admin");
        mp.addAdmin(admin);

        vm.prank(admin);
        mp.setDailyReturnRate(100);
        assertEq(mp.dailyReturnRate(), 100);
    }

    function test_RevertNonAdminCannotCallAdminFunctions() public {
        vm.prank(alice);
        vm.expectRevert();
        mp.setDailyReturnRate(100);
    }

    function test_RevertNonAdminCannotAddAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        mp.addAdmin(alice);
    }

    function test_GrantRoleDirectly() public {
        mp.grantRole(mp.ADMIN_ROLE(), alice);
        assertTrue(mp.hasRole(mp.ADMIN_ROLE(), alice));

        vm.prank(alice);
        mp.pause();
        assertTrue(mp.paused());

        mp.unpause();
    }

    function test_RenounceRole() public {
        bytes32 adminRole = mp.ADMIN_ROLE();
        mp.grantRole(adminRole, alice);
        assertTrue(mp.hasRole(adminRole, alice));

        vm.prank(alice);
        mp.renounceRole(adminRole, alice);
        assertFalse(mp.hasRole(adminRole, alice));
    }

    function test_RevertRenounceBadConfirmation() public {
        bytes32 adminRole = mp.ADMIN_ROLE();
        mp.grantRole(adminRole, alice);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(
            IAccessControl.AccessControlBadConfirmation.selector
        ));
        mp.renounceRole(adminRole, alice);
    }

    function test_InitializeV3Migration() public {
        // Deploy a fresh proxy to test V3 migration flow
        MemePlus newImpl = new MemePlus(
            address(usdt),
            address(swapper),
            address(mmToken),
            address(mmToken)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(newImpl),
            abi.encodeCall(MemePlus.initialize, (owner, feeCollector, receiverWallet))
        );
        MemePlus mp2 = MemePlus(address(proxy));

        // Simulate V3 upgrade with migration
        MemePlus newImpl2 = new MemePlus(
            address(usdt),
            address(swapper),
            address(mmToken),
            address(mmToken)
        );
        address[] memory admins = new address[](2);
        admins[0] = alice;
        admins[1] = bob;
        mp2.upgradeToAndCall(
            address(newImpl2),
            abi.encodeCall(MemePlus.initializeV3, (admins))
        );

        assertTrue(mp2.hasRole(mp2.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(mp2.hasRole(mp2.ADMIN_ROLE(), owner));
        assertTrue(mp2.hasRole(mp2.ADMIN_ROLE(), alice));
        assertTrue(mp2.hasRole(mp2.ADMIN_ROLE(), bob));
    }

    // ======================== BCK Release Tests ========================

    function test_ClaimBCKRelease() public {
        mp.setBCKPrice(0.5e18);
        mmToken.mint(address(mp), 100_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        mp.restart(alice);

        // Must reinvest to have active orders (BCK only releases with active orders)
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        (, uint128 originalBCK, ) = mp.getBCKLock(alice);
        assertTrue(originalBCK > 0);

        vm.warp(block.timestamp + 10 days);

        uint256 bckBefore = mmToken.balanceOf(alice);
        vm.prank(alice);
        mp.claimBCKRelease(alice);

        // 10 days * 1% per day = 10% released
        uint256 expected = (uint256(originalBCK) * 100 * 10) / 10000;
        assertEq(mmToken.balanceOf(alice) - bckBefore, expected);
    }

    function test_ClaimBCKReleaseFullRelease() public {
        mp.setBCKPrice(0.5e18);
        mmToken.mint(address(mp), 100_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        mp.restart(alice);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        (, uint128 originalBCK, ) = mp.getBCKLock(alice);

        // 100 days * 1% = 100% released
        vm.warp(block.timestamp + 100 days);

        uint256 bckBefore = mmToken.balanceOf(alice);
        vm.prank(alice);
        mp.claimBCKRelease(alice);

        assertEq(mmToken.balanceOf(alice) - bckBefore, originalBCK);

        (uint128 remaining, , ) = mp.getBCKLock(alice);
        assertEq(remaining, 0);
    }

    function test_ClaimBCKReleaseLinearMultipleClaims() public {
        mp.setBCKPrice(0.5e18);
        mmToken.mint(address(mp), 100_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        mp.restart(alice);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        (, uint128 originalBCK, ) = mp.getBCKLock(alice);

        vm.warp(block.timestamp + 20 days);
        vm.prank(alice);
        mp.claimBCKRelease(alice);
        uint256 claim1 = mmToken.balanceOf(alice);
        assertEq(claim1, (uint256(originalBCK) * 100 * 20) / 10000);

        vm.warp(block.timestamp + 30 days); // 50 days total
        vm.prank(alice);
        mp.claimBCKRelease(alice);
        assertEq(mmToken.balanceOf(alice), (uint256(originalBCK) * 100 * 50) / 10000);
    }

    function test_RevertBCKReleaseNoActiveOrders() public {
        mp.setBCKPrice(0.5e18);
        mmToken.mint(address(mp), 100_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        mp.restart(alice);

        // Restart clears all orders — no active orders
        vm.warp(block.timestamp + 10 days);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.NoActiveOrders.selector));
        mp.claimBCKRelease(alice);
    }

    function test_RevertBCKReleaseTooEarly() public {
        mp.setBCKPrice(0.5e18);
        mmToken.mint(address(mp), 100_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        mp.restart(alice);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        // Same day — daysSinceLock == 0
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.TooEarly.selector));
        mp.claimBCKRelease(alice);
    }

    function test_RevertBCKReleaseNoBCK() public {
        // bckPrice == 0 (default) → no BCK locked on restart
        mmToken.mint(address(mp), 100_000e18);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        mp.restart(alice);

        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        vm.warp(block.timestamp + 10 days);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MPStorage.NoBCKToClaim.selector));
        mp.claimBCKRelease(alice);
    }

    // ======================== Referral Exact Amount Tests ========================

    function test_ReferralGen2ExactAmount() public {
        // alice(2 direct refs) -> bob -> dave. alice is gen2 of dave and gets G2.
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);    // alice directCount = 1
        vm.prank(charlie);
        mp.invest(INVEST_1000, alice);    // alice directCount = 2 → gen2 unlocked
        vm.prank(dave);
        mp.invest(INVEST_1000, bob);

        vm.warp(block.timestamp + 1 days);
        mp.settle();
        uint256 aliceBefore;
        (, , , , , , , , , aliceBefore, , ) = mp.getMemberInfo(alice);
        mp.claimDailyReturn(dave);
        (, , , , , , , , , uint256 aliceAfter, , ) = mp.getMemberInfo(alice);

        // dave 1000 USDT: dynamic=2.4, referralPool=0.72, G2=5%
        uint256 expected = (0.72e18 * 500) / 10000;
        assertEq(aliceAfter - aliceBefore, expected);
    }

    function test_ReferralGen3ExactAmount() public {
        // alice(3 direct refs) is gen3 of frank. alice gets G3.
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);    // alice directCount = 1
        vm.prank(charlie);
        mp.invest(INVEST_1000, alice);    // alice directCount = 2
        vm.prank(eve);
        mp.invest(INVEST_1000, alice);    // alice directCount = 3 → gen3 unlocked
        vm.prank(dave);
        mp.invest(INVEST_1000, bob);
        vm.prank(frank);
        mp.invest(INVEST_1000, dave);    // frank: alice is gen3

        vm.warp(block.timestamp + 1 days);
        mp.settle();
        uint256 aliceBefore;
        (, , , , , , , , , aliceBefore, , ) = mp.getMemberInfo(alice);
        mp.claimDailyReturn(frank);
        (, , , , , , , , , uint256 aliceAfter, , ) = mp.getMemberInfo(alice);

        // frank 1000 USDT: referralPool=0.72, G3=5%
        uint256 expected = (0.72e18 * 500) / 10000;
        assertEq(aliceAfter - aliceBefore, expected);
    }

    // ======================== Team Reward Amount Tests ========================

    function test_TeamRewardV1DifferentialExactAmount() public {
        // alice(V1, gen2 of dave) gets V1 team differential + G2 referral on dave's claim.
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_10000, alice);   // alice branch1
        vm.prank(charlie);
        mp.invest(INVEST_10000, alice);   // alice branch2 → alice V1
        vm.prank(dave);
        mp.invest(INVEST_1000, bob);

        (, uint8 vLevel, , , , , , , , , , ) = mp.getMemberInfo(alice);
        assertEq(vLevel, 1);

        vm.warp(block.timestamp + 1 days);
        mp.settle();
        uint256 aliceBefore;
        (, , , , , , , , , aliceBefore, , ) = mp.getMemberInfo(alice);
        mp.claimDailyReturn(dave);
        (, , , , , , , , , uint256 aliceAfter, , ) = mp.getMemberInfo(alice);

        // dave 1000 USDT: dynamic=2.4, referralPool=0.72, teamPool=1.68
        // alice: G2 referral (2 direct refs → gen2 unlocked) + V1 team differential (5%)
        uint256 referralG2 = (0.72e18 * 500) / 10000;
        uint256 teamV1    = (1.68e18 * 500) / 10000;
        assertEq(aliceAfter - aliceBefore, referralG2 + teamV1);
    }

    function test_SameLevelBonusPaid() public {
        // alice(V1) → bob(V1). frank under bob claims → alice gets same-level bonus.
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_100, alice);

        // bob V1: two 10k branches
        vm.prank(charlie);
        mp.invest(INVEST_10000, bob);
        vm.prank(dave);
        mp.invest(INVEST_10000, bob);

        // alice V1: bob branch (≥10k) + eve branch (10k)
        vm.prank(eve);
        mp.invest(INVEST_10000, alice);

        (, uint8 aliceV, , , , , , , , , , ) = mp.getMemberInfo(alice);
        (, uint8 bobV, , , , , , , , , , ) = mp.getMemberInfo(bob);
        assertEq(aliceV, 1);
        assertEq(bobV, 1);

        vm.prank(frank);
        mp.invest(INVEST_1000, bob);

        vm.warp(block.timestamp + 1 days);
        mp.settle();
        uint256 aliceBefore;
        (, , , , , , , , , aliceBefore, , ) = mp.getMemberInfo(alice);
        mp.claimDailyReturn(frank);
        (, , , , , , , , , uint256 aliceAfter, , ) = mp.getMemberInfo(alice);

        // frank 1000: teamPool=1.68, referralPool=0.72
        // bob(gen1, V1) takes differential → highestLevelPaid=1
        // alice(gen2, V1) same-level → gets sameLevelBonus=10%; also G2 referral
        uint256 sameLevelBonus_ = (1.68e18 * 1000) / 10000;
        uint256 referralG2      = (0.72e18 * 500)  / 10000;
        assertEq(aliceAfter - aliceBefore, sameLevelBonus_ + referralG2);
    }

    // ======================== Frozen / Paused Upline Tests ========================

    function test_FrozenUplineSkipsReferralReward() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);

        mp.freezeMember(alice);

        vm.warp(block.timestamp + 1 days);
        mp.settle();
        uint256 aliceBefore;
        (, , , , , , , , , aliceBefore, , ) = mp.getMemberInfo(alice);

        mp.claimDailyReturn(bob);

        (, , , , , , , , , uint256 aliceAfter, , ) = mp.getMemberInfo(alice);
        // Alice is frozen → no G1 referral reward
        assertEq(aliceAfter, aliceBefore);
    }

    function test_PausedUplineSkipsReferralReward() public {
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);

        mp.pauseMember(alice);

        vm.warp(block.timestamp + 1 days);
        mp.settle();
        uint256 aliceBefore;
        (, , , , , , , , , aliceBefore, , ) = mp.getMemberInfo(alice);

        mp.claimDailyReturn(bob);

        (, , , , , , , , , uint256 aliceAfter, , ) = mp.getMemberInfo(alice);
        // Alice is paused → no G1 referral reward
        assertEq(aliceAfter, aliceBefore);
    }

    // ======================== Team Bonus Level Setting Tests (TDD) ========================

    // --- setVLevelThresholds ---

    function test_SetVLevelThresholds_StoresValues() public {
        uint128[6] memory newThresholds = [
            uint128(5_000e18),
            uint128(20_000e18),
            uint128(100_000e18),
            uint128(300_000e18),
            uint128(800_000e18),
            uint128(2_000_000e18)
        ];
        mp.setVLevelThresholds(newThresholds);

        for (uint8 i = 0; i < 6; i++) {
            assertEq(mp.vLevelThresholds(i), newThresholds[i]);
        }
    }

    function test_SetVLevelThresholds_DefaultValues() public view {
        assertEq(mp.vLevelThresholds(0), 10_000e18);
        assertEq(mp.vLevelThresholds(1), 50_000e18);
        assertEq(mp.vLevelThresholds(2), 200_000e18);
        assertEq(mp.vLevelThresholds(3), 500_000e18);
        assertEq(mp.vLevelThresholds(4), 1_000_000e18);
        assertEq(mp.vLevelThresholds(5), 3_000_000e18);
    }

    function test_SetVLevelThresholds_LowerThresholdTriggersVLevelEarlier() public {
        // Lower V1 threshold so alice qualifies with smaller team investments
        uint128[6] memory lowThresholds = [
            uint128(100e18),
            uint128(500e18),
            uint128(1_000e18),
            uint128(5_000e18),
            uint128(10_000e18),
            uint128(50_000e18)
        ];
        mp.setVLevelThresholds(lowThresholds);

        // alice has two branches with 100 each → small zone = 100 >= new V1 threshold
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_100, alice);
        vm.prank(charlie);
        mp.invest(INVEST_100, alice);

        (, uint8 vLevel, , , , , , , , , ,) = mp.getMemberInfo(alice);
        assertEq(vLevel, 1);
    }

    function test_RevertSetVLevelThresholds_NonAdmin() public {
        uint128[6] memory thresholds = [
            uint128(1e18), uint128(2e18), uint128(3e18),
            uint128(4e18), uint128(5e18), uint128(6e18)
        ];
        vm.prank(alice);
        vm.expectRevert();
        mp.setVLevelThresholds(thresholds);
    }

    function test_SetVLevelThresholds_GrantedAdminCanSet() public {
        address admin = makeAddr("newAdmin");
        mp.addAdmin(admin);

        uint128[6] memory thresholds = [
            uint128(1_000e18), uint128(5_000e18), uint128(10_000e18),
            uint128(50_000e18), uint128(100_000e18), uint128(500_000e18)
        ];
        vm.prank(admin);
        mp.setVLevelThresholds(thresholds);
        assertEq(mp.vLevelThresholds(0), 1_000e18);
    }

    // --- setVLevelRates ---

    function test_SetVLevelRates_StoresValues() public {
        uint16[6] memory newRates = [
            uint16(300),
            uint16(600),
            uint16(900),
            uint16(1200),
            uint16(1500),
            uint16(1800)
        ];
        mp.setVLevelRates(newRates);

        for (uint8 i = 0; i < 6; i++) {
            assertEq(mp.vLevelRates(i), newRates[i]);
        }
    }

    function test_SetVLevelRates_DefaultValues() public view {
        assertEq(mp.vLevelRates(0), 500);
        assertEq(mp.vLevelRates(1), 1000);
        assertEq(mp.vLevelRates(2), 1500);
        assertEq(mp.vLevelRates(3), 1800);
        assertEq(mp.vLevelRates(4), 2000);
        assertEq(mp.vLevelRates(5), 2200);
    }

    function test_SetVLevelRates_EqualRatesValid() public {
        uint16[6] memory equalRates = [
            uint16(1000), uint16(1000), uint16(1000),
            uint16(1000), uint16(1000), uint16(1000)
        ];
        mp.setVLevelRates(equalRates);
        assertEq(mp.vLevelRates(0), 1000);
        assertEq(mp.vLevelRates(5), 1000);
    }

    function test_RevertSetVLevelRates_V2LessThanV1() public {
        uint16[6] memory badRates = [
            uint16(1000), uint16(900), uint16(1500),
            uint16(1800), uint16(2000), uint16(2200)
        ];
        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidLevel.selector));
        mp.setVLevelRates(badRates);
    }

    function test_RevertSetVLevelRates_LastLevelDecreases() public {
        uint16[6] memory badRates = [
            uint16(500), uint16(1000), uint16(1500),
            uint16(1800), uint16(2000), uint16(1900)
        ];
        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidLevel.selector));
        mp.setVLevelRates(badRates);
    }

    function test_RevertSetVLevelRates_NonAdmin() public {
        uint16[6] memory rates = [
            uint16(500), uint16(1000), uint16(1500),
            uint16(1800), uint16(2000), uint16(2200)
        ];
        vm.prank(alice);
        vm.expectRevert();
        mp.setVLevelRates(rates);
    }

    // --- setCommunityRates ---

    function test_SetCommunityRates_StoresValues() public {
        uint16[5] memory newRates = [
            uint16(3000),
            uint16(2500),
            uint16(2000),
            uint16(1500),
            uint16(1000)
        ];
        mp.setCommunityRates(newRates);

        for (uint8 i = 0; i < 5; i++) {
            assertEq(mp.communityRates(i), newRates[i]);
        }
    }

    function test_SetCommunityRates_DefaultValues() public view {
        assertEq(mp.communityRates(0), 2000);
        assertEq(mp.communityRates(1), 1800);
        assertEq(mp.communityRates(2), 1500);
        assertEq(mp.communityRates(3), 1000);
        assertEq(mp.communityRates(4), 500);
    }

    function test_SetCommunityRates_EqualRatesValid() public {
        uint16[5] memory equalRates = [
            uint16(1000), uint16(1000), uint16(1000), uint16(1000), uint16(1000)
        ];
        mp.setCommunityRates(equalRates);
        assertEq(mp.communityRates(0), 1000);
        assertEq(mp.communityRates(4), 1000);
    }

    function test_RevertSetCommunityRates_L2GreaterThanL1() public {
        uint16[5] memory badRates = [
            uint16(2000), uint16(2100), uint16(1500), uint16(1000), uint16(500)
        ];
        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidLevel.selector));
        mp.setCommunityRates(badRates);
    }

    function test_RevertSetCommunityRates_LastLevelIncreases() public {
        uint16[5] memory badRates = [
            uint16(2000), uint16(1800), uint16(1500), uint16(1000), uint16(1100)
        ];
        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidLevel.selector));
        mp.setCommunityRates(badRates);
    }

    function test_RevertSetCommunityRates_NonAdmin() public {
        uint16[5] memory rates = [
            uint16(2000), uint16(1800), uint16(1500), uint16(1000), uint16(500)
        ];
        vm.prank(alice);
        vm.expectRevert();
        mp.setCommunityRates(rates);
    }

    function test_SetCommunityRates_EffectOnPayout() public {
        // Alice community L1. Verify payout uses updated rate.
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));
        mp.setCommunityLevel(alice, 1);

        // Change L1 rate from 20% (2000) to 30% (3000)
        uint16[5] memory newRates = [
            uint16(3000), uint16(2500), uint16(2000), uint16(1500), uint16(1000)
        ];
        mp.setCommunityRates(newRates);

        vm.prank(bob);
        mp.invest(INVEST_1000, alice);

        // Alice should earn 1000 * 30% = 300 (not the default 200)
        assertEq(mp.getCommunityEarned(alice), 300e18);
    }

    // --- Deployer isAdmin backward-compat ---

    function test_DeployerIsAdminAfterAddAdmin() public {
        // Owner has ADMIN_ROLE via AccessControl from initialization
        assertTrue(mp.hasRole(mp.ADMIN_ROLE(), owner));
        // But isAdmin mapping is not set until addAdmin is called
        assertFalse(mp.isAdmin(owner));
        // After calling addAdmin(owner), isAdmin mapping is synced
        mp.addAdmin(owner);
        assertTrue(mp.isAdmin(owner));
    }

    function test_InitializeV3_DeployerNeedsAddAdminForIsAdminMapping() public {
        MemePlus newImpl = new MemePlus(
            address(usdt), address(swapper), address(mmToken), address(mmToken)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(newImpl),
            abi.encodeCall(MemePlus.initialize, (owner, feeCollector, receiverWallet))
        );
        MemePlus mp2 = MemePlus(address(proxy));

        MemePlus newImpl2 = new MemePlus(
            address(usdt), address(swapper), address(mmToken), address(mmToken)
        );
        address[] memory admins = new address[](1);
        admins[0] = alice;
        mp2.upgradeToAndCall(
            address(newImpl2),
            abi.encodeCall(MemePlus.initializeV3, (admins))
        );

        // initializeV3 grants ADMIN_ROLE but does NOT set isAdmin mapping
        assertTrue(mp2.hasRole(mp2.ADMIN_ROLE(), owner));
        assertFalse(mp2.isAdmin(owner));

        // Deploy/upgrade script must call addAdmin(deployer) to sync isAdmin
        mp2.addAdmin(owner);
        assertTrue(mp2.isAdmin(owner));
    }

    // ======================== Admin setMemberVLevel Tests (TDD) ========================

    function test_SetMemberVLevel_AdminCanSetLevel() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        mp.setMemberVLevel(alice, 3);

        (, uint8 vLevel, , , , , , , , , ,) = mp.getMemberInfo(alice);
        assertEq(vLevel, 3);
    }

    function test_SetMemberVLevel_SetToZero() public {
        // First reach V1 auto
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_10000, alice);
        vm.prank(charlie);
        mp.invest(INVEST_10000, alice);

        (, uint8 vLevelBefore, , , , , , , , , ,) = mp.getMemberInfo(alice);
        assertEq(vLevelBefore, 1);

        // Admin overrides back to 0
        mp.setMemberVLevel(alice, 0);
        (, uint8 vLevelAfter, , , , , , , , , ,) = mp.getMemberInfo(alice);
        assertEq(vLevelAfter, 0);
    }

    function test_SetMemberVLevel_AllLevels0To6() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        for (uint8 level = 0; level <= 6; level++) {
            mp.setMemberVLevel(alice, level);
            (, uint8 vLevel, , , , , , , , , ,) = mp.getMemberInfo(alice);
            assertEq(vLevel, level);
        }
    }

    function test_RevertSetMemberVLevel_InvalidLevel() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidLevel.selector));
        mp.setMemberVLevel(alice, 7);
    }

    function test_RevertSetMemberVLevel_NonAdmin() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        vm.prank(bob);
        vm.expectRevert();
        mp.setMemberVLevel(alice, 2);
    }

    function test_SetMemberVLevel_GrantedAdminCanSet() public {
        address admin = makeAddr("newAdmin");
        mp.addAdmin(admin);

        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        vm.prank(admin);
        mp.setMemberVLevel(alice, 4);

        (, uint8 vLevel, , , , , , , , , ,) = mp.getMemberInfo(alice);
        assertEq(vLevel, 4);
    }

    function test_SetMemberVLevelBatch_Works() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));
        vm.prank(bob);
        mp.invest(INVEST_100, address(0));
        vm.prank(charlie);
        mp.invest(INVEST_100, address(0));

        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = charlie;

        uint8[] memory levels = new uint8[](3);
        levels[0] = 1;
        levels[1] = 3;
        levels[2] = 5;

        mp.setMemberVLevelBatch(members, levels);

        (, uint8 aliceV, , , , , , , , , ,) = mp.getMemberInfo(alice);
        (, uint8 bobV, , , , , , , , , ,) = mp.getMemberInfo(bob);
        (, uint8 charlieV, , , , , , , , , ,) = mp.getMemberInfo(charlie);

        assertEq(aliceV, 1);
        assertEq(bobV, 3);
        assertEq(charlieV, 5);
    }

    function test_RevertSetMemberVLevelBatch_LengthMismatch() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;

        uint8[] memory levels = new uint8[](1);
        levels[0] = 1;

        vm.expectRevert(abi.encodeWithSelector(MPStorage.ArrayLengthMismatch.selector));
        mp.setMemberVLevelBatch(members, levels);
    }

    function test_RevertSetMemberVLevelBatch_BatchTooLarge() public {
        address[] memory members = new address[](101);
        uint8[] memory levels = new uint8[](101);
        for (uint256 i = 0; i < 101; i++) {
            members[i] = makeAddr(string(abi.encodePacked("user", i)));
            levels[i] = 1;
        }

        vm.expectRevert(abi.encodeWithSelector(MPStorage.BatchTooLarge.selector));
        mp.setMemberVLevelBatch(members, levels);
    }

    function test_RevertSetMemberVLevelBatch_InvalidLevel() public {
        vm.prank(alice);
        mp.invest(INVEST_100, address(0));

        address[] memory members = new address[](1);
        members[0] = alice;
        uint8[] memory levels = new uint8[](1);
        levels[0] = 7; // invalid

        vm.expectRevert(abi.encodeWithSelector(MPStorage.InvalidLevel.selector));
        mp.setMemberVLevelBatch(members, levels);
    }

    function test_RevertSetMemberVLevelBatch_NonAdmin() public {
        address[] memory members = new address[](1);
        members[0] = alice;
        uint8[] memory levels = new uint8[](1);
        levels[0] = 1;

        vm.prank(bob);
        vm.expectRevert();
        mp.setMemberVLevelBatch(members, levels);
    }

    // ======================== End-to-End Tests ========================

    function test_FullLifecycle() public {
        // 1. Alice invests
        vm.prank(alice);
        mp.invest(INVEST_1000, address(0));

        // 2. Bob invests under alice
        vm.prank(bob);
        mp.invest(INVEST_1000, alice);

        // 3. Advance 10 days
        vm.warp(block.timestamp + 10 days);

        // 4. Claim daily returns
        mp.claimDailyReturn(alice);
        mp.claimDailyReturn(bob);

        // 5. Alice withdraws
        (, , , , , , , , , uint256 aliceBalance, , ) = mp.getMemberInfo(alice);
        if (aliceBalance >= 10e18) {
            uint256 withdrawAmount = (aliceBalance / 10e18) * 10e18; // Round down to multiple of 10
            if (withdrawAmount >= 10e18) {
                vm.prank(alice);
                mp.withdraw(withdrawAmount);
            }
        }

        // 6. Restart bob
        mp.restart(bob);
        (, , , bool bobActive, , , bool bobRestarted, , , , , ) = mp.getMemberInfo(bob);
        assertFalse(bobActive);
        assertTrue(bobRestarted);

        // 7. New user invests under bob (restart referral compensation)
        vm.prank(charlie);
        mp.invest(INVEST_1000, bob);

        (, uint128 refEarned) = mp.getRestartInfo(bob);
        assertTrue(refEarned > 0);
    }
}
