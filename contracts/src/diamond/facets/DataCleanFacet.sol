// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Modifiers.sol";

/// @title DataCleanFacet - 一次性数据清理工具
/// @notice 清空除管理员外的所有注册和订单数据，用于测试前的环境重置
/// @dev 管理员可通过前端操作页面调用
contract DataCleanFacet is Modifiers {

    event DataPurged(uint256 purgedCount, uint256 keptCount);

    /// @notice 清除所有非管理员用户的注册和订单数据
    /// @dev 只保留 isAdmin 为 true 的用户，其他全部清除
    ///      同时重置管理员的推荐关系数据（因下线已被清除）
    function purgeNonAdminData() external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();

        uint256 total = s.allMembers.length;
        address[] memory adminsToKeep = new address[](total);
        uint256 keepCount;

        // Phase 1: 遍历所有成员，清除非管理员数据
        for (uint256 i; i < total;) {
            address user = s.allMembers[i];

            if (s.isAdmin[user]) {
                // 管理员：保留注册，但重置推荐关系数据（下线已被清除）
                adminsToKeep[keepCount] = user;
                unchecked { ++keepCount; }

                // 清除 branchPerformance
                address[] storage refs = s.directReferrals[user];
                for (uint256 j; j < refs.length;) {
                    delete s.branchPerformance[user][refs[j]];
                    unchecked { ++j; }
                }
                delete s.directReferrals[user];
                s.teamPerformance[user] = 0;
                s.members[user].directReferralCount = 0;

                // 清零管理员的订单和余额（干净测试环境）
                Member storage adminMember = s.members[user];
                adminMember.balance = 0;
                adminMember.totalEarned = 0;
                adminMember.totalInvested = 0;
                adminMember.totalWithdrawn = 0;
                adminMember.isActive = false;
                adminMember.isRestarted = false;
                adminMember.vLevel = 0;
                delete s.orders[user];
                delete s.restartInfo[user];
                delete s.tokenLocks[user];
                delete s.bckLocks[user];
                s.communityEarned[user] = 0;
            } else {
                // 非管理员：完全清除
                _purgeUser(s, user);
            }

            unchecked { ++i; }
        }

        // Phase 2: 重建 allMembers 数组（只保留管理员）
        uint256 oldLen = s.allMembers.length;
        for (uint256 i = oldLen; i > 0;) {
            unchecked { --i; }
            s.allMembers.pop();
        }
        for (uint256 i; i < keepCount;) {
            s.allMembers.push(adminsToKeep[i]);
            unchecked { ++i; }
        }

        // Phase 3: 重置 epoch
        s.currentEpoch = 0;
        s.lastSettledAt = block.timestamp;

        emit DataPurged(total - keepCount, keepCount);
    }

    /// @dev 彻底清除单个用户的所有数据
    function _purgeUser(AppStorage storage s, address user) internal {
        address[] storage refs = s.directReferrals[user];
        for (uint256 j; j < refs.length;) {
            delete s.branchPerformance[user][refs[j]];
            unchecked { ++j; }
        }
        delete s.directReferrals[user];
        s.teamPerformance[user] = 0;

        delete s.members[user];
        delete s.orders[user];
        delete s.restartInfo[user];
        delete s.tokenLocks[user];
        delete s.bckLocks[user];
        s.communityEarned[user] = 0;
        s.isMemberRegistered[user] = false;
    }
}
