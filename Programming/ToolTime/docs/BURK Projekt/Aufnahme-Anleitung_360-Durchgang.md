# Aufnahme-Anleitung · 360°-Durchgang je Raum

**Wofür:** ein lückenloser 360°-Bildbeleg je Raum und Woche - als Prüf- und Nachvollziehbarkeitsschicht zum Ausbuchen (Beleg-Ebene im Materialtracker). Ziel: später jedes Teil nah und scharf nachvollziehen und nachzählen können, **ohne rauszufahren**.

---

## Ausrüstung

- **360°-Kamera:** Insta360 X5 (oder gleichwertig, 8K Video / ~72 MP Foto). Später optional Matterport Pro3, wenn zusätzlich Maße/Position gebraucht werden.
- **Monopod/Selfie-Stick** für **~2 m Kamerahöhe**.
- Vollgeladener Akku + leere Speicherkarte.

## Einstellungen

- **Kamerahöhe ~2 m.** Damit liegen in einem 4-5 m breiten/hohen Raum praktisch alle Teile **≤ ~3,5 m** entfernt - nah genug, um 2‑cm‑Teile zu identifizieren.
- **Empfohlen: Foto-Stationen** (72 MP) alle **~3 m** → auf 50 m ca. **17 Positionen**. Ergibt überall ≥ ~10 px auf einem 2‑cm‑Teil = sicher erkennbar.
- **Schneller: 8K-Video-Durchlauf** im Gehen (~2 Min/Raum). Seitenwände top, Decke grenzwertig - für reine Doku ok, fürs Nachzählen lieber Foto.

## Route

1. **Mittig** durch den Raum, gleichmäßig und langsam.
2. **Jede Woche denselben Weg** gehen - wichtig, damit die KI zwei Durchgänge vergleichen und „was ist neu" ableiten kann.
3. Sehr breite/hohe Räume: bei Bedarf eine **zweite Bahn** nah an der Wand, dann sind Decke/Wand noch näher und schärfer.
4. **Verdeckte/kritische Stellen** (Rohr hinter Rohr, gleich überbaut) kurz **separat aus der Nähe** ablichten - Occlusion sieht auch die beste 360°-Kamera nicht.
5. **„Bis hier erfasst"** markieren (Foto/Marker im Bild oder im Plan), damit man beim nächsten Mal sauber anknüpft.

## Faustregeln (Abstand → Schärfe auf 2 cm)

| Entfernung | reicht für |
|---|---|
| bis ~2,5 m | sicher, auch im Video |
| bis ~3,5 m | sicher im Foto-Modus |
| > 5 m | nicht mehr zuverlässig → näher rangehen |

## Ablage & Benennung

- **EU-Cloud** (DSGVO), verknüpft mit dem Materialtracker.
- Ordner je **Projekt / Raum / Kalenderwoche**.
- Namensschema z. B. `HallenbadWGT_FlurUG_KW27` - so hängt der Beleg direkt an der Buchung.

## Aufwand (Richtwert, Raum 4 × 5 × 50 m)

- **Zeit:** ~15-20 Min/Raum (Foto-Stationen); ~2 Min (schneller Video-Durchlauf).
- **Datenmenge:** ~0,6-1 GB je Durchgang/Woche.

---

## Kurz-Checkliste

1. Akku voll, Karte leer, Kamera auf ~2 m Monopod.
2. Foto-Modus, alle ~3 m eine Station (oder Video-Durchlauf).
3. Mittig durch den Raum, **immer derselbe Weg**.
4. Verdeckte Stellen extra aus der Nähe.
5. „Bis hier erfasst" markieren.
6. In `Projekt/Raum/KW` in die EU-Cloud, mit der Buchung verknüpfen.

---

## Datenfluss & Rollen (digitale Klappe)

**Prinzip:** Die Zuordnung passiert **beim Start der Aufnahme** über die App - nicht durch nachträgliches Sortieren. **Gewählter Transportweg: Kamera → App → Handy (Puffer) → Server.**

**1 · Aufnahme starten (Monteur, ~10 Sek. extra)**
- Im Tracker den **Raum** wählen (macht er fürs Ausbuchen ohnehin) → **„360°-Aufnahme starten"**.
- Kamera ist per **USB‑C / Wi‑Fi‑Direct** mit dem Handy gekoppelt; die App **steuert die Aufnahme** und **taggt sie automatisch** mit Projekt · Raum · KW · Zeit · eindeutiger Aufnahme-ID.
- Rundgang gehen. *(Die digitale Klappe/QR bleibt als **Offline-Fallback** und für Kameras ohne App-Kopplung - dann filmt man die Klappe 1 Sek. ab.)*

**2 · Puffer auf dem Handy**
- Nach dem Rundgang zieht die App die Dateien lokal aufs Handy und legt sie in eine **Upload-Warteschlange** (offline-first). Die großen Dateien dürfen dort liegen, bis sie synchronisiert sind.

**3 · Automatischer Upload**
- Sobald das Gerät **gutes WLAN** hat (spätestens im Hof), lädt die App im Hintergrund in die **EU-Cloud** - zugeordnet über die getaggten Daten.
- **Erst nach bestätigtem Server-Upload** werden die Dateien vom **Handy und der Kamera** gelöscht → Speicher frei, nichts geht verloren.

**4 · Projektleiter** sieht den Stand nur noch **im Dashboard** - kein Daten-Handling.

**Alternative (Fallback-Modell):** Haben Teams keine leistungsfähigen/verbundenen Geräte, läuft es über eine **Hof-Dock-Ingest-Station** (Kamera nur reinstecken, Zuordnung über die Klappe). Voraussetzung fürs gewählte Modell: Geräte mit genug Speicher, die **regelmäßig gutes WLAN** erreichen (Hof) → siehe offene Frage an Burk.

### Rollen - klar getrennt
- **Monteur:** aufnehmen (mit Klappe) + Kamera im Hof abgeben. **Allein machbar.**
- **Lager/Hof:** Kameras physisch andocken - **nichts zuordnen**.
- **Projektleiter:** nur prüfen im Dashboard.
- **Niemand** sortiert Dateien von Hand.

### Robust gegen tagesgenaue Dispo
Weil die Klappe **pro Aufnahme** entsteht, ist egal, ob ein Team mittwochs die Baustelle wechselt - jede Aufnahme trägt ihre eigene, korrekte Zuordnung. Kein „Woche = Fahrzeug = Baustelle" nötig, keine Sticker.

### Fallback
Fehlt/verwackelt die Klappe: Ingest **flaggt** die Aufnahme; App-Buchung (Zeitstempel) und optional GPS sind der Backstop → ein kurzer Blick von Lager/Kaufmann, selten. **Wipe erst nach bestätigtem Upload** - nichts geht verloren.

### Ablauf in einer Zeile
`Aufnahme (App-getaggt) → Handy-Puffer → Upload im WLAN → gelöscht nach Server-OK → Dashboard`
