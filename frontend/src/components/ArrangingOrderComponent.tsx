'use client';

import React, { useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

interface Props {
  orderId: string;
  orderStatus?: string;
  arrangingStage?: 'ARRANGING' | 'ARRANGED' | 'SENT_FOR_PACKAGING' | null;
  onNextStageChange?: (stageInfo: { key: 'ARRANGING' | 'ARRANGED' | 'SENT_FOR_PACKAGING' | null; label: string | null }) => void;
}

export default function ArrangingOrderComponent({ orderId, orderStatus, arrangingStage, onNextStageChange }: Props) {
  const { user } = useAuth();
  const role = (user as any)?.role || '';

  const packagingStatuses = ['UNDER_PACKAGING', 'PACKAGING_COMPLETED', 'IN_TRANSIT'];

  if (orderStatus && packagingStatuses.includes(orderStatus)) {
    return null;
  }

  // quick role guard: only show arranging controls to ADMIN / MANAGER
  if (!['ADMIN', 'MANAGER'].includes(role)) {
    return (
      <div className="rounded-md border border-gray-200 p-3 bg-gray-50 text-sm text-gray-600">
        Arranging controls are available to Managers and Admins only.
      </div>
    );
  }


  const stageSteps = useMemo(
    () => [
      { key: 'ARRANGING' as const, label: 'Arranging Items', subtitle: 'Collect items and prepare', stageValue: 'ARRANGING' },
      { key: 'ARRANGED' as const, label: 'Arranged', subtitle: 'Items collected and checked', stageValue: 'ARRANGED' },
      { key: 'SENT_FOR_PACKAGING' as const, label: 'Sent for Packaging', subtitle: 'Send to packager', stageValue: 'SENT_FOR_PACKAGING' }
    ],
    []
  );

  const currentStageIndex = (() => {
    if (arrangingStage === 'ARRANGING') return 0;
    if (arrangingStage === 'ARRANGED') return 1;
    if (arrangingStage === 'SENT_FOR_PACKAGING') return 2;
    return -1;
  })();

  const nextStep = stageSteps[currentStageIndex + 1] || null;

  useEffect(() => {
    if (onNextStageChange) {
      onNextStageChange(nextStep ? { key: nextStep.key as any, label: nextStep.label } : { key: null, label: null });
    }
    // Only trigger when the actual next step key changes to avoid re-render loops
  }, [nextStep?.key]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-700">Arranging Progress</div>
          <div className="text-sm font-semibold text-gray-600">{arrangingStage ? arrangingStage.replaceAll('_', ' ') : 'Not Started'}</div>
        </div>
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
          Order ID: {orderId}
        </span>
      </div>

      {nextStep ? (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-white text-sm font-semibold">
              {currentStageIndex + 2}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{nextStep.label}</p>
              <p className="text-xs text-gray-600">{nextStep.subtitle}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Update this stage when the task is completed to move the order forward.</p>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          All arranging stages are completed.
        </div>
      )}
    </div>
  );
}
