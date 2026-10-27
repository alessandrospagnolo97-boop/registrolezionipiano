# Registro lezioni di pianoforte

Web app minimal e mobile-first (Vite + JavaScript, unica dipendenza: `@supabase/supabase-js`).
Lezioni automatiche: **martedì Ostia Antica · giovedì Castel Gandolfo · venerdì Frosinone**, da ottobre 2026.
Chiunque abbia il link può **consultare**; solo l'amministratore autenticato può **modificare**.

## Configurazione (nessun terminale)

### 1. GitHub
1. Su github.com: **New repository** → nome `registro-lezioni` → Create.
2. **uploading an existing file** → trascina **il contenuto** della cartella (incluse `src` e `supabase`) → Commit.

### 2. Vercel + Supabase
1. Su vercel.com: **Add New → Project** → importa il repository → **Deploy** (Framework: Vite, rilevato da solo).
2. Nel progetto: **Storage → Create Database → Supabase** (Marketplace) → collega al progetto, ambienti Production/Preview/Development.
   Vercel crea le variabili d'ambiente automaticamente.
3. **Deployments → ⋯ → Redeploy**, così le variabili vengono incluse nel sito.

### 3. Database
1. Apri Supabase dal pannello Vercel (**Open in Supabase**) → **SQL Editor**.
2. **Authentication → Users → Add user → Create new user**: la tua email + password, spunta *Auto Confirm User*.
3. Apri `supabase/schema.sql`, sostituisci `LA_TUA_EMAIL@esempio.it` con la tua email, incolla tutto nell'SQL Editor → **Run**.
4. (Consigliato) **Authentication → Sign In / Providers → disattiva "Allow new users to sign up"**.

### 4. Uso
Apri il link Vercel. **Accedi** (in alto a destra) con l'account creato: da quel momento i pallini e il menu 🚗 sono attivi e salvano da soli.
Condividi lo stesso link per la sola lettura.

## Variabili d'ambiente
| Variabile | Note |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | creata dall'integrazione (in alternativa `VITE_SUPABASE_URL`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chiave pubblica anon/publishable (in alternativa `VITE_SUPABASE_ANON_KEY`; accettata anche `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |

Se l'integrazione non le crea, aggiungile a mano in **Vercel → Settings → Environment Variables** (URL e chiave anon da Supabase → Project Settings → API) e rifai il Redeploy.
La `service_role` key **non è mai usata né esposta**: la sicurezza è garantita dalla Row Level Security (scrittura solo per gli utenti presenti in `admins`).

## Note sui dati
- Una riga in `lessons` per data (chiave primaria): nessun duplicato, presenze indipendenti per ogni giorno.
- Export `.txt`: dal mese di ottobre 2026 fino al mese visualizzato (o all'ultimo mese con dati, se successivo).
- "non compilato" = nessuna presenza segnata; "assente" = lezione compilata ma l'insegnante non risulta presente.
