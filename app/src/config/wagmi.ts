import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'MaskDB',
  projectId: 'maskdb-public-demo',
  chains: [sepolia],
  ssr: false,
});
