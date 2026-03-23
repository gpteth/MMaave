// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/core/MemePlus.sol";

/**
 * @title UpgradeMemePlus
 * @notice Deploy new MemePlus implementation and upgrade the proxy.
 *
 * Env vars:
 *   DEPLOYER_PRIVATE_KEY  - owner private key
 *   MEMEPLUS_PROXY        - existing proxy address
 *   USDT_ADDRESS          - USDT token address (immutable constructor arg)
 *   PANCAKE_SWAPPER_PROXY - PancakeSwapper proxy address (immutable constructor arg)
 *   MM_TOKEN_ADDRESS      - MM token address (immutable constructor arg)
 *   BCK_TOKEN_ADDRESS     - BCK token address (immutable constructor arg)
 */
contract UpgradeMemePlus is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address proxy = vm.envAddress("MEMEPLUS_PROXY");
        address usdt = vm.envAddress("USDT_ADDRESS");
        address swapperProxy = vm.envAddress("PANCAKE_SWAPPER_PROXY");
        address mmToken = vm.envAddress("MM_TOKEN_ADDRESS");
        address bckToken = vm.envAddress("BCK_TOKEN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        MemePlus newImpl = new MemePlus(usdt, swapperProxy, mmToken, bckToken);
        console.log("New MemePlus impl:", address(newImpl));

        // Prepare initializeV3 calldata with admin addresses
        address[] memory admins = new address[](1);
        admins[0] = 0x769ddC8B629a6D8158Cd6B2f335aE33fe9544fBF;

        bytes memory initData = abi.encodeCall(MemePlus.initializeV3, (admins));

        // Upgrade proxy and call initializeV3
        MemePlus(proxy).upgradeToAndCall(address(newImpl), initData);
        console.log("MemePlus proxy upgraded:", proxy);

        // Set deployer as admin (sets isAdmin mapping for backward compat)
        address deployer = vm.addr(deployerPrivateKey);
        MemePlus(proxy).addAdmin(deployer);
        console.log("Deployer set as admin:", deployer);

        vm.stopBroadcast();
    }
}
