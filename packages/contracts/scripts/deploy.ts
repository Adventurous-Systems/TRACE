import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hre = require('hardhat') as any;
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) throw new Error('No deployer account found');

  console.log('Deploying contracts with account:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'VET');

  // Deploy MaterialRegistry
  console.log('\nDeploying MaterialRegistry...');
  const MaterialRegistry = await hre.ethers.getContractFactory('MaterialRegistry');
  const registry = await MaterialRegistry.deploy(deployer.address);
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log('MaterialRegistry deployed to:', registryAddress);

  // Grant HUB_ROLE to the deployer (API wallet) for Solo dev
  const HUB_ROLE = ethers.keccak256(ethers.toUtf8Bytes('HUB_ROLE'));
  const tx = await registry.grantRole(HUB_ROLE, deployer.address);
  await tx.wait();
  console.log('HUB_ROLE granted to deployer for dev');

  const addresses = {
    MaterialRegistry: registryAddress,
    network: process.env['HARDHAT_NETWORK'] ?? 'vechain_solo',
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
  };

  const outPath = path.join(__dirname, '..', 'deployments.json');
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log('\nAddresses written to', outPath);

  console.log('\n─── Add these to your .env ───────────────────────');
  console.log(`MATERIAL_REGISTRY_ADDRESS=${registryAddress}`);
  console.log('──────────────────────────────────────────────────');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
