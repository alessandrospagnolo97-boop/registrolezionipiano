import { defineConfig } from 'vite'

// Espone al frontend SOLO le variabili VITE_* e NEXT_PUBLIC_* (quelle create
// dall'integrazione Supabase di Vercel). Le chiavi private (SUPABASE_SERVICE_ROLE_KEY,
// POSTGRES_*, ecc.) NON hanno questi prefissi e non vengono mai incluse nel bundle.
export default defineConfig({ envPrefix: ['VITE_', 'NEXT_PUBLIC_'] })
