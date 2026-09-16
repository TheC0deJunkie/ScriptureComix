import React from 'react';
import { Tradition, TRADITIONS, TRADITION_LABELS } from '../services/types';

interface TraditionSwitcherProps {
  selected: Tradition;
  onChange: (tradition: Tradition) => void;
  /** No box of its own — for use inside the header's "book sentence". */
  bare?: boolean;
}

export function TraditionSwitcher({ selected, onChange, bare = false }: TraditionSwitcherProps) {
  return (
    <div className={`tradition-switcher flex items-center gap-1 ${bare ? '' : 'border-2 border-black rounded bg-gray-50 px-1'}`}>
      <label htmlFor="tradition-select" className="sr-only">Scripture Tradition</label>
      <select
        id="tradition-select"
        value={selected}
        onChange={(e) => onChange(e.target.value as Tradition)}
        className={`font-bold bg-transparent outline-none text-sm cursor-pointer ${bare ? 'px-1 py-1.5 rounded hover:bg-yellow-100 w-[7.5rem]' : 'px-2 py-2 focus:bg-yellow-100'}`}
      >
        {TRADITIONS.map((t) => (
          <option key={t} value={t}>
            {TRADITION_LABELS[t]}
          </option>
        ))}
      </select>
    </div>
  );
}
