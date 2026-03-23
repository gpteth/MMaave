// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/core/MemePlus.sol";
import "../src/external/PancakeSwapper.sol";

/**
 * @title DeployScript
 * @notice DEPRECATED — Use DeployProxy.s.sol for proxy deployments.
 *         Kept for reference only.
 */
contract DeployScript is Script {
    function run() external pure {
        revert("DEPRECATED: Use DeployProxy.s.sol for UUPS proxy deployments");
    }
}
