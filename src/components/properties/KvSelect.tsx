import { Check, ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { KeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';

export interface KvSelectOption {
  value: string;
  label: string;
}

interface KvSelectProps {
  label: string;
  value: string;
  options: KvSelectOption[];
  icon?: ReactNode;
  compact?: boolean;
  menuPlacement?: 'top' | 'bottom';
  menuAlign?: 'start' | 'end';
  onChange: (value: string) => void;
}

export const KvSelect = ({
  label,
  value,
  options,
  icon,
  compact = false,
  menuPlacement = 'top',
  menuAlign = 'start',
  onChange,
}: KvSelectProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const reduceMotion = useReducedMotion();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedLabel = options[selectedIndex]?.label ?? options[0]?.label ?? label;

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    return () => document.removeEventListener('pointerdown', closeFromOutside);
  }, []);

  const openAndFocus = (index: number) => {
    setOpen(true);
    requestAnimationFrame(() => optionRefs.current[index]?.focus());
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openAndFocus(event.key === 'ArrowDown' ? selectedIndex : Math.max(0, options.length - 1));
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (index + direction + options.length) % options.length;
      optionRefs.current[nextIndex]?.focus();
    }
  };

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className={`flex w-full items-center gap-3 border bg-[#222225]/95 px-4 text-left text-sm text-white outline-none transition ${compact ? 'min-h-12 rounded-[var(--radius-control)]' : 'min-h-14 rounded-[16px] md:text-base'} ${open ? 'border-[#d7b661] shadow-[0_0_0_3px_rgba(215,182,97,.1)]' : 'border-white/10 hover:border-white/20 focus-visible:border-[#d7b661]/75'}`}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/45 transition-transform ${open ? 'rotate-180 text-[#d7b661]' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <motion.div
          id={listboxId}
          role="listbox"
          aria-label={label}
          initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute z-50 min-w-full overflow-hidden rounded-[16px] border border-[#d7b661]/30 bg-[#1c1c1f]/98 p-1.5 shadow-2xl shadow-black/55 backdrop-blur-xl ${menuPlacement === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'} ${menuAlign === 'end' ? 'right-0' : 'left-0'} ${compact ? 'w-max max-w-[260px]' : 'right-0'}`}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value || 'all'}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[11px] px-3.5 py-2.5 text-left text-sm font-medium transition ${selected ? 'bg-[#d7b661] text-[#171719]' : 'text-white/75 hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/[0.07] focus-visible:text-white focus-visible:outline-none'}`}
              >
                <span>{option.label}</span>
                {selected && <Check className="h-4 w-4" aria-hidden="true" />}
              </button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};
