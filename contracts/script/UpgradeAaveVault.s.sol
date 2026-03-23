// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/external/AaveVault.sol";

/**
 * @title UpgradeAaveVault
 * @notice Deploy new AaveVault implementation and upgrade the proxy.
 *
 * Env vars:
 *   DEPLOYER_PRIVATE_KEY - owner private key
 *   AAVE_VAULT_PROXY     - existing proxy address
 *   AAVE_POOL_ADDRESS    - AAVE pool address (immutable constructor arg)
 *   USDT_ADDRESS         - USDT token address (immutable constructor arg)
 *   ATOKEN_ADDRESS       - aToken address (immutable constructor arg)
 */
contract UpgradeAaveVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address proxy = vm.envAddress("AAVE_VAULT_PROXY");
        address aavePool = vm.envAddress("AAVE_POOL_ADDRESS");
        address usdt = vm.envAddress("USDT_ADDRESS");
        address aToken = vm.envAddress("ATOKEN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        AaveVault newImpl = new AaveVault(aavePool, usdt, aToken);
        console.log("New AaveVault impl:", address(newImpl));

        AaveVault(proxy).upgradeToAndCall(address(newImpl), "");
        console.log("AaveVault proxy upgraded:", proxy);

        vm.stopBroadcast();
    }
}
