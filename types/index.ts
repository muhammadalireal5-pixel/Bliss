import mongoose from 'mongoose';
import React from 'react';

// Common React layout props
export interface RootLayoutProps {
  children: React.ReactNode;
}

// Database Models
export interface ICampaign extends mongoose.Document {
  targetAudience: string;
  reasonForOutreach: string;
  offering: string;
  userId: string;
  createdAt: Date;
}

export interface ILead extends mongoose.Document {
  campaignId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  profileUrl?: string;
  source?: string;
  summary?: string;
  draftEmail: string;
  status: 'draft' | 'sent' | 'bounced';
  createdAt: Date;
}

// Frontend Data Types
export interface LeadData {
  name: string;
  email: string;
  source?: string;
  profileUrl?: string;
  summary?: string;
  subject: string;
  draftEmail: string;
  status: 'draft' | 'sent';
  regenerating?: boolean;
  sending?: boolean;
  generationFailed?: boolean;
  secured?: boolean;
}

// Gemini API Params
export interface GenerateTemplateParams {
  targetAudience: string;
  reasonForOutreach: string;
  offering: string;
  tone: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiLeadData {
  name?: string;
  company?: string;
  industry?: string;
  bioSnippet?: string;
}

export interface RegenerateLeadEmailParams {
  baseTemplate: string;
  leadData: GeminiLeadData;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateBatchParams extends GenerateTemplateParams {
  leads: GeminiLeadData[];
}
