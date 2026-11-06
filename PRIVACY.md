# Privacy

Fontsaver does not collect, transmit, or sell personal data, and has no analytics or accounts.

**Stored in your browser:** favorites, tags, notes, and settings, in `storage.sync` (synced by your browser vendor if sync is on) or `storage.local`, depending on the storage mode you pick in Settings.

**Network requests:**

- `api.fontsource.org`: downloads the public font catalog. No user data is sent.
- `fonts.googleapis.com` and `fonts.gstatic.com`: the Library and Side Panel load the font families in your collection to render previews, so Google receives those family names and your IP address, as it does when you browse fonts.google.com.

**Content script:** runs only on `fonts.google.com` to add the heart button. It reads font names from the page and does not send page content anywhere.
