import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dtrjnvbldzyqjtbuceou.supabase.co';
const supabasePublishableKey = 'sb_publishable_aCtn7pp6myp7aW-V7mT88A_aovbb1Ld';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
