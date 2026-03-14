'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlowStep {
  index: number;
  label: string;
  href: string;
  enabled: boolean;
}

interface ProjectFlowStepperProps {
  currentStep: number;
  steps: FlowStep[];
}

export function ProjectFlowStepper({ currentStep, steps }: ProjectFlowStepperProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        {steps.map((step, i) => {
          const isComplete = currentStep > step.index;
          const isCurrent = currentStep === step.index;

          return (
            <div key={step.index} className="flex items-center gap-2 min-w-max">
              {step.enabled ? (
                <Link
                  href={step.href}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50 transition-colors"
                >
                  <span
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border',
                      isCurrent
                        ? 'bg-zippy-green text-white border-zippy-green'
                        : isComplete
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                    )}
                  >
                    {isComplete ? <Check size={14} /> : step.index}
                  </span>
                  <span className={cn('text-xs font-semibold', isCurrent ? 'text-slate-900' : 'text-slate-600')}>
                    {step.label}
                  </span>
                </Link>
              ) : (
                <div className="flex items-center gap-2 rounded-lg px-2 py-1 opacity-55">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border bg-slate-100 text-slate-500 border-slate-300">
                    {step.index}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{step.label}</span>
                </div>
              )}

              {i < steps.length - 1 && (
                <span className={cn('h-1 w-8 rounded-full', currentStep > step.index ? 'bg-emerald-500' : 'bg-slate-200')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
