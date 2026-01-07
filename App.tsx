import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SearchResult, AnalysisResult, MapResult, SearchStatus, EventDetail } from './types';
import { searchTradeEvents, analyzeStrategicFit, findEventLocation } from './services/geminiService';
import { generateWordDocument, generatePDFDocument } from './utils/reportGenerator';
import GroundingSources from './components/GroundingSources';

// Improved Markdown renderer for better legibility
const SimpleMarkdown = ({ text }: { text: string }) => {
  const formatText = (input: string) => {
    return input.split('\n').map((line, i) => {
      // Bold
      const bolded = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-gray-100">$1</strong>');
      // Headers
      if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-5 mb-2 text-indigo-900 dark:text-indigo-300" dangerouslySetInnerHTML={{ __html: bolded.substring(4) }} />;
      if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-8 mb-4 text-indigo-950 dark:text-indigo-200 border-b border-indigo-100 dark:border-indigo-800 pb-2" dangerouslySetInnerHTML={{ __html: bolded.substring(3) }} />;
      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-4 text-indigo-950 dark:text-indigo-100" dangerouslySetInnerHTML={{ __html: bolded.substring(2) }} />;
      // Lists
      if (line.trim().startsWith('- ')) return <li key={i} className="ml-4 list-disc mb-2 text-gray-700 dark:text-gray-300 pl-1" dangerouslySetInnerHTML={{ __html: bolded.substring(2) }} />;
      if (line.trim().match(/^\d+\. /)) return <li key={i} className="ml-4 list-decimal mb-2 text-gray-700 dark:text-gray-300 pl-1" dangerouslySetInnerHTML={{ __html: bolded.replace(/^\d+\. /, '') }} />;
      
      return <p key={i} className="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: bolded }} />;
    });
  };

  return <div className="leading-relaxed">{formatText(text)}</div>;
};

const App: React.FC = () => {
  const [productQuery, setProductQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  
  // Analysis State
  const [analysisStatus, setAnalysisStatus] = useState<SearchStatus>('idle');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [userProfile, setUserProfile] = useState("");

  // Location State
  const [mapStatus, setMapStatus] = useState<SearchStatus>('idle');
  const [mapResult, setMapResult] = useState<MapResult | null>(null);
  const [selectedEventForMap, setSelectedEventForMap] = useState<string>("");

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(false);

  // Filter State
  const [selectedType, setSelectedType] = useState<string>('All');
  const [showRawReport, setShowRawReport] = useState(false);

  const resultsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSearch = async () => {
    if (!productQuery) return; 
    
    setSearchStatus('loading');
    setSearchResult(null);
    setAnalysisResult(null); // Reset analysis on new search
    setMapResult(null);
    setSelectedType('All'); // Reset filter

    try {
      const result = await searchTradeEvents(productQuery, locationQuery);
      setSearchResult(result);
      setSearchStatus('success');
    } catch (e) {
      setSearchStatus('error');
    }
  };

  const handleAnalysis = async () => {
    if (!searchResult || !userProfile) return;
    
    setAnalysisStatus('loading');
    try {
      const result = await analyzeStrategicFit(searchResult.text, userProfile);
      setAnalysisResult(result);
      setAnalysisStatus('success');
      // Scroll to bottom after analysis
      setTimeout(() => resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setAnalysisStatus('error');
    }
  };

  const downloadWord = async () => {
    if (!searchResult) return;
    await generateWordDocument(
      productQuery,
      searchResult.text,
      searchResult.structuredEvents || [],
      analysisResult?.text || "Strategy Analysis not generated."
    );
  };

  const downloadPDF = async () => {
    if (!searchResult) return;
    await generatePDFDocument(
      productQuery,
      searchResult.text,
      searchResult.structuredEvents || [],
      analysisResult?.text || "Strategy Analysis not generated."
    );
  };

  const handleMapSearch = async (eventName: string) => {
    setSelectedEventForMap(eventName);
    setMapStatus('loading');
    setMapResult(null);

    // Get current location for better grounding if possible
    let lat: number | undefined;
    let lng: number | undefined;

    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (e) {
        console.warn("Geolocation permission denied or timeout");
      }
    }

    try {
      const result = await findEventLocation(eventName, lat, lng);
      setMapResult(result);
      setMapStatus('success');
    } catch (e) {
      setMapStatus('error');
    }
  };

  // Helper to extract event names for the "Locate" button in raw text mode
  const extractLikelyEventNames = (text: string): string[] => {
    const lines = text.split('\n');
    const potentialEvents: string[] = [];
    lines.forEach(line => {
      // Look for lines that look like list items and bolded titles
      const match = line.match(/^[\d-]+\.\s\*\*(.*?)\*\*/); 
      if (match && match[1]) {
        potentialEvents.push(match[1]);
      }
    });
    return potentialEvents;
  };

  // Extract EPC from text for display
  const relevantEPC = useMemo(() => {
    if (!searchResult) return null;
    const match = searchResult.text.match(/Relevant EPC: (.*?)(?:\n|$)/i);
    return match ? match[1].trim() : null;
  }, [searchResult]);

  // Derive unique event types and filtered list
  const { uniqueTypes, filteredEvents } = useMemo(() => {
    if (!searchResult || !searchResult.structuredEvents) {
      return { uniqueTypes: [], filteredEvents: [] };
    }
    const types = Array.from(new Set(searchResult.structuredEvents.map(e => e.type).filter(Boolean)));
    const filtered = selectedType === 'All' 
      ? searchResult.structuredEvents 
      : searchResult.structuredEvents.filter(e => e.type === selectedType);
    return { uniqueTypes: types, filteredEvents: filtered };
  }, [searchResult, selectedType]);

  const hasStructuredData = searchResult?.structuredEvents && searchResult.structuredEvents.length > 0;
  const detectedEvents = !hasStructuredData && searchResult ? extractLikelyEventNames(searchResult.text) : [];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 font-sans transition-colors duration-300">
      {/* Header - High Contrast Navy */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-5 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-lg text-white shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Kinetick Trade Scout</h1>
            <p className="text-xs text-slate-400 font-medium">Global Trade Intelligence Platform</p>
          </div>
        </div>
        
        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Toggle Dark Mode"
        >
          {darkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Search & Controls */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 border-b border-gray-100 dark:border-gray-700 pb-2">Search Parameters</h2>
            
            <div className="space-y-5">
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Product or Service</label>
                <input
                  type="text"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="e.g., Frozen Shrimp, Leather Bags"
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 border px-4 py-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50 dark:bg-gray-700 dark:text-white focus:bg-white dark:focus:bg-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Target Location</label>
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="e.g., Europe, Dubai (Optional)"
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 border px-4 py-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50 dark:bg-gray-700 dark:text-white focus:bg-white dark:focus:bg-gray-600"
                />
              </div>

              <button
                onClick={handleSearch}
                disabled={searchStatus === 'loading' || !productQuery}
                className="w-full bg-indigo-700 hover:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-all shadow-md active:transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {searchStatus === 'loading' ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Scouting Events...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <span>Search Events</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Strategic Analysis Input */}
          {searchResult && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-indigo-100 dark:border-indigo-900 p-6 animate-fade-in ring-1 ring-indigo-50 dark:ring-indigo-900/30 transition-colors duration-300">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-indigo-700 dark:text-indigo-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Strategy AI</h2>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                Describe your business size and goals to get a personalized <strong>Calendar Plan</strong>.
              </p>
              
              <textarea
                value={userProfile}
                onChange={(e) => setUserProfile(e.target.value)}
                placeholder="e.g., Mid-sized manufacturer looking for B2B distributors..."
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 border px-4 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 h-28 mb-4 resize-none bg-gray-50 dark:bg-gray-700 dark:text-white focus:bg-white dark:focus:bg-gray-600"
              />

              <button
                onClick={handleAnalysis}
                disabled={analysisStatus === 'loading' || !userProfile}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-all shadow-md active:transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {analysisStatus === 'loading' ? (
                   <>
                   <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   <span>Thinking...</span>
                 </>
                ) : (
                  <>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    <span>Generate Plan</span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* Right Column: Results */}
        <section className="lg:col-span-8 space-y-6 pb-8">
          
          {/* Welcome State */}
          {searchStatus === 'idle' && (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 transition-colors duration-300">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-full mb-4">
                 <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Explore Global Trade</h3>
              <p className="max-w-md mt-2 text-gray-500 dark:text-gray-400">Enter your product (e.g., "Solar Panels") to find relevant delegations, fairs, and buyer-seller meets.</p>
            </div>
          )}

          {/* Search Results */}
          {searchStatus === 'success' && searchResult && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
              <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 md:px-8 py-5 flex flex-wrap gap-4 justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  Upcoming Events
                </h3>

                 {/* Filter Control */}
                 {uniqueTypes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="type-filter" className="text-sm font-medium text-gray-600 dark:text-gray-400">Filter:</label>
                    <div className="relative">
                      <select
                        id="type-filter"
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="appearance-none bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-1.5 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="All">All Types</option>
                        {uniqueTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 md:p-8">
                 {/* Extracted EPC Info */}
                 {relevantEPC && (
                  <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
                     <div className="p-1.5 bg-blue-100 dark:bg-blue-800 rounded text-blue-600 dark:text-blue-200 mt-0.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                     </div>
                     <div>
                        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wide">Recommended EPC</h4>
                        <p className="text-lg font-medium text-blue-800 dark:text-blue-200">{relevantEPC}</p>
                     </div>
                  </div>
                 )}

                {hasStructuredData ? (
                  <div className="space-y-6">
                    {/* Filtered Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredEvents.map((event, idx) => (
                        <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col h-full">
                          <div className="flex justify-between items-start mb-3">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide 
                              ${event.type?.toLowerCase().includes('delegation') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 
                                event.type?.toLowerCase().includes('exhibition') ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                              {event.type}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 leading-tight">{event.eventName}</h4>
                          <div className="space-y-2 mb-4 flex-grow">
                             <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span>{event.date}</span>
                             </div>
                             <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span>{event.location}</span>
                             </div>
                             {event.description && (
                               <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-3 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-2">
                                 {event.description}
                               </p>
                             )}
                          </div>
                          
                          <div className="flex items-center gap-2 pt-2 mt-auto">
                            <button
                              onClick={() => handleMapSearch(event.eventName)}
                              className="flex-1 inline-flex justify-center items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                            >
                              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              Locate
                            </button>
                            {event.url && (
                              <a
                                href={event.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex justify-center items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                              >
                                <span>Website</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Fallback to raw text link */}
                    <div className="mt-4 text-center">
                      <button 
                        onClick={() => setShowRawReport(!showRawReport)} 
                        className="text-xs font-semibold text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300 underline underline-offset-2"
                      >
                        {showRawReport ? "Hide Raw Report Text" : "View Full Generated Report Text"}
                      </button>
                    </div>
                    
                    {showRawReport && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                        <div className="prose prose-indigo dark:prose-invert prose-sm max-w-none text-gray-700 dark:text-gray-300">
                          <SimpleMarkdown text={searchResult.text} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="prose prose-indigo dark:prose-invert prose-lg max-w-none text-gray-700 dark:text-gray-300">
                    <SimpleMarkdown text={searchResult.text} />
                    
                     {/* Event Actions Bar (Legacy for text-only mode) */}
                    {detectedEvents.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                         <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Interactive Map</p>
                         <div className="flex flex-wrap gap-2">
                           {detectedEvents.map((evt, i) => (
                             <button
                                key={i}
                                onClick={() => handleMapSearch(evt)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 hover:shadow-sm transition-all"
                             >
                                <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {evt.length > 25 ? evt.substring(0, 25) + '...' : evt}
                             </button>
                           ))}
                         </div>
                      </div>
                    )}
                  </div>
                )}

                <GroundingSources chunks={searchResult.groundingChunks} type="web" />
              </div>
            </div>
          )}

          {/* Map Result */}
          {mapResult && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in ring-2 ring-emerald-50 dark:ring-emerald-900/30 transition-colors duration-300">
               <div className="bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-100 dark:border-emerald-800 px-8 py-4 flex justify-between items-center">
                <h3 className="font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9.553 4.553A1 1 0 009 3.618C9 2.734 9 7 9 7" /></svg>
                  Venue Details: {selectedEventForMap}
                </h3>
              </div>
              <div className="p-8">
                 <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-gray-700 dark:text-gray-300">
                   <SimpleMarkdown text={mapResult.text} />
                 </div>
                 <GroundingSources chunks={mapResult.groundingChunks} type="map" />
              </div>
            </div>
          )}

          {/* Analysis Result */}
          {analysisResult && (
             <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-md border border-indigo-100 dark:border-indigo-900 overflow-hidden animate-fade-in transition-colors duration-300">
              <div className="bg-indigo-50 dark:bg-indigo-900/40 border-b border-indigo-100 dark:border-indigo-800 px-8 py-5 flex justify-between items-center">
                <h3 className="font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  Strategic Calendar Plan
                </h3>
                <span className="text-xs font-mono text-indigo-600 dark:text-indigo-300 bg-white dark:bg-indigo-900 px-3 py-1 rounded-full shadow-sm">AI Analysis</span>
              </div>
              <div className="p-8">
                <div className="prose prose-indigo dark:prose-invert prose-lg max-w-none text-gray-800 dark:text-gray-200">
                  <SimpleMarkdown text={analysisResult.text} />
                </div>
              </div>
            </div>
          )}

          {/* New Download Section at the bottom */}
          {(searchResult) && (
            <div ref={resultsEndRef} className="bg-slate-900 dark:bg-slate-800 rounded-xl shadow-xl border border-slate-800 dark:border-slate-700 p-6 flex flex-col md:flex-row justify-between items-center gap-6 animate-fade-in text-white mt-4 transition-colors duration-300">
              <div>
                <h3 className="font-bold text-lg text-white">Export Report</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {analysisResult 
                    ? "Download your complete strategy and event list in your preferred format." 
                    : "Download the event list. Tip: Run the 'Strategy AI' first for a detailed plan."}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={downloadWord}
                  className="flex items-center gap-2 px-5 py-3 bg-blue-700 hover:bg-blue-600 text-white font-medium rounded-lg shadow-lg transition-all active:scale-95 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Download Word
                </button>
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-2 px-5 py-3 bg-red-700 hover:bg-red-600 text-white font-medium rounded-lg shadow-lg transition-all active:scale-95 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  Download PDF
                </button>
              </div>
            </div>
          )}
          
        </section>
      </main>
    </div>
  );
};

export default App;