# Recherche & Empfehlung: Foto-/KI-gestützte Mengenerfassung

**Kontext:** Antwort auf Flos Fragen zur foto-/KI-basierten Zählung (Baustelle Hallenbad Weingarten). Ziel: verbaute Produkte je LV-Position regelmäßig/JIT erfassen, um Abschlagsrechnungen und damit Liquidität zu verbessern. Diese Analyse ist grundlagen-recherchiert (Quellen unten) und wägt die Wege ab, bevor etwas gebaut wird.

**Kernbotschaft vorweg:** Deine Idee „einfach alles fotografieren, die KI erkennt, was neu ist" gibt es als reife Produktkategorie - **Reality-Capture-Progress-Tracking** (Buildots, OpenSpace, Doxel). Sie funktioniert aber über **kontinuierliche 360°-Begehungen, die an ein BIM-Modell gemappt werden**, nicht über Einzelfotos je Teil - und sie stößt genau bei der **feinen MEP-Zählung** (viele kleine, verdeckte, überbaute Formstücke) an Grenzen. Für Burk heute ist der pragmatische Weg deshalb: **den menschlichen Zählvorgang mühelos und prüfbar machen**, nicht ihn sofort durch Voll-KI ersetzen - mit klarem Ausbaupfad.

---

## 1. Antworten auf deine konkreten Fragen

**„Beim Zählen erst das Produkt auswählen und ein Referenzbild anzeigen."**
Sehr sinnvoll. Das löst genau das Kernproblem aus dem Transkript: die Kurztext-/Zuordnungs-Unsicherheit (welches Formstück gehört zu welcher LV-Position). Auswahl + Referenzbild + gleichzeitige Sprach-/Tippzählung = robuste, idiotensichere Erfassung. Das ist der beste Einstieg.

**„Was, wenn man gar nicht zählt, sondern von jedem Produkt ein Bild macht - erkennt die KI neu vs. schon gezählt?"**
Technisch ist das die **Reality-Capture**-Idee. Aber: Die Unterscheidung „schon gezählt / neu" gelingt in der Praxis **nicht über das Aussehen** des Teils (zwei DN-110-Bögen sehen identisch aus - Wiedererkennung per Aussehen scheitert), sondern über die **Position** (wo im Raum/Plan sitzt das Teil). Dafür braucht es (a) **kontinuierliche Aufnahme** (Video-Begehung, nicht Einzelfotos) und (b) **Lokalisierung** (die Kamera weiß, wo sie ist). Genau so arbeiten OpenSpace/Buildots/Doxel: 360°-Begehung → automatisch auf Plan/BIM gemappt → „work in place" je Gewerk. Für **grobe Fortschritts-/Mengenverfolgung** funktioniert das; für **exakte Stückzahlen hunderter kleiner Formstücke** ist es wegen Verdeckung noch unzuverlässig.

**„Bildgröße / Datenmenge - zu viel? Was bei 8.000 Teilen?"**
8.000 **Einzelfotos** ≈ mehrere zehn GB und ein enormer manueller Aufwand - und sie lösen das Dedup-Problem trotzdem nicht. Eine **durchgehende Begehung** (ein paar GB, in die Cloud) ist die effizientere Form und liefert über die Bewegung gleich die Position mit. **Speicher ist nicht der Engpass** (Cloud, günstig) - der Engpass ist die **verlässliche Interpretation + Lokalisierung**. Fazit: „jedes Teil einzeln fotografieren" skaliert nicht; „einmal sauber durchgehen" schon.

**„Womit fotografieren, wo speichern?"**
Pragmatisch: **iPhone Pro mit LiDAR** (misst ~2 cm genau bis 3-4 m, liefert über ARKit zusätzlich die Eigenposition; Apps wie Polycam, SiteScape/FARO, Scanbrix). Für echte Begehungen: **360°-Helmkamera** (wie bei OpenSpace/Buildots). Speicher: **EU-Cloud** (DSGVO), angedockt an euren bestehenden Excel-/Doku-Fluss.

**„Wie wissen die Monteure, wo sie aufgehört haben?"**
Drei Wege, vom einfachsten zum aufwendigsten: (1) **Markierung im Plan/Foto** „bis hier gezählt" - digitalisiert das, was ihr heute schon macht (roter Strich). (2) **AR-/LiDAR-Breadcrumb** - das iPhone merkt über ARKit, wo es war, und markiert die abgedeckte Strecke. (3) **Begehungs-Software**, die die Abdeckung automatisch auf den Plan legt. Für den Start reicht (1).

**„Braucht es Beacons in jedem Gebäude für Position und Blickrichtung?"**
**Grundsätzlich nein.** Moderne Systeme bestimmen Position **und** Blickrichtung visuell/über die Bewegungssensoren des Geräts (Visual Positioning / LiDAR-SLAM) - genau das leistet das iPhone selbst. Zum Vergleich der Alternativen: **BLE-Beacons** sind nur metergenau (zu grob, um die Blickrichtung zu sichern); **UWB** schafft 0,5-1 m, braucht aber teure, fest installierte Anker **pro Baustelle** (unwirtschaftlich bei wechselnden Objekten); **Visual Positioning** erreicht in strukturreichen Räumen UWB-Niveau **ohne Infrastruktur**. Beacons/UWB lohnen nur in Sonderfällen (kaum visuelle Merkmale, Dunkelheit) - für euch Overkill.

---

## 2. Bewertung der Lösungsideen

| Ansatz | Was es kann | Grenze für Burk heute |
|---|---|---|
| **Reality-Capture-Progress (Buildots/OpenSpace/Doxel)** | 360°-Begehung → automatisch auf Plan/BIM, verfolgt verbaute Mengen vs. Plan über viele Gewerke, für Abrechnung | Braucht **BIM** (ihr arbeitet aus 2D-Plänen + ständig geänderten Montageplänen), **Enterprise-Preise**, Hybrid mit menschlicher Prüfung; feine MEP-Zählung durch **Verdeckung** limitiert |
| **KI zählt alles aus Fotos/Video** | Detektion + Tracking (SORT/ByteTrack) vergibt IDs → zählt jedes Objekt einmal | Multimodale KI hat bekannte **Zähl-Schwäche** bei vielen ähnlichen Objekten („counting hallucinations"), braucht Hybrid mit Detektoren; DN-genaue Unterscheidung kleiner Formstücke unsicher |
| **Beacons/UWB für Position** | Genaue Verortung | Infrastruktur **pro Gebäude**, Kosten; durch iPhone-SLAM meist überflüssig |
| **Voice + Produkt-Auswahl + Referenzbild (dein Einstieg)** | Mühelose, zuordnungssichere Erfassung durch den Zähler; KI strukturiert | Kleine neue Gewohnheit (sprechen/auswählen); KI zählt nicht, sondern strukturiert + prüft |
| **Foto pro Abschnitt als Prüf-/Belegschicht** | Nachvollziehbarkeit ohne Rausfahren, KI-Plausibilitätscheck, „wo aufgehört" | Kein Voll-Ersatz fürs Zählen |

---

## 3. Empfehlung: Crawl - Walk - Run

**Crawl (jetzt, Pilot - kein BIM, keine Beacons, kein Enterprise-Tool):**
Erfassung = **Produkt auswählen (mit Referenzbild) + Zählung sprechen**; die KI strukturiert das in die LV-Positionen und füllt die **Plan-Ist-Excel** des Projektleiters. Dazu **ein Abschnittsfoto/kurzes Video** als Prüf- und Belegschicht (Matthias prüft ohne Rausfahren; KI markiert Abweichungen; nach Monteur staffelbar). Optional das iPhone-LiDAR für den gelegentlichen Maß-Check (dein/Matthias' Lüftungskanal-Beispiel). Günstig, schnell, idiotensicher machbar.

**Walk (danach):**
Leichte **Lokalisierung** ergänzen (ARKit-Breadcrumb bzw. kurze Begehung), damit Fotos **positionsverankert** sind → löst „wo aufgehört" robust und erlaubt der KI, **über die Zeit zu vergleichen** (neu vs. bekannt über Position statt Aussehen).

**Run (Zukunft, nur wenn es sich rechnet):**
Vollständiges **Reality-Capture** (360°-Begehung + planbasierter Fortschritt). Lohnt aber erst, wenn Burk Richtung **BIM** geht und das Volumen die Enterprise-Werkzeuge trägt. **Wichtige Lücke ehrlich benannt:** Ohne BIM und mit ständig wechselnden 2D-Plänen fehlt heute die Grundlage, auf die diese Systeme aufsetzen.

**Warum nicht sofort Voll-KI-Zählung:** (a) KI-Zählung vieler ähnlicher Kleinteile ist noch unzuverlässig (Hybrid nötig), (b) MEP-Verdeckung, (c) braucht BIM + Lokalisierungs-Infrastruktur, (d) Enterprise-Kosten. Der wirtschaftliche Hebel liegt darin, den **menschlichen Zählvorgang mühelos + prüfbar** zu machen - mit klarem Upgrade-Pfad, falls Burk später auf BIM/Reality-Capture umstellt.

---

## Quellen

- OpenSpace - Progress Tracking / Capture: https://www.openspace.ai/products/progress-tracking/ , https://www.openspace.ai/products/capture/
- Doxel - Progress Tracking: https://doxel.ai/
- Übersicht Bau-KI (u. a. Buildots, Mengen vs. Plan): https://www.mastt.com/blogs/construction-ai-companies , https://www.unite.ai/best-ai-tools-for-the-construction-industry/
- Open-World Object Counting in Videos (Dedup/Tracking): https://arxiv.org/abs/2506.15368
- Joint Counting, Detection & Re-Identification: https://arxiv.org/abs/2212.05861
- Zähl-Halluzinationen bei VLMs / Hybrid nötig (GroundCount): https://arxiv.org/pdf/2603.10978
- Indoor-Positionierung BLE/UWB/Visual im Vergleich: https://www.ariadne.inc/resources/blogs/indoor-positioning-technology-comparison/ , https://www.pointr.tech/blog/bluetooth-vs-ultra-wideband-which-technology-to-use-for-indoor-location
- iPhone-LiDAR-Genauigkeit für Bau: https://www.simplywise.com/blog/iphone-lidar-construction-accuracy/
- Reality Capture & MEP (Verdeckung, BIM-Abgleich): https://www.faro.com/en/Resource-Library/Article/Reality-Capture-and-MEP-in-Building-Construction
