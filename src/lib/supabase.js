// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// API helper functions
export const callsApi = {
  getAll: async (limit = 50) => {
    const { data, error } = await supabase
      .from('calls')
      .select('*, businesses(*)')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },
  getById: async (id) => {
    const { data, error } = await supabase
      .from('calls')
      .select('*, businesses(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
};

export const businessesApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  create: async (business) => {
    const { data, error } = await supabase.rpc('create_business_with_owner', {
      p_name: business.name,
      p_phone_number: business.phone_number || null,
      p_twilio_number: business.twilio_number || null,
      p_cal_org_slug: business.cal_org_slug || null,
      p_vapi_assistant_id: business.vapi_assistant_id || null
    });
    if (error) throw error;
    return data;
  },
  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export const webhookEventsApi = {
  getAll: async (limit = 100) => {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }
};
