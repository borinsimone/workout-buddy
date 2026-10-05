# Workout Buddy

Base MVP di un diario di allenamento, realizzata con Next.js, TypeScript, App Router e CSS responsive. Interfaccia in italiano, tema scuro e accenti lime, blu e ambra.

## Avvio

```bash
npm install
npm run dev
```

Apri l'indirizzo indicato dal terminale (normalmente http://localhost:3000).

## Funzioni implementate

- Calendario settimanale, navigazione tra settimane, selezione del giorno e ritorno a oggi.
- Schede con nome, note, sezioni riordinabili, esercizi a carico/ripetizioni o durata.
- Obiettivi e recupero per set, RPE facoltativo, aggiunta ed eliminazione di set ed esercizi.
- Programmazione su data e ora; modifica di una sessione programmata e copia indipendente.
- Sessione con registrazione effettiva, correzione, set saltati, recupero e timer con preparazione, pausa e variazioni di 10 secondi.
- Ripresa dei risultati e del timer dopo un reload, sullo stesso browser.
- Riepilogo, volume (solo esercizi a carico), record per esercizio, storico ricercabile e cancellazione annullabile.
- Copia di una sessione completata con i risultati effettivi come nuovi obiettivi.
- Backup JSON, importazione con validazione e unione per ID, esportazione CSV.

Al primo avvio vengono caricate una scheda, una sessione programmata per oggi e una sessione completata dimostrativa. Non rappresentano allenamenti reali dell'utente.

## Dati e limiti della base

I dati sono salvati in `localStorage` sul browser corrente. Non esistono account, sincronizzazione cloud o database. Cancellare i dati del browser elimina il diario: esporta regolarmente il backup. L'importazione mantiene la versione locale in caso di ID già presente e non cambia le preferenze esistenti.

I timer usano scadenze assolute, ma la notifica a schermo richiede che l'app sia aperta. Non sono ancora implementate notifiche di sistema, feedback aptico, schermo sempre attivo o funzionamento offline. La durata della sessione è il tempo trascorso dall'avvio alla chiusura. I record confrontano esercizi con stesso nome e modalità; rinominarli crea una nuova categoria.

L'editor salva automaticamente una bozza locale recuperabile dal calendario dopo un reload. Una nuova modifica sostituisce la bozza precedente; le bozze non sono incluse nel backup. Salva solo scheda salva il modello senza creare sessioni, mentre Salva e programma lo assegna a data e ora. Le sessioni programmate possono essere spostate dal dettaglio mantenendo il loro ID. Le copie delle schede e delle sessioni hanno ID indipendenti: lo storico non viene modificato dalle modifiche future.

## Struttura

- `src/components/workout-app.tsx`: flusso, schermate e persistenza locale.
- `src/components/icon.tsx`: icone SVG riutilizzabili.
- `src/lib/workout.ts`: tipi, dati iniziali, copie, metriche e validazione backup.
- `src/app/globals.css`: stile e breakpoint desktop/mobile.
- `src/app/api/health/route.ts`: endpoint GET `/api/health`.
- `tests/workout.test.mjs`: verifica delle regole sui risultati e dei backup.

## Verifica

Richiede Node.js 22.18+ per i test TypeScript senza compilazione separata.

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

Per la produzione: `npm start`. Per Vercel, importa il repository Git. Un futuro backend può sostituire la persistenza locale mantenendo i tipi del dominio.


## Sessione: uso dei controlli

Il riquadro Set corrente mostra numero e obiettivo del prossimo set. Rivedi e correggi qualsiasi set apre l'elenco di tutti gli esercizi, inclusi quelli precedenti: puoi modificare valori, RPE e stato (eseguito, saltato, da eseguire). Una correzione non riavvia automaticamente il recupero. Se riapri un set o correggi lo stato del set corrente, il timer viene fermato per evitare di associarlo al set sbagliato.

A fine recupero o esercizio a tempo compare un avviso persistente nella sessione. La scadenza del timer non completa automaticamente il set: conferma i risultati. L'avviso viene chiuso esplicitamente o all'avvio di un nuovo timer; non sono emessi suoni o notifiche di sistema.


## Aggiunta alla schermata Home

Il manifest `/manifest.webmanifest` richiede la modalita fullscreen per i browser compatibili. iPhone e iPad usano la modalita app standalone, senza la barra di Safari, con la barra di stato gestita da iOS. Sono presenti icone PNG 192/512, icona maskable, apple-touch-icon e margini per le aree sicure.

Dopo la pubblicazione con HTTPS:
- Android / Chrome: menu del browser, Aggiungi a schermata Home oppure Installa app; apri poi dall'icona.
- iPhone / Safari: Condividi, Aggiungi alla schermata Home; abilita Apri come app web se disponibile e apri dall'icona.

Il manifest e i metadati non aggiungono supporto offline. GitHub conserva il repository; per eseguire questa app Next.js usa un hosting compatibile, come Vercel. L'installazione reale va verificata sul telefono dopo la pubblicazione. I dati restano nel browser/dispositivo usato, non vengono sincronizzati con il PC.
