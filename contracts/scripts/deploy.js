const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // ─────────────────────── BSC Mainnet Addresses ──────────────────────────
  const AAVE_POOL = "0x6807dc923806fE8Fd134338EABCA509979a7e0cB";
  const USDT = "0x55d398326f99059fF775485246999027B3197955";
  const AUSDT = "0xa9251ca9DE909CB71783723713B21E4233fbf1B1"; // aUSDT on BSC
  const PANCAKE_ROUTER = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";
  const MM_TOKEN = "0x0000000000000000000000000000000000000001"; // placeholder - update before mainnet

  console.log("\n=== Step 1: Deploy AdminControl ===");
  const AdminControl = await ethers.getContractFactory("AdminControl");
  const adminControl = await AdminControl.deploy();
  await adminControl.waitForDeployment();
  const adminControlAddr = await adminControl.getAddress();
  console.log("AdminControl deployed to:", adminControlAddr);

  console.log("\n=== Step 2: Deploy MemberRegistry ===");
  const MemberRegistry = await ethers.getContractFactory("MemberRegistry");
  const memberRegistry = await MemberRegistry.deploy();
  await memberRegistry.waitForDeployment();
  const memberRegistryAddr = await memberRegistry.getAddress();
  console.log("MemberRegistry deployed to:", memberRegistryAddr);

  console.log("\n=== Step 3: Deploy AaveVault ===");
  const AaveVault = await ethers.getContractFactory("AaveVault");
  const aaveVault = await AaveVault.deploy(AAVE_POOL, USDT, AUSDT);
  await aaveVault.waitForDeployment();
  const aaveVaultAddr = await aaveVault.getAddress();
  console.log("AaveVault deployed to:", aaveVaultAddr);

  console.log("\n=== Step 4: Deploy MMTokenLocker ===");
  const MMTokenLocker = await ethers.getContractFactory("MMTokenLocker");
  const mmTokenLocker = await MMTokenLocker.deploy(MM_TOKEN);
  await mmTokenLocker.waitForDeployment();
  const mmTokenLockerAddr = await mmTokenLocker.getAddress();
  console.log("MMTokenLocker deployed to:", mmTokenLockerAddr);

  console.log("\n=== Step 5: Deploy PancakeSwapper ===");
  const PancakeSwapper = await ethers.getContractFactory("PancakeSwapper");
  const pancakeSwapper = await PancakeSwapper.deploy(
    PANCAKE_ROUTER,
    USDT,
    MM_TOKEN,
    mmTokenLockerAddr
  );
  await pancakeSwapper.waitForDeployment();
  const pancakeSwapperAddr = await pancakeSwapper.getAddress();
  console.log("PancakeSwapper deployed to:", pancakeSwapperAddr);

  console.log("\n=== Step 6: Deploy DynamicBonus ===");
  const DynamicBonus = await ethers.getContractFactory("DynamicBonus");
  const dynamicBonus = await DynamicBonus.deploy(memberRegistryAddr, adminControlAddr);
  await dynamicBonus.waitForDeployment();
  const dynamicBonusAddr = await dynamicBonus.getAddress();
  console.log("DynamicBonus deployed to:", dynamicBonusAddr);

  console.log("\n=== Step 7: Deploy LevelDifferential ===");
  const LevelDifferential = await ethers.getContractFactory("LevelDifferential");
  const levelDifferential = await LevelDifferential.deploy(memberRegistryAddr, adminControlAddr);
  await levelDifferential.waitForDeployment();
  const levelDifferentialAddr = await levelDifferential.getAddress();
  console.log("LevelDifferential deployed to:", levelDifferentialAddr);

  console.log("\n=== Step 8: Deploy InvestmentManager ===");
  const InvestmentManager = await ethers.getContractFactory("InvestmentManager");
  const investmentManager = await InvestmentManager.deploy(
    memberRegistryAddr,
    adminControlAddr,
    aaveVaultAddr,
    pancakeSwapperAddr,
    mmTokenLockerAddr,
    dynamicBonusAddr,
    levelDifferentialAddr,
    USDT
  );
  await investmentManager.waitForDeployment();
  const investmentManagerAddr = await investmentManager.getAddress();
  console.log("InvestmentManager deployed to:", investmentManagerAddr);

  console.log("\n=== Step 9: Deploy WithdrawalManager ===");
  const WithdrawalManager = await ethers.getContractFactory("WithdrawalManager");
  const withdrawalManager = await WithdrawalManager.deploy(
    memberRegistryAddr,
    adminControlAddr,
    aaveVaultAddr,
    USDT,
    deployer.address // fee collector = deployer initially
  );
  await withdrawalManager.waitForDeployment();
  const withdrawalManagerAddr = await withdrawalManager.getAddress();
  console.log("WithdrawalManager deployed to:", withdrawalManagerAddr);

  console.log("\n=== Step 10: Deploy RestartManager ===");
  const RestartManager = await ethers.getContractFactory("RestartManager");
  const restartManager = await RestartManager.deploy(
    memberRegistryAddr,
    adminControlAddr,
    MM_TOKEN
  );
  await restartManager.waitForDeployment();
  const restartManagerAddr = await restartManager.getAddress();
  console.log("RestartManager deployed to:", restartManagerAddr);

  console.log("\n=== Step 11: Deploy MemproRouter ===");
  const MemproRouter = await ethers.getContractFactory("MemproRouter");
  const memproRouter = await MemproRouter.deploy(
    memberRegistryAddr,
    adminControlAddr,
    investmentManagerAddr,
    withdrawalManagerAddr,
    restartManagerAddr,
    mmTokenLockerAddr,
    aaveVaultAddr,
    pancakeSwapperAddr,
    dynamicBonusAddr,
    levelDifferentialAddr
  );
  await memproRouter.waitForDeployment();
  const memproRouterAddr = await memproRouter.getAddress();
  console.log("MemproRouter deployed to:", memproRouterAddr);

  // ═══════════════════ Wire up cross-contract references ═════════════════

  console.log("\n=== Step 12: Setting up authorizations ===");

  // MemberRegistry: authorize all writing contracts
  console.log("Authorizing contracts on MemberRegistry...");
  await memberRegistry.setAuthorized(investmentManagerAddr, true);
  await memberRegistry.setAuthorized(withdrawalManagerAddr, true);
  await memberRegistry.setAuthorized(restartManagerAddr, true);
  await memberRegistry.setAuthorized(dynamicBonusAddr, true);
  await memberRegistry.setAuthorized(levelDifferentialAddr, true);
  await memberRegistry.setAuthorized(memproRouterAddr, true);

  // AaveVault: authorize InvestmentManager and WithdrawalManager
  console.log("Authorizing contracts on AaveVault...");
  await aaveVault.setAuthorized(investmentManagerAddr, true);
  await aaveVault.setAuthorized(withdrawalManagerAddr, true);

  // PancakeSwapper: authorize InvestmentManager
  console.log("Authorizing contracts on PancakeSwapper...");
  await pancakeSwapper.setAuthorized(investmentManagerAddr, true);

  // MMTokenLocker: authorize PancakeSwapper and InvestmentManager
  console.log("Authorizing contracts on MMTokenLocker...");
  await mmTokenLocker.setAuthorized(pancakeSwapperAddr, true);
  await mmTokenLocker.setAuthorized(investmentManagerAddr, true);

  // DynamicBonus: authorize InvestmentManager
  console.log("Authorizing contracts on DynamicBonus...");
  await dynamicBonus.setAuthorized(investmentManagerAddr, true);

  // LevelDifferential: authorize InvestmentManager
  console.log("Authorizing contracts on LevelDifferential...");
  await levelDifferential.setAuthorized(investmentManagerAddr, true);

  // RestartManager: authorize InvestmentManager (for referral compensation)
  console.log("Authorizing contracts on RestartManager...");
  await restartManager.setAuthorized(investmentManagerAddr, true);

  // Set MM token address in AdminControl
  if (MM_TOKEN !== "0x0000000000000000000000000000000000000001") {
    await adminControl.setMMToken(MM_TOKEN);
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("════════════════════════════════════════════════════════");
  console.log("AdminControl:       ", adminControlAddr);
  console.log("MemberRegistry:     ", memberRegistryAddr);
  console.log("AaveVault:          ", aaveVaultAddr);
  console.log("MMTokenLocker:      ", mmTokenLockerAddr);
  console.log("PancakeSwapper:     ", pancakeSwapperAddr);
  console.log("DynamicBonus:       ", dynamicBonusAddr);
  console.log("LevelDifferential:  ", levelDifferentialAddr);
  console.log("InvestmentManager:  ", investmentManagerAddr);
  console.log("WithdrawalManager:  ", withdrawalManagerAddr);
  console.log("RestartManager:     ", restartManagerAddr);
  console.log("MemproRouter:       ", memproRouterAddr);
  console.log("════════════════════════════════════════════════════════");
  console.log("\nNOTE: Update MM_TOKEN address before mainnet deployment!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
