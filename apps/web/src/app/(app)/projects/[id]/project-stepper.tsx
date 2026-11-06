'use client';

import { CheckIcon } from 'lucide-react';
import { cn } from 'cn';
import type { ProjectStep, StepStatus } from '@/components/project-steps';

const STATUS_LABELS: Record<StepStatus, string> = {
  done: 'done',
  todo: 'to do',
  warning: 'needs attention',
  optional: 'optional',
};

/**
 * Numbered steps across the top of the project page. Every step can be
 * opened directly; the marker shows its status.
 */
export function ProjectStepper({ steps, current, onSelect }: { steps: ProjectStep[]; current: number; onSelect: (index: number) => void }) {
  return (
    <nav aria-label="Book steps">
      <ol className="flex items-start">
        {steps.map((step, i) => {
          const active = i === current;
          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center">
              {/* Line to the next step, behind the markers */}
              {i < steps.length - 1 && (
                <span aria-hidden className={cn('absolute top-4 left-1/2 h-0.5 w-full', step.status === 'done' ? 'bg-primary' : 'bg-border')} />
              )}
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${step.title} (${STATUS_LABELS[step.status]})`}
                className="group relative z-10 flex flex-col items-center gap-1.5 rounded-md px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full border-2 bg-background text-sm font-semibold transition-colors',
                    step.status === 'done' && 'border-primary bg-primary text-primary-foreground',
                    step.status === 'warning' && 'border-amber-500 text-amber-600 dark:text-amber-400',
                    (step.status === 'todo' || step.status === 'optional') && 'border-border text-muted-foreground',
                    active && 'ring-4 ring-primary/20',
                    active && step.status !== 'done' && step.status !== 'warning' && 'border-primary text-primary',
                    'group-hover:border-primary'
                  )}
                >
                  {step.status === 'done' ? <CheckIcon className="size-4" /> : step.status === 'warning' ? '!' : i + 1}
                </span>
                {/* Labels for every step on wide screens; only the current one on phones */}
                <span className={cn('text-center text-xs leading-tight sm:text-sm', active ? 'font-medium text-foreground' : 'hidden text-muted-foreground sm:block')}>
                  {step.title}
                  {step.hint && (
                    <span className={cn('block text-xs', step.status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                      {step.hint}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs text-muted-foreground sm:hidden">
        Step {current + 1} of {steps.length}
      </p>
    </nav>
  );
}
