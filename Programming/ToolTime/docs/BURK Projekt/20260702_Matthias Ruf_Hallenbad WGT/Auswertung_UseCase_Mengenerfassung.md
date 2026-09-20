# Auswertung & Use-Case: Mengenerfassung / Aufmaß auf der Baustelle

**Projekt:** Tool-Time Firmengruppe Burk · Baustellentag Hallenbad Weingarten, 02.07.2026
**Grundlage:** Vorgespräch + Baustelle mit Projektleiter Matthias Ruf; Aufmaßzählliste, Kaufleute-Excel („produkt_mengen_preise_liste"), handschriftliche Zähllisten der Monteure (01./18.06.), 21 Baustellenfotos.
**Zweck dieses Dokuments:** die Materie sauber verstehen, den echten Engpass benennen, einen realistischen Use-Case mit Optionen bewerten und die nächsten Schritte festlegen - inkl. offener Rückfragen an dich.

---

## 1. Die Material- und Datenkette (so, wie sie heute läuft)

Damit wir dieselbe Landkarte haben - der Weg eines Bauteils von der Ausschreibung bis zur Rechnung:

1. **Leistungsverzeichnis (LV)** vom Planungsbüro. Enthält alle Positionen (Meter Rohr, Formstücke als Stück, Schellen usw.), aber nur als **Kurztext**. Kommt über die **GAEB-Schnittstelle** in Burks Branchensoftware.
2. **Kalkulation/Angebot:** Burk hinterlegt Materialpreise + Lohnminuten → Angebotspreis je Position. Der Kunde liest das per Schnittstelle ein (automatischer Preisspiegel); inhaltlich wird kaum geprüft, nur teils die Fabrikate.
3. **Beauftragung** (meist günstigstes Angebot).
4. **Aufmaßzählliste** (das gedruckte 36-Seiten-Dokument): pro Position die **Angebots-Menge** + eine Leerspalte, in die auf der Baustelle **Striche** gemacht werden.
5. **Bestellung/Lieferung:** läuft NICHT direkt aus dem LV (Beispiel: „1 m DN 125" lässt sich so nicht bestellen → Rückfrage „welche Stücklängen?"). Bestellen ist eine eigene Disziplin; kleine Fittings/Befestigung stehen im LV oft gar nicht. Material geht über das Burk-Lager auf die Baustelle; dort liegt ein Baustellenlager.
6. **Verbau + Zählung vor Ort:** Monteure zählen die verbauten Teile (aktuell ~1× pro Quartal) und tragen sie handschriftlich in Zähllisten ein (Rohr in Meter/Teilstrecken, Formstücke als Stück, beim Trinkwasser zusätzlich Schellen).
7. **Kaufleute-Excel:** Rebecca Rumpenhorst überträgt die Zählung in eine Excel, die pro Position **LV-Menge → bestellt/geliefert → Aufmaß (mit Datum) → Wert (VK)** zusammenführt (mit Preisformeln wie „6,50 € + Index + 7 GM").
8. **Abrechnung** über das ERP (Streit) auf Basis des Aufmaßes.

**Zwei Systeme im Hallenbad:** rot/braun = Abwasser (inkl. Wärmerückgewinnung aus Grauwasser), plus Trinkwasser (Mapress-Edelstahl) und Abwasser/Polokal NG. Das erklärt die zwei getrennten Zähllisten.

---

## 2. Wo genau das Geld verloren geht (der eigentliche Engpass)

Das übergeordnete Ziel ist nicht „schöner zählen", sondern **Liquidität**. Kette dahinter:

- Gezählt wird nur **~quartalsweise** (offiziell wäre monatlich vorgesehen). → Der verbaute Wert wird spät sichtbar → **Abschlagsrechnungen kommen spät** → Burk finanziert lange vor → immer wieder schlechte Liquiditätslage.
- **Warum nicht öfter?** Zeit - und ein echtes fachliches Problem: Man weiß beim nächsten Mal nicht mehr, **wo man aufgehört hat** (Leitung ist in Wand/Decke/Boden verschwunden, „überbaut"). Abschnitts-Logik funktioniert schlecht; besser wäre Datums-Logik + Markierung (Strich/Plan/Foto).
- **Zählen statt aus dem Auto scannen:** weil Material auf der Baustelle liegt (noch nicht verbaut), mehr angeliefert wird als verbaut, **Rückmaterial** unzuverlässig erfasst wird und **Schwund + Verschnitt** real sind. Lager-Scan „funktioniert manchmal".
- **Nachvollziehbarkeit & Qualität:** Aufmaß muss in Teilstrecken belegbar sein (nicht „130 m", sondern 7 + 8,60 + 3,20 …). Bei Monteuren fallen Details hinten runter (Beispiel Hallenbad: **fehlende Schellen** beim Edelstahl - „Super-GAU", wenn ungeprüft weitergegeben). Zwischen Gewerken entstehen Differenzen (Beispiel **Isolierer**: DN-Verwechslung, weil Edelstahl dünnwandiger ist als Stahl).
- **Planänderungen** ständig (Index-Stände), ohne saubere Versionierung → Mehraufwand und Fehlerquellen.

**Kernsatz:** Wenn Burk **häufiger, schneller und mit prüfbarer Qualität** erfassen könnte, was verbaut ist, ließe sich der verbaute Wert laufend abrechnen - genau das ist der Liquiditätshebel.

---

## 3. Der Use-Case - und die ehrliche Bewertung der Wege

Ziel laut dir: mit möglichst wenig Aufwand - idealerweise durch die Monteure selbst - **just-in-time oder regelmäßig** die verbauten Produkte erfassen, mittels Hardware, KI und/oder Prozess.

Ich bewerte vier Wege nach Nutzen vs. Realismus:

### A) Sprach-Aufmaß (Stimme → strukturierte Zählliste) - **Favorit für die Erfassung**
Der Zählende **spricht seine Zählung ins Handy**, statt (oder zusätzlich zum) Striche zu schreiben („DN 110 Bogen 45°, 12 Stück; Rohr 2 m, 17 Stück …"). Die KI transkribiert und ordnet automatisch den LV-Positionen zu → befüllte Excel-Zeilen, die der Projektleiter nur noch **prüft**.
- **Realismus-Korrektur:** Anders als zunächst angenommen zählen die Teams **nicht** generell laut im Duo - meist zählt **einer allein**. Sprach-Aufmaß braucht also eine **kleine neue Gewohnheit** (laut sprechen beim Zählen). Kein Nullaufwand, aber niedrigschwellig - und Sprechen ist oft leichter als sauberes Schreiben.
- **Warum stark:** keine Hardware-Hürde, unabhängig von der Streit-Schnittstelle (Output ist die Excel, die der Projektleiter für den Plan-Ist-Vergleich nutzt), datenschutzlich unkritisch (nur Maße/Material). Passt zu deiner Wispr-Flow-/Sprach-These.
- **Zu lösen:** saubere Zuordnung Ansage → LV-Position (Mapping-Tabelle nötig), Umgang mit Kürzeln („ii/iA", DN vs. Außendurchmesser), Bestätigungs-/Prüfschritt.

### B) Foto-Ebene als Nachvollziehbarkeits- und Prüfschicht - **jetzt Kernfunktion, nicht nur Ergänzung**
Weil manche Monteure zuverlässig zählen und andere nicht (Matthias' Einschätzung), braucht die Erfassung eine **Prüf-/Nachvollziehbarkeitsschicht**. Genau das leistet ein strukturiertes **Foto pro Abschnitt**:
- **Prüfen ohne Rausfahren:** Der Projektleiter kann die Zählung am Foto **nachvollziehen und nachzählen**, ohne selbst auf die Baustelle zu müssen (heute oft nötig). Das spart Matthias direkt Zeit.
- **KI-Gegencheck:** Die KI schätzt sichtbare Teile im Foto und **markiert Abweichungen** zur gesprochenen Zählung → man weiß, wo man genauer hinschauen muss. Auch wenn die KI nicht perfekt zählt, ist „hier weichen Ansage und Bild ab" schon wertvoll.
- **Nach Monteur staffelbar:** zuverlässiger Zähler → leichter Check; unsicherer Zähler → Foto-Gegencheck.
- **Grenze ehrlich:** vollautomatisches Zählen hunderter DN-spezifischer Formstücke aus Fotos ist noch nicht zuverlässig (klein, verdeckt, überbaut). Deshalb: Bild als **Prüf- und Belegschicht + Maß-Check** (Lüftungskanal-Beispiel 300×200 vs. real ~450×350), nicht als alleiniger Primärzähler. Burk hat Kamera-/Stativ-Aufmaß schon getestet (für Zentralen).

### C) QR/Label & Scan (aus Auto/Lager)
- **Realismus:** Fittings vom Lieferanten haben **keine Codes** (Edelstahl, Polokal). Eigenes Labeln = Disziplin-Thema; Rückmaterial/Schwund/Verschnitt brechen die Rechnung. Elektronische Lagerverwaltung „funktioniert manchmal".
- **Fazit:** kein Near-Term-Gewinner; höchstens später für hochwertige Einzelteile (Armaturen, Hebeanlage, Zähler).

### D) Prozess/Software (digitale Zählliste, Excel-Automatik)
- Die Kaufleute-Excel ist der richtige Andockpunkt. Eine **mobile, tippbare Zählliste** je LV-Position wäre denkbar - aber die Kurztext-Ambiguität und ständige Planänderungen machen starre Formulare brüchig. Besser: A liefert die Werte, D hält die **Position-Mapping-Logik** und schreibt in die Excel.

---

## 4. Empfehlung: kleiner, tiefer Sprach-Pilot

**Ein Testballon, ein Abschnitt, ein Team** (Tiefe vor Breite):

- **Wo:** Hallenbad Weingarten, Team Matthias Ruf. Startabschnitt am besten **Abwasser/Polokal UG** (dort ist bereits ein erstes Aufmaß gemacht, gute Vergleichsbasis).
- **Wie:** Der Zählende **spricht** seine Zählung ins Handy → KI transkribiert und mappt auf die LV-Positionen → befüllte Excel-Zeilen (Plan-Ist für den Projektleiter). Dazu pro Abschnitt **Pflicht-Fotos** aus definierter Perspektive. **Matthias prüft nur**, korrigiert, gibt frei.
- **Prüf- & Belegschicht (Kern):** Fotos lösen das „wo-aufgehört"-Problem (Markierung „bis hier gezählt") und dienen als Nachvollziehbarkeit + KI-Gegencheck - so kann Matthias **ohne Rausfahren** prüfen. **Nach Monteur staffelbar:** zuverlässiger Zähler → leichter Check; unsicherer → Foto-Gegencheck.
- **Erfolg messen:** (1) Zeit fürs Erfassen/Übertragen vorher/nachher, (2) wie viel **häufiger** gezählt werden kann (Richtung monatlich/JIT), (3) daraus: **verbauter Wert je Zeitraum** und **Zeit bis Abschlagsrechnung** - das ist die Liquiditäts-Kennzahl.
- **Champion:** der Monteur/Obermonteur, der die Sprachaufnahme zuerst nutzt und intern dafür wirbt.

**Wichtig - die Wert-Brücke:** Die Excel rechnet aus den Stückzahlen bereits den Wert (VK, Preisformeln). Häufigeres Zählen = **laufender Blick auf den verbauten Wert** = schnellere Abschläge. Genau hier zahlt der Use-Case auf Burks Liquidität ein - und das ist die Story fürs Management.

**Zweite Reihe (später, notiert, nicht jetzt):** Plan-Versionierung mit „Änderungen aufleuchten", Bestell-Assistenz (LV → bestellbare Stücklisten inkl. Fittings), automatischer DN-/Isolierer-Abgleich.

---

## 5. Deinem Anspruch entsprechend: dokumentieren & den Kunden informieren

- **Dokumentation:** Dieses Dokument + das bereinigte Transkript + die Foto-/Belegablage im Ordner `20260702_Matthias Ruf_Hallenbad WGT` bilden die saubere Feldnotiz zu Termin 1.
- **Kunden-Update:** Ich schlage ein kurzes, wiederkehrendes Format vor - „**Was ich gesehen habe · Idee · Vorschlag**" (½ Seite, vonhelga-Look), das du Florian Burk und Matthias nach jedem Block schickst. Sag Bescheid, dann baue ich dir daraus direkt ein erstes Update zum heutigen Termin.

---

## 6. Rückfragen an dich (damit ich sauber weiterarbeite)

1. ~~Zielausgabe?~~ **Geklärt:** Ausgabe = befüllte **Kaufleute-Excel**, die dem Projektleiter den Plan-Ist-Vergleich (geplante vs. verbaute Produkte) liefert.
2. **LV digital:** Kannst du mir das **LV** (GAEB-Datei oder Export/Excel) besorgen? Ich brauche die Positionsliste als Mapping-Ziel - das Foto der Excel ist nur ein Ausschnitt.
3. **Software „Capmo":** Ist das die Bau-App, die Matthias mit „Kappmo" meinte (Pläne/Tickets/Planermodul)? Nutzt ihr sie aktiv?
4. **„Mark Kirsch":** Wer/was ist das im Zusammenhang mit „Schnittstelle" - eine Person, ein Anbieter, ein System?
5. ~~Zählverhalten?~~ **Geklärt:** meist zählt **einer allein** (Duo war die Ausnahme). Zuverlässigkeit variiert je Monteur → Foto-/KI-Prüfschicht ist deshalb Kern (s. o.).
6. **Startabschnitt:** Passt Abwasser/Polokal UG als Pilot, oder lieber Trinkwasser/Edelstahl?
7. **Rolle:** Soll das Ziel **Monteur-Selfservice** sein oder **Projektleiter-assistiert** (Matthias spricht/prüft)?
8. **Begriffe zum Bestätigen:** beim Trinkwasser die „Reihe/Range" extra - was genau ist gemeint? Und „ii/iA" auf den Zähllisten (innen/innen bzw. innen/außen bei Bögen)?

Sobald ich #1, #2 und #5 habe, kann ich einen konkreten Mapping- und Pilot-Vorschlag ausarbeiten.
