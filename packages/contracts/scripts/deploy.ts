import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'VET');

  // Deploy MaterialRegistry
  console.log('\nDeploying MaterialRegistry...');
  const MaterialRegistry = await ethers.getContractFactory('MaterialRegistry');
  const registry = await MaterialRegistry.deploy(deployer.address);
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log('MaterialRegistry deployed to:', registryAddress);

  // Grant HUB_ROLE to the deployer (API wallet) for Solo dev
  const HUB_ROLE = ethers.keccak256(ethers.toUtf8Bytes('HUB_ROLE'));
  const tx = await registry.grantRole(HUB_ROLE, deployer.address);
  await tx.wait();
  console.log('HUB_ROLE granted to deployer for dev');

  // Write addresses to a JSON file for the API to read
  const addresses = {
    MaterialRegistry: registryAddress,
    network: process.env.HARDHAT_NETWORK ?? 'vechain_solo',
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
  };

  const outPath = path.join(__dirname, '..', 'deployments.json');
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log('\nAddresses written to', outPath);

  // Print env vars to paste into .env
  console.log('\n─── Add these to your .env ───────────────────────');
  console.log(`MATERIAL_REGISTRY_ADDRESS=${registryAddress}`);
  console.log('──────────────────────────────────────────────────');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
