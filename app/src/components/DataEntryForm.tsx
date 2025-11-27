import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAccount } from 'wagmi';
import { Contract } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/DataForm.css';

type Props = {
  onCreated?: () => void;
};

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function DataEntryForm({ onCreated }: Props) {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [code, setCode] = useState<string>(() => generateCode());
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  const parsedValue = useMemo(() => {
    if (!value.trim()) return null;
    if (!/^[0-9]+$/.test(value.trim())) return null;
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }, [value]);

  const parsedCode = useMemo(() => {
    if (!/^[0-9]{6}$/.test(code)) return null;
    return Number(code);
  }, [code]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('');
    setTxHash('');

    if (!address) {
      setStatus('Please connect your wallet first.');
      return;
    }
    if (!instance || zamaLoading) {
      setStatus('Encryption service is still loading.');
      return;
    }
    if (!parsedValue || parsedValue <= 0) {
      setStatus('Provide a numeric payload greater than 0.');
      return;
    }
    if (parsedCode === null) {
      setStatus('Access code must be six digits.');
      return;
    }

    setSubmitting(true);
    try {
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.add128(parsedValue);
      input.add32(parsedCode);
      const encryptedInput = await input.encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer unavailable');
      }
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.createEntry(
        name.trim(),
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      setStatus('Waiting for confirmation...');
      const receipt = await tx.wait();
      setTxHash(receipt?.hash ?? tx.hash);
      setStatus('Record created successfully.');

      setName('');
      setValue('');
      setCode(generateCode());

      onCreated?.();
    } catch (err) {
      console.error('Failed to create entry', err);
      setStatus(err instanceof Error ? err.message : 'Failed to create entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Create</p>
          <h2 className="card-title">Store encrypted data</h2>
          <p className="card-subtitle">
            A six-digit access code is generated locally. Both the payload and code are encrypted with Zama before being
            sent on-chain.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <label className="form-field">
          <span className="form-label">Record name</span>
          <input
            className="form-input"
            placeholder="e.g. Medical notes"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Numeric payload</span>
          <input
            className="form-input"
            placeholder="Any positive integer"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            min={0}
          />
          <span className="helper">The number is converted to an encrypted uint128 before storing.</span>
        </label>

        <div className="code-row">
          <div className="code-box">
            <span className="form-label">Access code A</span>
            <div className="code-display">{code}</div>
            <span className="helper">Keep this code safe. It is encrypted and stored with your data.</span>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setCode(generateCode())}
            disabled={submitting}
          >
            Regenerate
          </button>
        </div>

        <div className="actions">
          <button className="primary-button" type="submit" disabled={submitting || zamaLoading}>
            {zamaLoading ? 'Initializing encryption...' : submitting ? 'Encrypting & sending...' : 'Create encrypted record'}
          </button>
          {status && <p className="status-text">{status}</p>}
          {txHash && (
            <p className="status-text">
              Tx: <span className="mono">{txHash}</span>
            </p>
          )}
          {zamaError && <p className="status-text error">Encryption init error: {zamaError}</p>}
        </div>
      </form>
    </section>
  );
}
