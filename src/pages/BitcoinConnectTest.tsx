import { BitcoinConnectTest } from '@/components/BitcoinConnectTest';
import { AlbyConnectionHelper } from '@/components/AlbyConnectionHelper';

export function BitcoinConnectTestPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Bitcoin Connect Test</h1>
        
        <AlbyConnectionHelper />
        
        <BitcoinConnectTest />
      </div>
    </div>
  );
}