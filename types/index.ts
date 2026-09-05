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
  followUpEnabled: boolean;
  followUpDelayDays: number;
  maxFollowUps: number;
  createdAt: Date;
}

export interface ILead extends mongoose.Document {
  campaignId: mongoose.Types.ObjectId;
  userId: string;
  trackingId: string;
  name: string;
  email?: string;
  contactMethod: 'email' | 'source-only';
  contactSource?: string;
  confidence: 'verified' | 'guessed';
  profileUrl?: string;
  source?: string;
  summary?: string;
  subject: string;
  draftEmail: string;
  status: 'draft' | 'queued' | 'sent' | 'replied' | 'stopped' | 'bounced' | 'unsubscribed';
  opens: number;
  clicks: number;
  replies: number;
  step: number;
  sendAt?: Date;
  createdAt: Date;
}

// Frontend Data Types
export interface LeadData {
  _id?: string;
  userId?: string;
  trackingId?: string;
  name: string;
  email?: string;
  contactMethod?: 'email' | 'source-only';
  contactSource?: string;
  confidence?: 'verified' | 'guessed' | 'high' | 'medium' | 'low';
  alreadyContacted?: boolean;
  source?: string;
  profileUrl?: string;
  queryType?: string;
  summary?: string;
  subject: string;
  draftEmail: string;
  status: 'draft' | 'queued' | 'sent' | 'replied' | 'stopped' | 'unsubscribed';
  opens?: number;
  clicks?: number;
  replies?: number;
  step?: number;
  sendAt?: Date;
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
  email?: string;
  contactMethod?: 'email' | 'source-only';
  contactSource?: string;
  source?: string;
  summary?: string;
  profileUrl?: string;
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
