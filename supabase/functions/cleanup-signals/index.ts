/// <reference types="https://deno.land/x/deno@v1.28.0/cli/dts/lib.deno.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Delete expired signals (expires_at < NOW())
    const { data, error } = await supabase
      .from('webrtc_signals')
      .delete()
      .lt('expires_at', new Date().toISOString())

    if (error) {
      console.error('Error cleaning up signals:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Successfully cleaned up expired signals')
    return new Response(
      JSON.stringify({ success: true, deletedCount: data?.length ?? 0 }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
