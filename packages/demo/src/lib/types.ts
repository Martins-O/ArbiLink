export type ChainName = 'ethereum' | 'base' | 'polygon' | 'optimism';

export type MessageStatus = 'pending' | 'relayed' | 'confirmed' | 'failed';

export interface Demo {
  id: string;
  icon: string;
  name: string;
  description: string;
  gradient: string;
}

export interface Chain {
  id: ChainName;
  name: string;
  icon: string;
  color: string;
}

export interface SimulationStep {
  label: string;
  status: 'complete' | 'active' | 'pending';
  time: string | null;
  description: string;
}

export interface MessageDetails {
  id: string;
  sender: string;
  destination: ChainName;
  target: string;
  status: MessageStatus;
  relayer?: string;
}
