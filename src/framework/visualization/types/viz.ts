export interface VizOptions {
  edges?: {
    arrows?: {
      to?: {
        enabled?: boolean;
      };
    };
  };
}

export interface VizNode {
  id: string;
  label: string;
}

export interface VizEdge {
  from: string;
  to: string;
  label?: string;
  title?: string;
}
