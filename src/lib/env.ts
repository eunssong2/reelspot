const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase 자격증명이 없으면 데모 모드로 뜬다.
 * 네트워크를 타지 않고 목 데이터로 동작하므로 화면 확인용으로만 쓴다.
 */
export const isDemo = !url || !anonKey;

export const supabaseUrl = url ?? 'https://demo.supabase.co';
export const supabaseAnonKey = anonKey ?? 'demo-anon-key';
