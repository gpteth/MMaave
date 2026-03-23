// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AccessControlUpgradeable
 * @notice Minimal role-based access control using ERC-7201 namespaced storage.
 *         Safe for use in UUPS-upgradeable contracts — no sequential storage conflict.
 */
abstract contract AccessControlUpgradeable {
    // ======================== ERC-7201 Namespaced Storage ========================

    /// @custom:storage-location erc7201:memepro.storage.AccessControl
    struct AccessControlStorage {
        mapping(bytes32 role => RoleData) _roles;
    }

    struct RoleData {
        mapping(address account => bool) hasRole;
        bytes32 adminRole;
    }

    // keccak256(abi.encode(uint256(keccak256("memepro.storage.AccessControl")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ACCESS_CONTROL_STORAGE =
        0x6ee632174dd589e936cda6629a5b3a31099c3a13ee39bb284b4727bb4fbbf700;

    function _getAccessControlStorage() private pure returns (AccessControlStorage storage $) {
        assembly {
            $.slot := ACCESS_CONTROL_STORAGE
        }
    }

    // ======================== Constants ========================

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    // ======================== Errors ========================

    error AccessControlUnauthorizedAccount(address account, bytes32 role);
    error AccessControlBadConfirmation();

    // ======================== Events ========================

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    // ======================== Modifier ========================

    modifier onlyRole(bytes32 role) {
        _checkRole(role, msg.sender);
        _;
    }

    // ======================== Public View ========================

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _getAccessControlStorage()._roles[role].hasRole[account];
    }

    function getRoleAdmin(bytes32 role) public view returns (bytes32) {
        return _getAccessControlStorage()._roles[role].adminRole;
    }

    // ======================== External Mutative ========================

    function grantRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    function renounceRole(bytes32 role, address callerConfirmation) public virtual {
        if (callerConfirmation != msg.sender) revert AccessControlBadConfirmation();
        _revokeRole(role, msg.sender);
    }

    // ======================== Internal ========================

    function _checkRole(bytes32 role, address account) internal view {
        if (!hasRole(role, account)) {
            revert AccessControlUnauthorizedAccount(account, role);
        }
    }

    function _grantRole(bytes32 role, address account) internal returns (bool) {
        AccessControlStorage storage $ = _getAccessControlStorage();
        if (!$._roles[role].hasRole[account]) {
            $._roles[role].hasRole[account] = true;
            emit RoleGranted(role, account, msg.sender);
            return true;
        }
        return false;
    }

    function _revokeRole(bytes32 role, address account) internal returns (bool) {
        AccessControlStorage storage $ = _getAccessControlStorage();
        if ($._roles[role].hasRole[account]) {
            $._roles[role].hasRole[account] = false;
            emit RoleRevoked(role, account, msg.sender);
            return true;
        }
        return false;
    }

    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal {
        AccessControlStorage storage $ = _getAccessControlStorage();
        bytes32 previousAdmin = $._roles[role].adminRole;
        $._roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdmin, adminRole);
    }
}
