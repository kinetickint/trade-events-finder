export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        reviewText: string;
        sourceUri: string;
      }[];
    }[];
  };
}

export interface EventDetail {
  eventName: string;
  date: string;
  location: string;
  type: string; // e.g., Exhibition, Delegation
  description?: string;
  url?: string;
}

export interface SearchResult {
  text: string;
  structuredEvents: EventDetail[];
  groundingChunks: GroundingChunk[];
}

export interface MapResult {
  text: string;
  groundingChunks: GroundingChunk[];
}

export interface AnalysisResult {
  text: string;
}

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

export enum EPCCategory {
  APEDA = "APEDA (Agricultural & Processed Food Products)",
  EEPC = "EEPC India (Engineering Export Promotion Council)",
  GJEPC = "GJEPC (Gem & Jewellery Export Promotion Council)",
  CHEMEXCIL = "CHEMEXCIL (Basic Chemicals, Cosmetics & Dyes)",
  CLE = "CLE (Council for Leather Exports)",
  EPCH = "EPCH (Export Promotion Council for Handicrafts)",
  PHARMEXCIL = "PHARMEXCIL (Pharmaceuticals)",
  SEPC = "SEPC (Services Export Promotion Council)",
  TEPC = "TEPC (Telecom Equipment and Services)",
  TEXPROCIL = "TEXPROCIL (Cotton Textiles)",
  OTHER = "Other / Not Sure"
}