// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/external/PancakeSwapper.sol";

/**
 * @title UpgradePancakeSwapper
 * @notice Deploy new PancakeSwapper implementation and upgrade the proxy.
 *
 * Env vars:
 *   DEPLOYER_PRIVATE_KEY    - owner private key
 *   PANCAKE_SWAPPER_PROXY   - existing proxy address
 *   PANCAKE_ROUTER_ADDRESS  - PancakeSwap router (immutable constructor arg)
 *   USDT_ADDRESS            - USDT token address (immutable constructor arg)
 *   MM_TOKEN_ADDRESS        - MM token address (immutable constructor arg)
 */
contract UpgradePancakeSwapper is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address proxy = vm.envAddress("PANCAKE_SWAPPER_PROXY");
        address router = vm.envAddress("PANCAKE_ROUTER_ADDRESS");
        address usdt = vm.envAddress("USDT_ADDRESS");
        address mmToken = vm.envAddress("MM_TOKEN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        PancakeSwapper newImpl = new PancakeSwapper(router, usdt, mmToken);
        console.log("New PancakeSwapper impl:", address(newImpl));

        PancakeSwapper(proxy).upgradeToAndCall(address(newImpl), "");
        console.log("PancakeSwapper proxy upgraded:", proxy);

        vm.stopBroadcast();
    }
}
