# Plonopolis HTML5 — ranking online

Ten pakiet zawiera:
- frontend HTML5 (`index.html`, `styles.css`, `script.js`)
- backend Node.js + Express (`server.js`)
- wspólny ranking online dla wszystkich graczy
- zapisywanie postępu gry po stronie serwera w pliku `data/db.json`

## Jak uruchomić

1. Otwórz terminal w folderze projektu.
2. Zainstaluj zależności:

```bash
npm install
```

3. Uruchom serwer:

```bash
npm start
```

4. Wejdź w przeglądarce na:

```text
http://localhost:3000
```

## Ważne

- Ranking jest wspólny dla wszystkich graczy korzystających z tego samego serwera.
- Dane kont, zapisów i sesji są przechowywane w `data/db.json`.
- Aby ranking był naprawdę publiczny online, serwer trzeba wdrożyć na hostingu VPS / Render / Railway / Fly.io.
- Frontend nie powinien być uruchamiany bezpośrednio jako `file://`, tylko przez `npm start`.
