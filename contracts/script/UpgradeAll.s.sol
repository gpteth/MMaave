// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/core/MemePlus.sol";
import "../src/external/PancakeSwapper.sol";

/**
 * @title UpgradeAll
 * @notice Deploy new implementations and upgrade MemePlus + PancakeSwapper proxies.
 *
 * Env vars:
 *   DEPLOYER_PRIVATE_KEY      - owner private key
 *   MEMEPLUS_PROXY            - MemePlus proxy address
 *   PANCAKE_SWAPPER_PROXY     - PancakeSwapper proxy address
 *   USDT_ADDRESS              - USDT token address
 *   PANCAKE_ROUTER_ADDRESS    - PancakeSwap router address
 *   MM_TOKEN_ADDRESS          - MM token address
 */
contract UpgradeAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        address mpProxy      = vm.envAddress("MEMEPLUS_PROXY");
        address swapperProxy = vm.envAddress("PANCAKE_SWAPPER_PROXY");

        address usdt         = vm.envAddress("USDT_ADDRESS");
        address router       = vm.envAddress("PANCAKE_ROUTER_ADDRESS");
        address mmToken      = vm.envAddress("MM_TOKEN_ADDRESS");
        address bckToken     = vm.envAddress("BCK_TOKEN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Upgrade PancakeSwapper
        PancakeSwapper newSwapperImpl = new PancakeSwapper(router, usdt, mmToken);
        PancakeSwapper(swapperProxy).upgradeToAndCall(address(newSwapperImpl), "");
        console.log("PancakeSwapper impl:", address(newSwapperImpl));
        console.log("PancakeSwapper proxy:", swapperProxy);

        // 2. Upgrade MemePlus
        MemePlus newMpImpl = new MemePlus(usdt, swapperProxy, mmToken, bckToken);
        MemePlus(mpProxy).upgradeToAndCall(address(newMpImpl), "");
        console.log("MemePlus impl:     ", address(newMpImpl));
        console.log("MemePlus proxy:    ", mpProxy);

        console.log("---");
        console.log("All upgrades complete!");

        vm.stopBroadcast();
    }
}
