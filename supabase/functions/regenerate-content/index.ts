// Supabase Edge Function: regenerate-content
// Cet endpoint reçoit le contenu à régénérer, appelle Make.com, et renvoie le résultat.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Gestion du CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { content_body, tone, goal } = await req.json()

    console.log(`Régénération demandée pour le contenu. Ton: ${tone}, Objectif: ${goal}`)

    const REGENERATE_WEBHOOK_URL = 'https://hook.eu1.make.com/njj9og03bvurjkv268yt9wjld0q2vs7m'

    const response = await fetch(REGENERATE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_body,
        tone,
        objective: goal
      }),
    })

    if (!response.ok) {
      throw new Error(`Erreur Make.com: ${response.statusText}`)
    }

    const data = await response.json()
    
    // Normalisation de la réponse de Make
    const result = data.content_body || data.new_content || data.text || data

    return new Response(
      JSON.stringify({ result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
