import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/DataRecords.css';

type Entry = {
  id: bigint;
  name: string;
  encryptedValue: string;
  encryptedCode: string;
  owner: string;
  createdAt: bigint;
};

type Decrypted = {
  value: string;
  code: string;
};

type Props = {
  refreshKey: number;
};

export function DataRecords({ refreshKey }: Props) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [decryptingId, setDecryptingId] = useState<bigint | null>(null);
  const [decrypted, setDecrypted] = useState<Record<string, Decrypted>>({});

  const ownsEntries = useMemo(() => entries.length > 0, [entries]);

  useEffect(() => {
    const fetchEntries = async () => {
      if (!address || !publicClient) {
        setEntries([]);
        return;
      }
      setLoading(true);
      try {
        const ids = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'listEntries',
          args: [address],
        })) as bigint[];

        const fetched = await Promise.all(
          ids.map(async (id) => {
            const result = (await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'getEntry',
              args: [id],
            })) as readonly [string, string, string, string, bigint];

            return {
              id,
              name: result[0],
              encryptedValue: result[1],
              encryptedCode: result[2],
              owner: result[3],
              createdAt: result[4],
            };
          })
        );

        setEntries(fetched);
      } catch (err) {
        console.error('Failed to fetch entries', err);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [address, publicClient, refreshKey]);

  const decryptEntry = async (entry: Entry) => {
    if (!instance || !address) {
      return;
    }
    setDecryptingId(entry.id);
    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: entry.encryptedValue,
          contractAddress: CONTRACT_ADDRESS,
        },
        {
          handle: entry.encryptedCode,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer unavailable');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const value = result[entry.encryptedValue] ?? '';
      const code = result[entry.encryptedCode] ?? '';

      setDecrypted((current) => ({
        ...current,
        [entry.id.toString()]: {
          value: value?.toString ? value.toString() : String(value),
          code: code?.toString ? code.toString() : String(code),
        },
      }));
    } catch (err) {
      console.error('Failed to decrypt entry', err);
    } finally {
      setDecryptingId(null);
    }
  };

  if (!address) {
    return (
      <section className="card">
        <h2 className="card-title">My records</h2>
        <p className="card-subtitle">Connect your wallet to view and decrypt stored records.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Records</p>
          <h2 className="card-title">Saved encrypted items</h2>
          <p className="card-subtitle">Decrypt a record to reveal both the saved payload and the access code A.</p>
        </div>
      </div>

      {loading && <p className="card-subtitle">Loading your entries...</p>}
      {!loading && !ownsEntries && <p className="card-subtitle">No records yet. Create one to get started.</p>}

      <div className="records-grid">
        {entries.map((entry) => {
          const decryptedEntry = decrypted[entry.id.toString()];
          return (
            <div key={entry.id.toString()} className="record-card">
              <div className="record-header">
                <div>
                  <p className="record-name">{entry.name}</p>
                  <p className="record-meta">ID #{entry.id.toString()}</p>
                </div>
                <div className="record-meta">
                  {new Date(Number(entry.createdAt) * 1000).toLocaleString(undefined, { hour12: false })}
                </div>
              </div>

              <div className="encrypted-info">
                <p className="muted">Encrypted payload</p>
                <code className="mono">{entry.encryptedValue.slice(0, 18)}...</code>
              </div>
              <div className="encrypted-info">
                <p className="muted">Encrypted access code</p>
                <code className="mono">{entry.encryptedCode.slice(0, 18)}...</code>
              </div>

              {decryptedEntry ? (
                <div className="decrypted-box">
                  <div>
                    <p className="muted">Decrypted value</p>
                    <p className="decrypted-value">{decryptedEntry.value}</p>
                  </div>
                  <div>
                    <p className="muted">Access code A</p>
                    <p className="decrypted-value">{decryptedEntry.code}</p>
                  </div>
                </div>
              ) : (
                <button
                  className="secondary-button"
                  onClick={() => decryptEntry(entry)}
                  disabled={decryptingId === entry.id || !instance}
                >
                  {decryptingId === entry.id
                    ? 'Decrypting...'
                    : !instance
                      ? 'Loading relayer...'
                      : 'Decrypt record'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
