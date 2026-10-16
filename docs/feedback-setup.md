# Collegare il feedback (piani gratuiti)

La webapp rimane statica su GitHub Pages. Il Worker riceve gli invii, D1 conserva i testi e Cloudinary conserva gli screenshot con tipo `authenticated`. Non vengono trasmessi schede, sessioni o backup degli allenamenti.

Finché `NEXT_PUBLIC_FEEDBACK_API_URL` non è configurato, il modulo permette di provare testo, incolla e anteprime ma non invia nulla. Nessun servizio è stato creato o attivato automaticamente.

## 1. Cloudinary Free

- Crea un account **Free**, senza carta o upgrade.
- Annota cloud name, API key e API secret dal tuo ambiente Cloudinary.
- Non serve un upload preset unsigned: il Worker firma gli upload.
- Non rendere pubblica la cartella degli allegati. Il codice usa `type=authenticated`, non `upload`.
- Controlla l'utilizzo: il piano gratuito ha quote; un eccesso può portare alla sospensione. Nessun piano o add-on a pagamento è necessario.

## 2. Workers e D1 Free

Da terminale nella cartella `feedback-worker`:

```sh
npx wrangler login
npx wrangler d1 create workout-buddy-feedback
```

Copia `wrangler.example.toml` in `wrangler.toml` (ignorato da Git). Inserisci:

- `database_id` restituito dal comando;
- `CLOUDINARY_CLOUD_NAME`;
- `ALLOWED_ORIGINS`: origini esatte separate da virgole. Per GitHub Pages usa `https://TUO-UTENTE.github.io`, senza il percorso del repository. Aggiungi il dominio personalizzato, se presente, e `http://localhost:3000` per il test locale.

Resta sul piano **Workers Free**. Non attivare Workers Paid o R2. D1 deve appartenere all'account Workers Free.

```sh
npx wrangler d1 execute workout-buddy-feedback --remote --file=schema.sql
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
npx wrangler secret put FEEDBACK_ADMIN_TOKEN
npx wrangler deploy
```

Il token amministratore deve avere almeno 32 caratteri casuali. Puoi generarne uno sul tuo computer:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Conservalo in un gestore password. Non metterlo nei file `NEXT_PUBLIC_*`, nelle variabili pubbliche GitHub, nel repository o negli URL. Verrà richiesto nella schermata amministratore.

## 3. Collegare il frontend

Prendi l'URL restituito da Wrangler, per esempio `https://workout-buddy-feedback.TUO-ACCOUNT.workers.dev`.

**Locale:** copia `.env.example` in `.env.local`, compila `NEXT_PUBLIC_FEEDBACK_API_URL` con quell'URL e riavvia `npm run dev`.

**GitHub Pages:** aggiungi una repository variable Actions chiamata `NEXT_PUBLIC_FEEDBACK_API_URL` con lo stesso URL, senza percorsi aggiuntivi. Il workflow `deploy-pages.yml` la passa alla build. Esegui nuovamente il workflow: le variabili pubbliche Next sono incluse nella build e non cambiano un sito già pubblicato.

Il workflow registra anche lo SHA del commit come versione tecnica dell'app, così i feedback restano associati alla build provata. In locale puoi impostare una descrizione con `NEXT_PUBLIC_APP_VERSION`.

Per un backend locale: copia il file di configurazione come sopra, inserisci i segreti in `.dev.vars` (ignorato da Git), inizializza D1 con `npx wrangler d1 execute workout-buddy-feedback --local --file=schema.sql` e avvia `npx wrangler dev`. Usa l'origine mostrata da Wrangler nella `.env.local` della webapp. I file vengono caricati nel Cloudinary configurato anche con il Worker locale.

## 4. Prova completa dopo il collegamento

1. Apri **Feedback** e invia un testo senza allegati.
2. Incolla uno screenshot nel campo messaggio; controlla anteprima e rimozione. Su iPhone usa l'azione di sistema **Incolla** con un'immagine già copiata, oppure **Aggiungi screenshot** se il browser non la espone.
3. Invia testo con un allegato.
4. Apri **Area amministratore**, inserisci il token e controlla testo, data, categoria e screenshot. Prova gli stati Nuovo / Da fare / Risolto.
5. Esci: il token resta solo in memoria e non viene conservato nel browser.
6. Verifica che una richiesta senza token non possa leggere feedback o immagini; in Cloudinary un URL privo di firma non deve mostrare lo screenshot.

## Limiti e gestione

- Massimo 3 immagini per feedback. Ingresso frontend: PNG, JPEG, WebP fino a 12 MB; ridimensionamento fino a 1600 px e compressione JPEG fino a 700 KB. Backend: massimo 768 KB per immagine e 3 MB per richiesta.
- Testo fino a 4.000 caratteri; nome facoltativo fino a 80.
- Limiti iniziali: **20 invii al giorno complessivi**, **5 all'ora per IP** (gli amici sulla stessa rete condividono questo limite). Contatori atomici D1, IP memorizzato solo come hash con segreto; nessun IP grezzo nei feedback.
- Richieste ripetute con lo stesso ID non duplicano i feedback riusciti. Un invio interrotto ancora in elaborazione restituisce 409; dopo 10 minuti può essere ripulito e riprovato con lo stesso ID.
- Upload falliti: tentativo di eliminare gli allegati parziali. Se il servizio esterno fallisce anche durante la pulizia, verifica periodicamente la cartella `workout-feedback` per eventuali file orfani. Non c'è una transazione distribuita fra D1 e Cloudinary.
- L'area amministratore carica 20 feedback alla volta; gli screenshot vengono scaricati solo quando li apri, tramite il Worker autenticato. Il browser non riceve API secret o URL firmati Cloudinary.
- Questa prima versione non include notifiche, risposte ai tester, cancellazione dal pannello o sincronizzazione degli allenamenti. La rimozione definitiva di feedback/allegati si può fare dalle console dei servizi.
- Non c'è un fallback che dichiari ricevuti feedback salvati solo sul dispositivo. Se l'invio fallisce, testo e allegati restano nella schermata per riprovare; uscire o ricaricare la pagina li elimina.

## Verifiche locali senza infrastrutture

`npm test` include test del Worker con SQLite in memoria e Cloudinary simulato: validazione, CORS, accesso amministratore, firma, allegati privati, idempotenza, limiti, errori e pulizia. Non contattano servizi esterni e non dimostrano il funzionamento dell'account reale: completa la prova del punto 4 dopo il deploy.

Riferimenti: [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [Cloudinary Free](https://cloudinary.com/documentation/developer_onboarding_faq_free_plan), [firme Cloudinary](https://cloudinary.com/documentation/authentication_signatures), [accesso privato](https://cloudinary.com/documentation/control_access_to_media).
