import mongoose, { Schema, Model } from 'mongoose';

export interface ISearchLog extends mongoose.Document {
  searchId: string;
  userId: string;
  targetAudience: string;
  offering: string;
  durationMs: number;
  cacheHit: boolean;
  cacheKey: string;
  gemini: {
    prompt: string;
    rawOutput?: string;
    generatedQueries: string[];
    finalQueries: string[];
    error?: string;
  };
  serper: {
    queryCalls: Array<{
      query: string;
      queryType?: 'pain-point' | 'contact-invite' | 'broad-identity' | string;
      page?: number;
      tbs?: string;
      resultCount: number;
      status?: number;
      error?: string;
    }>;
    totalRawCount: number;
    totalUniqueCount: number;
    rawResults: Array<{
      queryIndex: number;
      queryType?: string;
      title: string;
      link: string;
      snippet: string;
      date?: string;
      position?: number;
    }>;
  };
  bucketing: {
    totalEvaluatedDomains: number;
    bucketACount: number;
    bucketBCount: number;
    bucketA: Array<{ link: string; domain: string; score: number; title?: string }>;
    bucketB: Array<{ link: string; domain: string; score: number; title?: string }>;
  };
  scraping: Array<{
    url: string;
    domain: string;
    isRobotsAllowed: boolean;
    httpStatus?: number;
    statusText?: string;
    durationMs?: number;
    hasText: boolean;
    textLength?: number;
    emailsFound: string[];
    error?: string;
    fallbacks: Array<{
      url: string;
      path: string;
      isRobotsAllowed: boolean;
      httpStatus?: number;
      durationMs?: number;
      hasText: boolean;
      emailsFound: string[];
      error?: string;
    }>;
  }>;
  extraction: {
    bucketARaw: any[];
    bucketBTriggered: boolean;
    bucketBCount: number;
    bucketBRaw: any[];
  };
  enrichment: {
    bucketAGuessedCount: number;
    bucketBGuessedCount: number;
    leads: any[];
  };
  bioLinkEnrichment?: Array<any>;
  secondaryEnrichmentSearch?: Array<any>;
  finalLeadsCount: number;
  finalLeads: any[];
  error?: string;
  createdAt: Date;
}

const SearchLogSchema = new Schema<ISearchLog>(
  {
    searchId: { type: String, required: true, index: true },
    userId: { type: String, default: 'anonymous', index: true },
    targetAudience: { type: String, default: '' },
    offering: { type: String, default: '' },
    durationMs: { type: Number, default: 0 },
    cacheHit: { type: Boolean, default: false },
    cacheKey: { type: String },
    gemini: { type: Schema.Types.Mixed, default: {} },
    serper: { type: Schema.Types.Mixed, default: {} },
    bucketing: { type: Schema.Types.Mixed, default: {} },
    scraping: { type: Schema.Types.Mixed, default: [] },
    extraction: { type: Schema.Types.Mixed, default: {} },
    bioLinkEnrichment: { type: Schema.Types.Mixed, default: [] },
    secondaryEnrichmentSearch: { type: Schema.Types.Mixed, default: [] },
    enrichment: { type: Schema.Types.Mixed, default: {} },
    finalLeadsCount: { type: Number, default: 0 },
    finalLeads: { type: Schema.Types.Mixed, default: [] },
    error: { type: String }
  },
  { timestamps: true }
);

export const SearchLog: Model<ISearchLog> =
  mongoose.models.SearchLog || mongoose.model<ISearchLog>('SearchLog', SearchLogSchema);
