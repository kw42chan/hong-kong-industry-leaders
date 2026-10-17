export type OperatorLabel = "operator" | "referrer" | "uncertain";

export interface OperatorClassification {
  domain: string;
  label: OperatorLabel;
  companyName?: string;
  confidence: number;
  reasons: string[];
}

export interface DomainEnrichmentSignals {
  domain: string;
  homepageUrl: string;
  pageTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  organizationName: string | null;
  organizationTypes: string[];
  contactHints: string[];
  aboutPageUrl: string | null;
  aboutSnippet: string | null;
  fetchErrors: string[];
}

export interface ClassificationCandidate {
  domain: string;
  bestTitle: string | null;
  bestUrl: string | null;
}
