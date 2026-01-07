import React from 'react';
import { GroundingChunk } from '../types';

interface GroundingSourcesProps {
  chunks: GroundingChunk[];
  type: 'web' | 'map';
}

const GroundingSources: React.FC<GroundingSourcesProps> = ({ chunks, type }) => {
  if (!chunks || chunks.length === 0) return null;

  const validChunks = chunks.filter(c => type === 'web' ? c.web : c.maps);

  if (validChunks.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
        {type === 'web' ? 'Verified Sources' : 'Location Data'}
      </h4>
      <div className="flex flex-wrap gap-2">
        {validChunks.map((chunk, index) => {
          const data = type === 'web' ? chunk.web : chunk.maps;
          if (!data) return null;

          return (
            <a
              key={index}
              href={data.uri}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                type === 'web' 
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50' 
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/50'
              }`}
            >
              {type === 'web' ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              )}
              <span className="max-w-[150px] truncate">{data.title || "Source"}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default GroundingSources;