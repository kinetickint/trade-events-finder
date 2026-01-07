import React from 'react';
import { EPCCategory } from '../types';

interface EPCSelectorProps {
  selectedEPC: EPCCategory;
  onChange: (epc: EPCCategory) => void;
}

const EPCSelector: React.FC<EPCSelectorProps> = ({ selectedEPC, onChange }) => {
  return (
    <div className="w-full">
      <label htmlFor="epc-select" className="block text-sm font-medium text-slate-700 mb-1">
        Select Export Promotion Council (EPC)
      </label>
      <div className="relative">
        <select
          id="epc-select"
          value={selectedEPC}
          onChange={(e) => onChange(e.target.value as EPCCategory)}
          className="block w-full rounded-lg border-slate-300 bg-white border px-4 py-2.5 pr-8 text-sm focus:border-blue-500 focus:ring-blue-500 shadow-sm appearance-none"
        >
          {Object.values(EPCCategory).map((epc) => (
            <option key={epc} value={epc}>
              {epc}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default EPCSelector;
