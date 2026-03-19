import React from 'react';
import { Tradition, TRADITIONS, TRADITION_LABELS } from '../services/types';

interface TraditionSwitcherProps {
  selected: Tradition;
  onChange: (tradition: Tradition) => void;
}

export function TraditionSwitcher({ selected, onChange }: TraditionSwitcherProps) {
  return (
    <div className="tradition-switcher flex items-center gap-1 border-2 border-black rounded bg-gray-50 px-1">
      <label htmlFor="tradition-select" className="sr-only">Scripture Tradition</label>
      <select
        id="tradition-select"
        value={selected}
        onChange={(e) => onChange(e.target.value as Tradition)}
        className="px-2 py-2 font-bold focus:bg-yellow-100 bg-transparent outline-none text-sm"
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
