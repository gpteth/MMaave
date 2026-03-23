// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/external/AaveVault.sol";

/// @title DeployAaveVault - 部署 AaveVault (UUPS 代理)
/// @notice 部署 AaveVault implementation + ERC1967 proxy，并授权 Diamond 合约
///
/// BSC Mainnet Aave V3 地址:
///   Pool: 0x6807dc923806fE8Fd134338EABCA509979a7e0cB
///   aUSDT: 0xa9251ca9DE909CB71783723713B21E4233fbf1B1
///
/// Env vars:
///   PRIVATE_KEY        - deployer private key
///   USDT_ADDRESS       - USDT (BSC)
///   AAVE_POOL_ADDRESS  - Aave V3 Pool
///   ATOKEN_ADDRESS     - aUSDT token
contract DeployAaveVault is Script {
    address constant DIAMOND = 0xB3197881Cd985bDd7D442F03d534FC37169e0C96;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdt = vm.envAddress("USDT_ADDRESS");
        address aavePool = vm.envAddress("AAVE_POOL_ADDRESS");
        address aToken = vm.envAddress("ATOKEN_ADDRESS");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. 部署 AaveVault implementation
        AaveVault impl = new AaveVault(aavePool, usdt, aToken);
        console.log("AaveVault impl:", address(impl));

        // 2. 部署 ERC1967 proxy
        bytes memory initData = abi.encodeCall(AaveVault.initialize, (deployer));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        console.log("AaveVault proxy:", address(proxy));

        // 3. 授权 Diamond 合约调用 deposit/withdraw
        AaveVault(address(proxy)).setAuthorized(DIAMOND, true);
        console.log("Diamond authorized on AaveVault");

        vm.stopBroadcast();
    }
}
