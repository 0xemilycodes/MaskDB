import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div>
          <p className="eyebrow">MaskDB</p>
          <h1 className="hero-title">Encrypted data vault</h1>
          <p className="hero-subtitle">
            Store a record with a random six-digit code A. Both values stay encrypted on-chain until you decrypt them
            with your wallet.
          </p>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
