import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("maskdb:address", "Prints the MaskDB address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const maskdb = await deployments.get("MaskDB");

  console.log("MaskDB address is " + maskdb.address);
});

task("maskdb:create", "Creates a new encrypted entry")
  .addParam("name", "Record label")
  .addParam("value", "Numeric payload to encrypt (uint128)")
  .addOptionalParam("code", "Optional 6-digit access code (default: random)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const target = await deployments.get("MaskDB");
    const signers = await ethers.getSigners();
    const signer = signers[0];

    const clearValue = BigInt(taskArguments.value);
    const clearCode = taskArguments.code ? BigInt(taskArguments.code) : BigInt(100000 + Math.floor(Math.random() * 900000));

    const encryptedInput = await fhevm
      .createEncryptedInput(target.address, signer.address)
      .add128(clearValue)
      .add32(Number(clearCode))
      .encrypt();

    const maskdb = await ethers.getContractAt("MaskDB", target.address);
    console.log(
      `Creating entry "${taskArguments.name}" with value=${clearValue} code=${clearCode} handles=${encryptedInput.handles}`,
    );

    const tx = await maskdb
      .connect(signer)
      .createEntry(taskArguments.name, encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
    await tx.wait();

    console.log(`Transaction ${tx.hash} confirmed`);
  });

task("maskdb:decrypt", "Decrypts an entry's payload and code")
  .addParam("entry", "Entry id to decrypt")
  .addOptionalParam("address", "Override MaskDB contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const target = taskArguments.address ? { address: taskArguments.address } : await deployments.get("MaskDB");
    const maskdb = await ethers.getContractAt("MaskDB", target.address);
    const signers = await ethers.getSigners();
    const signer = signers[0];

    const entryId = parseInt(taskArguments.entry);
    const entry = await maskdb.getEntry(entryId);

    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint128,
      entry[1],
      target.address,
      signer,
    );
    const decryptedCode = await fhevm.userDecryptEuint(FhevmType.euint32, entry[2], target.address, signer);

    console.log(`Entry ${entryId}: name=${entry[0]} owner=${entry[3]}`);
    console.log(`  decrypted value: ${decryptedValue.toString()}`);
    console.log(`  decrypted code : ${decryptedCode.toString()}`);
  });
