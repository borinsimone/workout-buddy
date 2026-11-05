# Obiettivi e ultima prestazione

I backup restano in formato `version: 1`. I nuovi campi sono facoltativi: non vengono estratti automaticamente dai nomi o dalle note delle schede già importate.

- Esercizio: `loadType: "weight" | "bodyweight"`, `perSide: true | false`, `historyId` (mantenuto nelle copie).
- Set: `targetMode: "fixed" | "range" | "max"`; con `range`, `reps` è il minimo e `repsMax` il massimo. Gli intervalli si applicano alle ripetizioni.
- Un obiettivo `max` non rappresenta zero ripetizioni eseguite: il numero effettivo va registrato durante la sessione. Per le tenute a tempo massimo il timer funziona come cronometro, con preparazione, pausa e ripresa.
- Senza `loadType`, il carico è esterno: `0 kg` non viene interpretato automaticamente come peso corporeo. Selezionare **Peso corporeo** nell'editor per gli esercizi appropriati. I kg positivi in questo caso sono sovraccarico, non il peso della persona.
- **Per lato** chiarisce il significato di ripetizioni/durata; il volume non viene automaticamente raddoppiato. Il volume conta i kg esterni registrati, escludendo peso corporeo non quantificato, set saltati e incompleti.
- Riutilizzare una sessione conserva l'intervallo o il massimo originali e riprende i carichi effettivi. Aggiungere un set conserva l'obiettivo e precompila i valori effettivi della riga precedente senza segnarlo completato.

Il confronto usa l'ultima sessione completata prima dell'inizio di quella corrente, mai sessioni attive o future. Sono confrontati esercizi con nome normalizzato, modalità, tipo di carico e lato compatibili; la provenienza nelle copie aiuta a distinguere esercizi duplicati. Se il nome è ambiguo, non viene scelto un esercizio a caso. Ogni riga mostra il risultato effettivo dello stesso numero di set; se era saltato, incompleto o assente viene indicata l'assenza del dato. Non viene usato il risultato di un altro set per riempire il vuoto.
