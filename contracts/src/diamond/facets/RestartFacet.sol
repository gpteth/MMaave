// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../Modifiers.sol";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                   RestartFacet - 重启与补偿机制                              ║
// ║                                                                              ║
// ║  ⚠️ 修改注意事项:                                                            ║
// ║  1. _restartUser 会清零用户状态并删除订单 — 不可逆操作                        ║
// ║  2. MM/BCK 代币释放涉及实际代币转账，确保 Diamond 合约持有足够代币            ║
// ║  3. claimBCKRelease 要求用户有活跃订单（需先再次投资）                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/// @title RestartFacet - 用户重启、MM 补偿领取、BCK 锁仓释放
/// @notice 管理员可重启用户账户，重启后用户可逐步领取 MM/BCK 代币补偿
contract RestartFacet is Modifiers {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /// @notice 重启单个用户（Admin Only）
    function restart(address user) external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();
        _restartUser(s, user);
    }

    /// @notice 批量重启用户（Admin Only，最多 100 个）
    /// @dev 跳过非活跃用户
    function globalRestart(address[] calldata users) external onlyAdmin {
        if (users.length > 100) revert BatchTooLarge();
        AppStorage storage s = LibAppStorage.appStorage();
        for (uint256 i; i < users.length;) {
            if (s.members[users[i]].isActive) {
                _restartUser(s, users[i]);
            }
            unchecked { ++i; }
        }
        emit GlobalRestartExecuted(users.length);
    }

    /// @dev 重启用户核心逻辑
    /// 流程:
    ///   1. 计算未返还本金 = totalInvested - totalWithdrawn
    ///   2. 按比例创建 MM 锁仓补偿 (restartMMCompPercent)
    ///   3. 按比例创建 BCK 锁仓 (perpetualBCKPercent)
    ///   4. 清零用户状态: balance, totalEarned, totalInvested, totalWithdrawn
    ///   5. 删除所有订单
    ///   6. 标记 isRestarted = true, isActive = false
    function _restartUser(AppStorage storage s, address user) internal {
        Member storage member = s.members[user];
        if (!member.isActive && member.totalInvested == 0) revert NothingToRestart();

        // 计算未返还本金
        uint128 unreturned;
        if (member.totalInvested > member.totalWithdrawn) {
            unchecked { unreturned = member.totalInvested - member.totalWithdrawn; }
        }

        // 记录重启信息（用于后续推荐补偿计算）
        s.restartInfo[user] = RestartInfo({
            unreturnedCapital: unreturned,
            referralEarned: 0
        });

        // MM 补偿锁仓: unreturned × restartMMCompPercent / 10000
        uint128 mmCompAmount = ((uint256(unreturned) * s.restartMMCompPercent) / 10000).toUint128();
        s.tokenLocks[user] = TokenLock({
            amount: mmCompAmount,
            originalAmount: mmCompAmount,
            lockedAt: block.timestamp.toUint32()
        });

        // BCK 锁仓: unreturned × perpetualBCKPercent / 10000，再按 bckPrice 换算数量
        if (unreturned > 0 && s.bckPrice > 0 && s.perpetualBCKPercent > 0) {
            uint256 bckUsdtValue = (uint256(unreturned) * s.perpetualBCKPercent) / 10000;
            uint256 bckAmount = (bckUsdtValue * 1e18) / s.bckPrice;
            if (bckAmount > 0) {
                s.bckLocks[user] = BCKLock({
                    amount: bckAmount.toUint128(),
                    originalAmount: bckAmount.toUint128(),
                    lockedAt: block.timestamp.toUint32()
                });
                emit BCKLocked(user, bckAmount, unreturned);
            }
        }

        // 清零用户状态
        member.isRestarted = true;
        member.isActive = false;
        member.balance = 0;
        member.totalEarned = 0;
        member.totalInvested = 0;
        member.totalWithdrawn = 0;

        // 删除所有订单
        delete s.orders[user];

        emit AccountRestarted(user, unreturned);
    }

    // ════════════════════════════════════════════════════════════════
    //                  BCK 锁仓释放 (BCK Lock Release)
    // ════════════════════════════════════════════════════════════════

    /// @notice 领取 BCK 锁仓释放
    /// @dev 前置条件: 用户必须有活跃订单（需重新投资后才能领取）
    ///      释放公式: maxReleasable = originalAmount × restartMMReleaseRate × daysSinceLock / 10000
    ///      每次领取 = maxReleasable - 已领取量
    function claimBCKRelease(address user) external nonReentrant whenNotPaused {
        AppStorage storage s = LibAppStorage.appStorage();
        // 权限: 本人 / 管理员 / owner
        if (msg.sender != user && !s.roles[ADMIN_ROLE][msg.sender] && msg.sender != LibDiamond.contractOwner()) {
            revert NotAdmin();
        }

        BCKLock storage lock = s.bckLocks[user];
        if (lock.originalAmount == 0) revert NoBCKToClaim();
        if (lock.amount == 0) revert NoBCKToClaim();

        // 必须有活跃订单（防止不投资就领取补偿）
        if (!_hasActiveOrders(s, user)) revert NoActiveOrders();

        uint256 daysSinceLock = (block.timestamp - lock.lockedAt) / 1 days;
        if (daysSinceLock == 0) revert TooEarly();

        // 计算最大可释放量
        uint256 maxReleasable = (uint256(lock.originalAmount) * s.restartMMReleaseRate * daysSinceLock) / 10000;
        if (maxReleasable > lock.originalAmount) maxReleasable = lock.originalAmount;

        uint256 alreadyClaimed = uint256(lock.originalAmount) - uint256(lock.amount);
        if (maxReleasable <= alreadyClaimed) revert TooEarly();

        uint256 releaseAmount;
        unchecked { releaseAmount = maxReleasable - alreadyClaimed; }

        lock.amount -= releaseAmount.toUint128();

        // 转出 BCK 代币
        if (releaseAmount > 0) {
            IERC20(s.bckToken).safeTransfer(user, releaseAmount);
            emit BCKReleased(user, releaseAmount);
        }
    }

    // ════════════════════════════════════════════════════════════════
    //                 MM 补偿领取 (MM Compensation Claim)
    // ════════════════════════════════════════════════════════════════

    /// @notice 领取 MM 代币补偿
    /// @dev 前置条件: 用户必须处于已重启状态
    ///      释放公式同 BCK: originalAmount × restartMMReleaseRate × days / 10000
    function claimMMCompensation(address user) external nonReentrant whenNotPaused {
        AppStorage storage s = LibAppStorage.appStorage();
        if (msg.sender != user && !s.roles[ADMIN_ROLE][msg.sender] && msg.sender != LibDiamond.contractOwner()) {
            revert NotAdmin();
        }
        if (!s.members[user].isRestarted) revert NotRestarted();

        TokenLock storage lock = s.tokenLocks[user];
        if (lock.originalAmount == 0) revert NoMMToClaim();
        if (lock.amount == 0) revert NoMMToClaim();

        uint256 daysSinceLock = (block.timestamp - lock.lockedAt) / 1 days;
        if (daysSinceLock == 0) revert TooEarly();

        uint256 maxReleasable = (uint256(lock.originalAmount) * s.restartMMReleaseRate * daysSinceLock) / 10000;
        if (maxReleasable > lock.originalAmount) maxReleasable = lock.originalAmount;

        uint256 alreadyClaimed = uint256(lock.originalAmount) - uint256(lock.amount);
        if (maxReleasable <= alreadyClaimed) revert TooEarly();

        uint256 releaseAmount;
        unchecked { releaseAmount = maxReleasable - alreadyClaimed; }

        lock.amount -= releaseAmount.toUint128();

        // 转出 MM 代币
        if (releaseAmount > 0) {
            IERC20(s.mmToken).safeTransfer(user, releaseAmount);
            emit MMCompensationClaimed(user, releaseAmount);
        }
    }

    /// @dev 检查用户是否有活跃订单
    function _hasActiveOrders(AppStorage storage s, address user) internal view returns (bool) {
        Order[] storage userOrders = s.orders[user];
        for (uint256 i; i < userOrders.length;) {
            if (userOrders[i].isActive) return true;
            unchecked { ++i; }
        }
        return false;
    }
}
