import { useState, useCallback, useEffect, useRef } from 'react';
import type { SimulationStep } from '../lib/types';

export function useSimulation() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [messageId, setMessageId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const simulationSteps: SimulationStep[] = [
    {
      label: 'Message Sent on Arbitrum',
      status: currentStep >= 0 ? 'complete' : 'pending',
      time: currentStep >= 0 ? '12:34:01' : null,
      description: 'Transaction confirmed on Arbitrum Sepolia',
    },
    {
      label: 'Picked Up by Relayer',
      status: currentStep >= 2 ? 'complete' : currentStep === 1 ? 'active' : 'pending',
      time: currentStep >= 2 ? '12:34:03' : null,
      description: 'Relayer 0x742d...44e processing message',
    },
    {
      label: 'Submitted to Destination',
      status: currentStep >= 3 ? 'complete' : currentStep === 2 ? 'active' : 'pending',
      time: currentStep >= 3 ? '12:34:12' : null,
      description: 'Cross-chain proof submitted',
    },
    {
      label: 'Executed on Destination',
      status: currentStep >= 4 ? 'complete' : currentStep === 3 ? 'active' : 'pending',
      time: currentStep >= 4 ? '12:34:15' : null,
      description: 'Target function called successfully',
    },
    {
      label: 'Confirmation Received',
      status: currentStep >= 5 ? 'complete' : currentStep === 4 ? 'active' : 'pending',
      time: currentStep >= 5 ? '12:34:18' : null,
      description: 'Message delivery confirmed on Arbitrum',
    },
  ];

  // progress: steps run 0→5. 5 = fully done (100%).
  const progress = currentStep < 0 ? 0 : Math.min(((currentStep) / 5) * 100, 100);

  const startSimulation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    setIsSimulating(true);
    setMessageId(`#${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`);
    setCurrentStep(0);

    intervalRef.current = setInterval(() => {
      setCurrentStep(prev => {
        const next = prev + 1;
        if (next >= 5) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setIsSimulating(false);
          return 5;
        }
        return next;
      });
    }, 2400);
  }, []);

  const resetSimulation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setCurrentStep(-1);
    setIsSimulating(false);
    setMessageId(null);
  }, []);

  return {
    isSimulating,
    currentStep,
    messageId,
    simulationSteps,
    progress,
    startSimulation,
    resetSimulation,
  };
}
