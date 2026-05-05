import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
 'https://rjzpxcctbrpfrjxrkxby.supabase.co',        // z.B. https://xxxxx.supabase.co
  'sb_publishable_HXkosUzsuU4nKF6OqLDQ3g_xUwms_1N' 
)