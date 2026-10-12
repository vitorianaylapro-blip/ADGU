import { neon } from '@neondatabase/serverless';

export const NEON_DATABASE_URL = "postgresql://neondb_owner:npg_XkdQsc1AEv7D@ep-icy-dust-b5hjov6u-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

export const getDatabaseUrl = (): string => {
  const envUrl = (import.meta.env?.VITE_DATABASE_URL || '').trim();
  if (envUrl.startsWith('postgres://') || envUrl.startsWith('postgresql://')) {
    return envUrl;
  }
  return NEON_DATABASE_URL;
};

// Direct HTTP query client for environments without an Express backend (e.g. Netlify, Vercel, static preview)
export const sql = neon(getDatabaseUrl());
