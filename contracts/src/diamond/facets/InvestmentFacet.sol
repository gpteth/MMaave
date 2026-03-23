// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../Modifiers.sol";
import "../libraries/LibMemePlus.sol";
import "../../interfaces/IAaveVault.sol";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                InvestmentFacet - 核心投资业务 Facet                          ║
// ║                                                                              ║
// ║  ⚠️ 修改注意事项:                                                            ║
// ║  1. 此 facet 引用 LibMemePlus 库 — 修改库后需重新部署此 facet                ║
// ║  2. invest() 涉及资金转移，修改时需严格遵循 checks-effects-interactions       ║
// ║  3. 新增函数后需通过 diamondCut(Add) 注册其选择器                             ║
// ║  4. 修改已有函数签名会改变选择器 — 需先 Remove 旧的再 Add 新的               ║
// ║  5. 若只修改函数体（不改签名），用 Replace 操作指向新部署的 facet             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/// @title InvestmentFacet - 投资、注册、日收益领取、Epoch 结算
/// @notice 包含用户面向的核心操作: register, invest, claimDailyReturn, settle
contract InvestmentFacet is Modifiers {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /// @notice 独立注册（不投资）
    /// @dev 用户也可以在 invest() 时自动注册
    function register(address referrer) external nonReentrant whenNotPaused {
        AppStorage storage s = LibAppStorage.appStorage();
        if (s.isMemberRegistered[msg.sender]) revert AlreadyRegistered();
        LibMemePlus.registerMember(s, msg.sender, referrer);
    }

    /// @notice 投资 USDT
    /// @dev 完整流程:
    ///      1. 检查金额（≥ minInvestment, 100的倍数）
    ///      2. 转入 USDT (user → Diamond)
    ///      3. 如未注册则自动注册
    ///      4. 创建投资订单
    ///      5. 更新团队业绩 (向上遍历推荐链)
    ///      6. 转出 USDT (Diamond → receiverWallet)
    ///      7. 分配社区收益
    ///      8. 处理重启推荐补偿
    /// @param amount 投资金额 (USDT, 18 decimals, 需为 100 的倍数)
    /// @param referrer 推荐人地址（已注册用户传 address(0)）
    function invest(uint256 amount, address referrer) external nonReentrant whenNotPaused {
        AppStorage storage s = LibAppStorage.appStorage();
        address user = msg.sender;

        // ── Checks ──
        if (amount < s.minInvestment) revert BelowMinInvestment();
        if (amount % 100e18 != 0) revert NotMultipleOf100();

        Member storage member = s.members[user];
        if (member.isFrozen) revert AccountFrozen();
        if (member.isPaused) revert AccountPaused();

        // ── 自动推进 Epoch ──
        uint256 newEpochs = (block.timestamp - s.lastSettledAt) / s.settlementInterval;
        if (newEpochs > 0) {
            s.lastSettledAt += newEpochs * s.settlementInterval;
            s.currentEpoch += newEpochs;
            emit EpochSettled(s.currentEpoch, block.timestamp);
        }

        // ── Interactions (转入 → Aave Supply) ──
        // 用户 USDT → Diamond → AaveVault → Aave Pool
        IERC20(s.usdt).safeTransferFrom(user, address(this), amount);
        IERC20(s.usdt).safeTransfer(s.aaveVault, amount);
        IAaveVault(s.aaveVault).deposit(amount);

        // ── Effects: 注册 ──
        if (!s.isMemberRegistered[user]) {
            LibMemePlus.registerMember(s, user, referrer);
        }

        // 重启用户重新投资时恢复活跃状态
        if (member.isRestarted) {
            member.isActive = true;
        }

        // ── Effects: 创建订单 ──
        uint256 orderIndex = s.orders[user].length;
        s.orders[user].push(Order({
            amount: amount.toUint128(),
            totalReturned: 0,
            createdAt: block.timestamp.toUint32(),
            lastClaimedAt: 0,
            isActive: true,
            lastClaimedEpoch: uint32(s.currentEpoch)
        }));
        member.totalInvested += amount.toUint128();
        emit OrderCreated(user, amount, orderIndex);

        // ── Effects: 更新团队业绩 ──
        LibMemePlus.updateTeamPerformance(s, user, amount);

        // ── 分配社区收益（按投资金额 × 级差比例） ──
        LibMemePlus.distributeCommunityIncome(s, user, amount);

        // ── 处理重启推荐补偿 ──
        _handleRestartReferralCompensation(s, user, amount);

        emit Invested(user, amount, referrer);
    }

    /// @notice 使用收入余额投资（不需要转入 USDT）
    /// @dev 从 member.balance 中扣除金额创建订单，USDT 已在 receiverWallet 中
    /// @param amount 投资金额 (USDT, 18 decimals, 需为 100 的倍数)
    /// @param referrer 推荐人地址（已注册用户传 address(0)）
    function investFromBalance(uint256 amount, address referrer) external nonReentrant whenNotPaused {
        AppStorage storage s = LibAppStorage.appStorage();
        address user = msg.sender;

        // ── Checks ──
        if (amount < s.minInvestment) revert BelowMinInvestment();
        if (amount % 100e18 != 0) revert NotMultipleOf100();

        Member storage member = s.members[user];
        if (member.isFrozen) revert AccountFrozen();
        if (member.isPaused) revert AccountPaused();
        if (!s.isMemberRegistered[user]) revert NotActive();
        if (member.balance < amount.toUint128()) revert InsufficientBalance();

        // ── 自动推进 Epoch ──
        uint256 newEpochs = (block.timestamp - s.lastSettledAt) / s.settlementInterval;
        if (newEpochs > 0) {
            s.lastSettledAt += newEpochs * s.settlementInterval;
            s.currentEpoch += newEpochs;
            emit EpochSettled(s.currentEpoch, block.timestamp);
        }

        // ── Effects: 扣除余额 ──
        member.balance -= amount.toUint128();

        // 重启用户重新投资时恢复活跃状态
        if (member.isRestarted) {
            member.isActive = true;
        }

        // ── Effects: 创建订单 ──
        uint256 orderIndex = s.orders[user].length;
        s.orders[user].push(Order({
            amount: amount.toUint128(),
            totalReturned: 0,
            createdAt: block.timestamp.toUint32(),
            lastClaimedAt: 0,
            isActive: true,
            lastClaimedEpoch: uint32(s.currentEpoch)
        }));
        member.totalInvested += amount.toUint128();
        emit OrderCreated(user, amount, orderIndex);

        // ── Effects: 更新团队业绩 ──
        LibMemePlus.updateTeamPerformance(s, user, amount);

        // ── 分配社区收益（按投资金额 × 级差比例） ──
        LibMemePlus.distributeCommunityIncome(s, user, amount);

        // ── 处理重启推荐补偿 ──
        _handleRestartReferralCompensation(s, user, amount);

        emit Invested(user, amount, referrer);
    }

    // ════════════════════════════════════════════════════════════════
    //                  Epoch 结算 (Settlement)
    // ════════════════════════════════════════════════════════════════

    /// @notice 推进 epoch（任何人可调用）
    /// @dev 每过一个 settlementInterval (默认 1 天) 增加一个 epoch
    ///      epoch 用于计算日收益的应发天数
    ///      多个间隔会一次性推进多个 epoch
    function settle() external {
        AppStorage storage s = LibAppStorage.appStorage();
        uint256 newEpochs = (block.timestamp - s.lastSettledAt) / s.settlementInterval;
        if (newEpochs == 0) revert TooEarly();
        s.lastSettledAt += newEpochs * s.settlementInterval;
        s.currentEpoch += newEpochs;
        emit EpochSettled(s.currentEpoch, block.timestamp);
    }

    // ════════════════════════════════════════════════════════════════
    //                   日收益领取 (Daily Return)
    // ════════════════════════════════════════════════════════════════

    /// @notice 为指定用户领取日收益
    /// @dev 用户本人、管理员或 owner 可调用
    ///      实际逻辑在 LibMemePlus.claimDailyReturn() 中
    function claimDailyReturn(address user) external nonReentrant whenNotPaused {
        AppStorage storage s = LibAppStorage.appStorage();
        // 权限检查: 本人 或 管理员 或 owner
        if (msg.sender != user && !s.roles[ADMIN_ROLE][msg.sender] && msg.sender != LibDiamond.contractOwner()) {
            revert NotAdmin();
        }
        LibMemePlus.claimDailyReturn(s, user);
    }

    /// @notice 推进 epoch + 批量领取日收益（管理员一键操作）
    /// @dev 自动推进 epoch（如果可以），然后批量领取
    function settleAndBatchClaim(address[] calldata users) external nonReentrant whenNotPaused {
        AppStorage storage s = LibAppStorage.appStorage();
        if (!s.roles[ADMIN_ROLE][msg.sender] && msg.sender != LibDiamond.contractOwner()) revert NotAdmin();
        if (users.length > 50) revert BatchTooLarge();

        // 自动推进 epoch
        uint256 newEpochs = (block.timestamp - s.lastSettledAt) / s.settlementInterval;
        if (newEpochs > 0) {
            s.lastSettledAt += newEpochs * s.settlementInterval;
            s.currentEpoch += newEpochs;
            emit EpochSettled(s.currentEpoch, block.timestamp);
        }

        // 批量领取
        for (uint256 i; i < users.length;) {
            LibMemePlus.claimDailyReturn(s, users[i]);
            unchecked { ++i; }
        }
    }

    /// @notice 批量领取日收益（管理员/owner 专用）
    /// @dev 最多 50 个用户一批，防止 gas 超限
    function batchClaimDailyReturn(address[] calldata users) external nonReentrant whenNotPaused {
        AppStorage storage s = LibAppStorage.appStorage();
        if (!s.roles[ADMIN_ROLE][msg.sender] && msg.sender != LibDiamond.contractOwner()) revert NotAdmin();
        if (users.length > 50) revert BatchTooLarge();
        for (uint256 i; i < users.length;) {
            LibMemePlus.claimDailyReturn(s, users[i]);
            unchecked { ++i; }
        }
    }

    // ════════════════════════════════════════════════════════════════
    //              重启推荐补偿 (Restart Referral Compensation)
    // ════════════════════════════════════════════════════════════════

    /// @dev 当被推荐人投资时，如果推荐人处于重启状态，给予推荐人补偿
    ///      补偿 = investAmount × restartReferralRate / 10000
    ///      上限 = unreturnedCapital × restartReferralCap / 100
    function _handleRestartReferralCompensation(AppStorage storage s, address referredUser, uint256 investAmount) internal {
        address restartedUser = s.members[referredUser].referrer;
        if (restartedUser == address(0)) return;
        if (!s.members[restartedUser].isRestarted) return;

        RestartInfo storage info = s.restartInfo[restartedUser];
        uint256 cap = (uint256(info.unreturnedCapital) * s.restartReferralCap) / 100;
        if (info.referralEarned >= cap) return;

        uint256 compensation = (investAmount * s.restartReferralRate) / 10000;
        uint256 remaining;
        unchecked { remaining = cap - info.referralEarned; }
        if (compensation > remaining) compensation = remaining;

        if (compensation > 0) {
            s.members[restartedUser].balance += compensation.toUint128();
            info.referralEarned += compensation.toUint128();
            emit ReferralCompensationClaimed(restartedUser, referredUser, compensation);
        }
    }
}
