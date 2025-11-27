import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { MaskDB, MaskDB__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("MaskDB")) as MaskDB__factory;
  const contract = (await factory.deploy()) as MaskDB;
  const address = await contract.getAddress();

  return { contract, address };
}

describe("MaskDB", function () {
  let signers: Signers;
  let contract: MaskDB;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, address: contractAddress } = await deployFixture());
  });

  it("creates and decrypts a record", async function () {
    const clearValue = 42n;
    const clearCode = 123456;
    const recordName = "example";

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add128(clearValue)
      .add32(clearCode)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .createEntry(recordName, encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
    await tx.wait();

    const [name, encryptedValue, encryptedCode, owner, createdAt] = await contract.getEntry(1);
    expect(name).to.eq(recordName);
    expect(owner).to.eq(signers.alice.address);
    expect(createdAt).to.be.greaterThan(0);

    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint128,
      encryptedValue,
      contractAddress,
      signers.alice,
    );
    const decryptedCode = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedCode, contractAddress, signers.alice);

    expect(decryptedValue).to.eq(clearValue);
    expect(decryptedCode).to.eq(clearCode);
  });

  it("authorizes a viewer to decrypt", async function () {
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add128(55n)
      .add32(654321)
      .encrypt();

    await contract
      .connect(signers.alice)
      .createEntry("shared", encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);

    await contract.connect(signers.alice).authorizeViewer(1, signers.bob.address);

    const entry = await contract.getEntry(1);

    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint128,
      entry[1],
      contractAddress,
      signers.bob,
    );
    const decryptedCode = await fhevm.userDecryptEuint(FhevmType.euint32, entry[2], contractAddress, signers.bob);

    expect(decryptedValue).to.eq(55n);
    expect(decryptedCode).to.eq(654321);
  });

  it("lists entries for an owner", async function () {
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add128(99n)
      .add32(111111)
      .encrypt();

    await contract
      .connect(signers.alice)
      .createEntry("first", encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);

    const ids = await contract.listEntries(signers.alice.address);
    expect(ids.length).to.eq(1);
    expect(ids[0]).to.eq(1);
  });
});
