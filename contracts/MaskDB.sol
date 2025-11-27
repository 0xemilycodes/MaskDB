// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint128, externalEuint32, externalEuint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title MaskDB - Store encrypted records with an access code
/// @notice Keeps a list of encrypted records per user. Each record stores a label, an encrypted payload, and an encrypted 6-digit access code.
contract MaskDB is ZamaEthereumConfig {
    struct DataEntry {
        string name;
        euint128 encryptedValue;
        euint32 accessCode;
        address owner;
        uint256 createdAt;
    }

    uint256 private _entryCount;
    mapping(uint256 => DataEntry) private _entries;
    mapping(address => uint256[]) private _entriesByOwner;

    event EntryCreated(uint256 indexed entryId, address indexed owner, string name);
    event ViewerAuthorized(uint256 indexed entryId, address indexed viewer);

    error EntryNotFound(uint256 entryId);
    error NotEntryOwner(uint256 entryId, address caller);
    error InvalidViewer();

    modifier onlyEntryOwner(uint256 entryId) {
        if (_entries[entryId].owner == address(0)) {
            revert EntryNotFound(entryId);
        }
        if (_entries[entryId].owner != msg.sender) {
            revert NotEntryOwner(entryId, msg.sender);
        }
        _;
    }

    /// @notice Creates a new encrypted record for the caller.
    /// @param name A label for the record.
    /// @param encryptedValueInput Encrypted payload provided by the frontend.
    /// @param encryptedCodeInput Encrypted 6-digit access code provided by the frontend.
    /// @param inputProof Zama relayer proof for the encrypted inputs.
    function createEntry(
        string calldata name,
        externalEuint128 encryptedValueInput,
        externalEuint32 encryptedCodeInput,
        bytes calldata inputProof
    ) external returns (uint256 entryId) {
        euint128 encryptedValue = FHE.fromExternal(encryptedValueInput, inputProof);
        euint32 encryptedCode = FHE.fromExternal(encryptedCodeInput, inputProof);

        entryId = ++_entryCount;
        _entries[entryId] = DataEntry({
            name: name,
            encryptedValue: encryptedValue,
            accessCode: encryptedCode,
            owner: msg.sender,
            createdAt: block.timestamp
        });
        _entriesByOwner[msg.sender].push(entryId);

        FHE.allowThis(encryptedValue);
        FHE.allow(encryptedValue, msg.sender);

        FHE.allowThis(encryptedCode);
        FHE.allow(encryptedCode, msg.sender);

        emit EntryCreated(entryId, msg.sender, name);
    }

    /// @notice Grants another address permission to decrypt a record.
    /// @param entryId The record identifier.
    /// @param viewer The address that should be allowed to decrypt the encrypted payload and access code.
    function authorizeViewer(uint256 entryId, address viewer) external onlyEntryOwner(entryId) {
        if (viewer == address(0)) {
            revert InvalidViewer();
        }
        DataEntry storage entry = _entries[entryId];

        FHE.allow(entry.encryptedValue, viewer);
        FHE.allow(entry.accessCode, viewer);

        emit ViewerAuthorized(entryId, viewer);
    }

    /// @notice Returns a stored record.
    /// @dev This function never uses msg.sender to comply with audit requirements.
    function getEntry(
        uint256 entryId
    ) external view returns (string memory, euint128, euint32, address, uint256) {
        DataEntry storage entry = _entries[entryId];
        if (entry.owner == address(0)) {
            revert EntryNotFound(entryId);
        }
        return (entry.name, entry.encryptedValue, entry.accessCode, entry.owner, entry.createdAt);
    }

    /// @notice Lists all record ids created by an owner.
    /// @dev View functions do not rely on msg.sender; an explicit owner is required.
    function listEntries(address owner) external view returns (uint256[] memory) {
        return _entriesByOwner[owner];
    }

    /// @notice Returns the total number of stored records.
    function getEntryCount() external view returns (uint256) {
        return _entryCount;
    }
}
