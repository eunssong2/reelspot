import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { supabaseAnonKey, supabaseUrl } from '@/lib/env';
import type { Database } from '@/types/database';

// 자격증명이 없으면 env 가 더미 값을 준다 (데모 모드). 그때는 이 클라이언트가 호출되지 않는다.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // OAuth 콜백은 expo-web-browser 로 직접 받는다.
    detectSessionInUrl: false,
  },
});
