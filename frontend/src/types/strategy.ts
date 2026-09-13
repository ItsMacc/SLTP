export type StrategyCategory = 'TRADING' | 'INVESTING';


export interface CoreMetrics {
  horizon: string;
  activity: string;
  positions: string;   
  rebalance: string;
}

export interface DetailedPoint {
  title: string;
  description?: string;
}

export interface DeepDiveSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

export interface GlossaryTerm {
  definition: string;
  example?: string;
}

export interface StrategyData<TParams = Record<string, any>> {
  id: string;
  name: string;
  category: StrategyCategory;
  summary: string;
  metrics: CoreMetrics;
  
  idea: {
    hypothesis: string;
    whyItWorks: (string | DetailedPoint)[];
    whyItDoesnt: (string | DetailedPoint)[];
  };
  
  universeLogic: string;
  rebalanceLogic: string;
  
  inDepthSections?: DeepDiveSection[];
  
  pros: (string | DetailedPoint)[];
  cons: (string | DetailedPoint)[];

  glossary: Record<string, string | GlossaryTerm>;
  parameters?: TParams;

  // Custom UI Action configuration
  actionLabel?: string;
  onAction?: (strategyId: string) => void;
}