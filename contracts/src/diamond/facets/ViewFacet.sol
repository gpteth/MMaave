// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../AppStorage.sol";
import "../libraries/LibMemePlus.sol";

/// @title ViewFacet - 只读查询函数
/// @notice 提供前端所需的各种数据查询接口，全部为 view 函数
/// @dev ⚠️ 修改注意事项:
///      1. 所有函数都是 view，不涉及存储写入，升级风险最低
///      2. 新增查询函数后通过 diamondCut(Add) 注册即可
///      3. 返回值类型变更会改变选择器 — 需先 Remove 旧的再 Add 新的
///      4. 此 facet 不继承 Modifiers（不需要访问控制），直接引用 AppStorage
contract ViewFacet {
    uint256 internal constant MAX_DEPTH = 30;

    error InvalidIndex();

    /// @notice 获取会员完整信息
    /// 返回值按顺序: referrer, vLevel, communityLevel, isActive, isFrozen,
    /// isPaused, isRestarted, totalInvested, totalWithdrawn, balance,
    /// totalEarned, directReferralCount
    function getMemberInfo(address user) external view returns (
        address referrer,
        uint8 vLevel,
        uint8 communityLevel,
        bool isActive,
        bool isFrozen,
        bool isPaused,
        bool isRestarted,
        uint256 totalInvested,
        uint256 totalWithdrawn,
        uint256 balance,
        uint256 totalEarned,
        uint256 directReferralCount
    ) {
        AppStorage storage s = LibAppStorage.appStorage();
        Member storage m = s.members[user];
        return (
            m.referrer,
            m.vLevel,
            m.communityLevel,
            m.isActive,
            m.isFrozen,
            m.isPaused,
            m.isRestarted,
            m.totalInvested,
            m.totalWithdrawn,
            m.balance,
            m.totalEarned,
            m.directReferralCount
        );
    }

    /// @notice 获取用户所有投资订单
    function getOrders(address user) external view returns (Order[] memory) {
        return LibAppStorage.appStorage().orders[user];
    }

    /// @notice 获取用户订单数量
    function getOrderCount(address user) external view returns (uint256) {
        return LibAppStorage.appStorage().orders[user].length;
    }

    /// @notice 获取用户直推列表
    function getDirectReferrals(address user) external view returns (address[] memory) {
        return LibAppStorage.appStorage().directReferrals[user];
    }

    /// @notice 获取用户团队总业绩
    function getTeamPerformance(address user) external view returns (uint256) {
        return LibAppStorage.appStorage().teamPerformance[user];
    }

    /// @notice 获取用户某个直推分支的业绩
    function getBranchPerformance(address user, address directRef) external view returns (uint256) {
        return LibAppStorage.appStorage().branchPerformance[user][directRef];
    }

    /// @notice 获取用户重启信息
    function getRestartInfo(address user) external view returns (uint128 unreturnedCapital, uint128 referralEarned) {
        AppStorage storage s = LibAppStorage.appStorage();
        RestartInfo storage info = s.restartInfo[user];
        return (info.unreturnedCapital, info.referralEarned);
    }

    /// @notice 获取 MM 代币锁仓信息
    function getTokenLock(address user) external view returns (uint128 amount, uint128 originalAmount, uint32 lockedAt) {
        AppStorage storage s = LibAppStorage.appStorage();
        TokenLock storage lock = s.tokenLocks[user];
        return (lock.amount, lock.originalAmount, lock.lockedAt);
    }

    /// @notice 获取 BCK 代币锁仓信息
    function getBCKLock(address user) external view returns (uint128 amount, uint128 originalAmount, uint32 lockedAt) {
        AppStorage storage s = LibAppStorage.appStorage();
        BCKLock storage lock = s.bckLocks[user];
        return (lock.amount, lock.originalAmount, lock.lockedAt);
    }

    /// @notice 获取社区收益累计
    function getCommunityEarned(address user) external view returns (uint256) {
        return LibAppStorage.appStorage().communityEarned[user];
    }

    /// @notice 获取用户小区业绩（团队业绩 - 最大分支业绩）
    function getSmallZonePerformance(address user) external view returns (uint256) {
        AppStorage storage s = LibAppStorage.appStorage();
        return LibMemePlus.getSmallZonePerformance(s, user);
    }

    /// @notice 获取总会员数
    function getAllMembersCount() external view returns (uint256) {
        return LibAppStorage.appStorage().allMembers.length;
    }

    /// @notice 按索引获取会员地址
    function getMemberAtIndex(uint256 index) external view returns (address) {
        AppStorage storage s = LibAppStorage.appStorage();
        if (index >= s.allMembers.length) revert InvalidIndex();
        return s.allMembers[index];
    }

    /// @notice 查询地址是否已注册
    function isMemberRegistered(address user) external view returns (bool) {
        return LibAppStorage.appStorage().isMemberRegistered[user];
    }

    /// @notice 获取团队综合信息（前端常用）
    /// @return teamPerf 团队总业绩
    /// @return smallZonePerf 小区业绩
    /// @return directCount 直推人数
    /// @return vLevel V 等级
    function getTeamInfo(address user) external view returns (
        uint256 teamPerf,
        uint256 smallZonePerf,
        uint256 directCount,
        uint8 vLevel
    ) {
        AppStorage storage s = LibAppStorage.appStorage();
        teamPerf = s.teamPerformance[user];
        smallZonePerf = LibMemePlus.getSmallZonePerformance(s, user);
        directCount = s.members[user].directReferralCount;
        vLevel = s.members[user].vLevel;
    }
}
