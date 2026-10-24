const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase 자격증명이 없으면 데모 모드로 뜬다.
 * 네트워크를 타지 않고 목 데이터로 동작하므로 화면 확인용으로만 쓴다.
 */
export const isDemo = !url || !anonKey;

// .env 에 `KEY=` 처럼 값이 비어 있으면 빈 문자열이 들어오므로 ??가 아니라 ||로 "없음"을 판단한다.
export const supabaseUrl = url || 'https://demo.supabase.co';
export const supabaseAnonKey = anonKey || 'demo-anon-key';
