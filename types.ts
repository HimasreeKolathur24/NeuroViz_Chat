export interface Stage {
  id: string;
  label: string;
  description: string;
  weight: number;
}

export interface Node {
  id: string;
  label: string;
  type: 'intent' | 'fact' | 'intermediate' | 'conclusion' | 'constraint' | 'context';
  importance: number;
  stage_id: string;
}

export interface Edge {
  source: string;
  target: string;
  relation_label: string;
  strength: number;
}

export interface ExplainTrace {
  stages: Stage[];
  nodes: Node[];
  edges: Edge[];
  steps: string[];
  key_factors: string[];
  confidence: 'high' | 'medium' | 'low';
  timestamp: string;
}

export interface GeminiResponse {
  answer: string;
  explain_trace: ExplainTrace;
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
  traceId?: string; // Links to a specific history item
  isThinking?: boolean;
}

export interface HistoryItem {
  id: string;
  question: string;
  answer: string;
  explain_trace: ExplainTrace;
  timestamp: string;
  thumbnail?: string;
}

export enum AppMode {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  VISUALIZING = 'VISUALIZING', // Showing a specific result
}