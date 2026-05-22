# Cruise Calendar Builder

A small browser app for turning Port Otago schedule PDFs/JPGs into a daily cruise-ship count calendar.

## Run

```powershell
python -m http.server 4174 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4174`.

## Use

1. Upload one or more `.jpg`, `.jpeg`, `.png`, or `.pdf` schedule files.
2. The app reads selectable PDF text directly when available. For JPG/PNG/scanned PDFs, it runs OCR in the browser.
3. It reads rows in the `Cargo | Time | Date | Vessel | Movement` format.
4. It keeps cruise vessel rows, ignores fishing/non-cruise rows, and deduplicates arrival/departure/shift movements into one vessel per day.
5. Use the season tabs such as `2026/2027` or `2027/2028`.
6. Export the current season table as CSV when needed.

The calendar starts on 1 October and ends on 30 April of the next year.
