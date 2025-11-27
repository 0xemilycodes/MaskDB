# MaskDB

MaskDB is an encrypted on-chain data vault built with Zama FHEVM. Each record combines a user-provided label, an encrypted numeric payload, and a randomly generated six-digit access code **A** that never leaves the browser unencrypted. Everything is encrypted client-side with Zama’s relayer SDK before it touches the blockchain, and authorized wallets can decrypt on demand.

## Highlights
- **End-to-end privacy:** Payloads and the access code A are encrypted in the browser using the Zama relayer SDK and stored as `euint128` and `euint32` handles on-chain.
- **Deterministic access control:** Owners can authorize additional viewers per entry on-chain; view functions never rely on `msg.sender` and require explicit parameters.
- **Wallet-driven UX:** RainbowKit + wagmi for connection, ethers for writes, viem for reads, and no browser storage for secrets.
- **Ready for Sepolia:** Current deployed address lives in `deployments/sepolia/MaskDB.json` and is mirrored in `app/src/config/contracts.ts`.
- **FHE-first stack:** Uses `@fhevm/solidity` and `@zama-fhe/relayer-sdk` to keep computation private while preserving on-chain verifiability.

## What MaskDB Solves
- Stores sensitive numeric data on-chain without exposing it to RPCs, mempools, or indexers.
- Couples every record with a user-generated six-digit code A to gate recovery and sharing.
- Enables selective sharing: owners can grant decryption rights to other addresses without re-uploading data.
- Provides auditability without leakage: metadata (owner, timestamps, ids) is public while contents remain confidential.

## Tech Stack
- **Smart contracts:** Solidity 0.8.27, `@fhevm/solidity`, Hardhat + hardhat-deploy, TypeChain, Chai.
- **Frontend:** React 19 + Vite, RainbowKit + wagmi, viem (reads), ethers (writes), `@zama-fhe/relayer-sdk`.
- **Tooling:** ESLint/Prettier, Solidity coverage, hardhat-gas-reporter.

## Architecture at a Glance
- `contracts/MaskDB.sol`: Core vault storing encrypted payloads and code A; supports creation, viewer authorization, listing, and retrieval.
- `deploy/deploy.ts`: Hardhat-deploy script to publish MaskDB locally or on Sepolia.
- `tasks/MaskDB.ts`: CLI helpers to create and decrypt entries via Hardhat + FHEVM CLI API.
- `test/MaskDB.ts`: Contract tests (run on the local FHEVM mock; skipped on Sepolia).
- `deployments/sepolia/MaskDB.json`: Canonical ABI and deployed address (currently `0xD9D229fa1b3975F75995812712c3f078E7aa48e0`).
- `app/`: React frontend (`DataEntryForm`, `DataRecords`, `Header`) that drives encryption, storage, and decryption.
- `docs/zama_llm.md`, `docs/zama_doc_relayer.md`: Notes on the Zama LLM/relayer setup used by the app.

## Data Lifecycle
1. **Create entry:** The frontend generates a random six-digit code A, encrypts both the numeric payload and A with the Zama relayer SDK, and calls `createEntry` via ethers.
2. **Store:** The contract stores the encrypted handles, tracks the owner and timestamp, and authorizes the contract and owner to decrypt.
3. **Authorize sharing:** Owners can call `authorizeViewer(entryId, viewer)` to extend decryption rights to another address.
4. **Read & decrypt:** The frontend lists entry ids with viem, pulls encrypted handles via `getEntry`, and performs `userDecrypt` with an EIP-712 signature to reveal the payload and code A inside the wallet session.

## Getting Started
### Prerequisites
- Node.js 20+
- npm
- Wallet with Sepolia ETH if deploying to testnet

### Install dependencies
```bash
npm install
cd app && npm install
```

### Environment (root Hardhat)
Create a `.env` in the repository root:
```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY   # required; use a single key, not a mnemonic
INFURA_API_KEY=your_infura_key   # required for Sepolia RPC
ETHERSCAN_API_KEY=optional       # only if you plan to verify
REPORT_GAS=true                  # optional
```

### Local development
- Compile: `npx hardhat compile`
- Test (local FHE mock): `npx hardhat test`
- Run local node: `npx hardhat node` (or `npm run chain`)
- Deploy locally: `npx hardhat deploy --network localhost`
- Create an entry via task:  
  `npx hardhat maskdb:create --name "Example" --value 42 --code 123456 --network localhost`
- Decrypt via task:  
  `npx hardhat maskdb:decrypt --entry 1 --network localhost`

### Deploy to Sepolia
```bash
npx hardhat deploy --network sepolia
# optional verification after deployment
npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
```
After deployment, copy the address and ABI from `deployments/sepolia/MaskDB.json` into `app/src/config/contracts.ts` (the frontend never reads env vars).

## Frontend Usage (`app/`)
- Update `app/src/config/contracts.ts` if you redeploy.
- Start dev server on Sepolia: `npm run dev -- --host`
- Build for production: `npm run build` then `npm run preview`
- Flow: connect wallet with RainbowKit, create a record (name + numeric payload), receive a regenerated code A, submit; switch to “My records” to list and decrypt using Zama relayer (no localstorage, Sepolia-only).

## Testing and Quality
- Contract tests: `npx hardhat test` (skips when not on the local mock FHE chain).
- Coverage: `npm run coverage`
- Linting/format: `npm run lint` and `npm run prettier:check`

## Future Roadmap
- Support additional encrypted types (arrays, mixed precision) and richer metadata.
- Viewer management UI (revoke, history, per-entry visibility) and notifications when sharing.
- Batch creation/decryption to reduce gas and round-trips.
- Multi-chain readiness once Zama coprocessors are available on more networks.
- Formal security review, monitoring hooks, and better error surfacing in the frontend.

## Resources
- Contract ABI/address: `deployments/sepolia/MaskDB.json`
- Zama relayer notes: `docs/zama_doc_relayer.md`
- Zama FHE guide: `docs/zama_llm.md`
- License: BSD-3-Clause-Clear (`LICENSE`)
