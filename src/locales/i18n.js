// Full Multilingual (i18n) Dictionary based on Materialtracker_Prototyp_v4.html

export const LANGUAGES = [
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'ro', label: 'RO', name: 'Română' },
  { code: 'pl', label: 'PL', name: 'Polski' },
  { code: 'hr', label: 'HR', name: 'Hrvatski' },
];

export const TRANSLATIONS = {
  // Navigation & General
  back: { de: 'Räume', ro: 'Încăperi', pl: 'Pomieszczenia', hr: 'Prostorije' },
  backShort: { de: 'Zurück', ro: 'Înapoi', pl: 'Wstecz', hr: 'Natrag' },
  cancel: { de: 'Abbrechen', ro: 'Anulează', pl: 'Anuluj', hr: 'Odustani' },
  save: { de: 'Speichern', ro: 'Salvează', pl: 'Zapisz', hr: 'Spremi' },
  delete: { de: 'Löschen', ro: 'Șterge', pl: 'Usuń', hr: 'Obriši' },
  ok: { de: 'OK', ro: 'OK', pl: 'OK', hr: 'U redu' },
  confirm: { de: 'Bestätigen', ro: 'Confirmă', pl: 'Potwierdź', hr: 'Potvrdi' },

  // Header & Status
  kw: { de: 'KW', ro: 'Săpt.', pl: 'Tydz.', hr: 'Tj.' },
  online: { de: 'Online', ro: 'Online', pl: 'Online', hr: 'Online' },
  offline: { de: 'Offline', ro: 'Offline', pl: 'Offline', hr: 'Offline' },
  syncBtn: { de: 'Sync', ro: 'Sincronizare', pl: 'Synchronizuj', hr: 'Sinkronizacija' },
  monteur: { de: 'Monteur', ro: 'Montator', pl: 'Monter', hr: 'Monter' },
  syncing: { de: 'Synchronisiere...', ro: 'Se sincronizează...', pl: 'Synchronizowanie...', hr: 'Sinkronizacija...' },

  // Project & Rooms Overview
  projTitle: { de: 'Wöchentliches Aufmaß', ro: 'Măsurare săptămânală', pl: 'Cotygodniowy obmiar', hr: 'Tjedni obračun' },
  projSub: { de: 'Wähle den Raum, in dem du diese Woche Material verbaut hast.', ro: 'Alege încăperea în care ai montat material săptămâna aceasta.', pl: 'Wybierz pomieszczenie, w którym w tym tygodniu zamontowałeś materiał.', hr: 'Odaberi prostoriju u kojoj si ovaj tjedan ugradio materijal.' },
  roomsSect: { de: 'Räume · Bauabschnitte', ro: 'Încăperi · Sectoare', pl: 'Pomieszczenia · Etapy', hr: 'Prostorije · Faze' },
  totalProgress: { de: 'Gesamtfortschritt', ro: 'Progres total', pl: 'Całkowity postęp', hr: 'Ukupni napredak' },
  installedValue: { de: 'Verbauter Wert', ro: 'Valoare montată', pl: 'Zainstalowana wartość', hr: 'Ugrađena vrijednost' },
  deliveredValue: { de: 'Geliefert', ro: 'Livrat', pl: 'Dostarczone', hr: 'Isporučeno' },

  // Booking Screen
  bookHead: { de: 'Ausbuchen, was verbaut wurde', ro: 'Înregistrează ce s-a montat', pl: 'Odpisz, co zostało zamontowane', hr: 'Otpiši ono što je ugrađeno' },
  addLabel: { de: 'Material suchen oder wählen', ro: 'Caută sau alege material', pl: 'Szukaj lub wybierz materiał', hr: 'Pretraži ili odaberi materijal' },
  searchPlaceholder: { de: 'Position suchen – z. B. 1.002, Rohr, Bogen, Schelle...', ro: 'Caută poziție – de ex. 1.002, țeavă, cot, brățară...', pl: 'Szukaj pozycji – np. 1.002, rura, kolano, obejma...', hr: 'Pretraži stavku – npr. 1.002, cijev, koljeno, obujmica...' },
  gLief: { de: 'geliefert', ro: 'livrat', pl: 'dostarczone', hr: 'isporučeno' },
  gBer: { de: 'bereits', ro: 'deja', pl: 'już', hr: 'već' },
  gRest: { de: 'Rest', ro: 'rest', pl: 'pozostało', hr: 'ostatak' },
  perWeek: { de: 'diese Woche', ro: 'săpt. aceasta', pl: 'w tym tyg.', hr: 'ovaj tj.' },
  empty: { de: 'Noch kein Material in diesem Raum erfasst. Wähle oben eine Position.', ro: 'Încă nu s-a înregistrat material în această încăpere. Alege o poziție sus.', pl: 'Brak materiałów w tym pomieszczeniu. Wybierz pozycję u góry.', hr: 'Još nema materijala u ovoj prostoriji. Odaberi stavku gore.' },
  overLimit: { de: 'über Soll/LV', ro: 'peste deviz', pl: 'ponad kosztorys', hr: 'preko troškovnika' },
  toPhotos: { de: 'Weiter zu Fotos ›', ro: 'Mai departe la poze ›', pl: 'Dalej do zdjęć ›', hr: 'Dalje na fotografije ›' },

  // Units
  unitPieces: { de: 'Stück (Menge)', ro: 'Bucăți (buc)', pl: 'Sztuki (szt)', hr: 'Komadi (kom)' },
  unitMeters: { de: 'Meter (Meterzahl)', ro: 'Metri (m)', pl: 'Metry (m)', hr: 'Metri (m)' },
  unitPcsShort: { de: 'Stk', ro: 'buc', pl: 'szt', hr: 'kom' },
  unitMShort: { de: 'm', ro: 'm', pl: 'm', hr: 'm' },

  // Card 4-Metric Matrix
  matrixDelivered: { de: 'Geliefert', ro: 'Livrat', pl: 'Dostarczone', hr: 'Isporučeno' },
  matrixPlanned: { de: 'Geplant', ro: 'Planificat', pl: 'Planowane', hr: 'Planirano' },
  matrixInstalled: { de: 'Verbaut', ro: 'Montat', pl: 'Zamontowane', hr: 'Ugrađeno' },
  matrixRemaining: { de: 'Rest', ro: 'Rest', pl: 'Pozostało', hr: 'Ostatak' },
  matrixTotal: { de: 'Gesamt', ro: 'Total', pl: 'Łącznie', hr: 'Ukupno' },
  matrixRoom: { de: 'Raum', ro: 'Încăpere', pl: 'Pomieszczenie', hr: 'Prostorija' },
  matrixOnlyGaeb: { de: 'Nur GAEB', ro: 'Doar deviz', pl: 'Tylko przedmiar', hr: 'Samo troškovnik' },
  matrixInRoom: { de: 'In Raum', ro: 'În încăpere', pl: 'W pomieszczeniu', hr: 'U prostoriji' },
  matrixOpen: { de: 'Offen', ro: 'Deschis', pl: 'Otwarte', hr: 'Otvoreno' },
  matrixOver: { de: 'Über Soll', ro: 'Peste plan', pl: 'Ponad plan', hr: 'Preko plana' },

  // Search & Ordering
  foundPositionsHeader: { de: 'Gefundene Positionen (Klick verschiebt nach ganz oben):', ro: 'Poziții găsite (click mută sus):', pl: 'Znalezione pozycje (kliknij, aby przenieść na górę):', hr: 'Pronađene stavke (klik premješta na vrh):' },
  moveToTop: { de: 'Nach oben', ro: 'Sus', pl: 'Na górę', hr: 'Na vrh' },

  // Unclear items
  unclearBtn: { de: 'Position unklar – trotzdem erfassen', ro: 'Poziție neclară – înregistrează oricum', pl: 'Pozycja niejasna – zapisz mimo to', hr: 'Nejasna stavka – ipak unesi' },
  unclearBtnShort: { de: 'Pos. unklar', ro: 'Poz. neclară', pl: 'Poz. niejasna', hr: 'Nejasno' },
  completeBtnShort: { de: 'Monteur fertig', ro: 'Montator gata', pl: 'Monter gotowy', hr: 'Monter završio' },
  unclearTitle: { de: 'Unklare Position', ro: 'Poziție neclară', pl: 'Pozycja niejasna', hr: 'Nejasna stavka' },
  unclearWhat: { de: 'Was wurde verbaut? (z. B. 20 Rohrschellen DN 100)', ro: 'Ce s-a montat? (de ex. 20 brățări DN 100)', pl: 'Co zamontowano? (np. 20 obejm DN 100)', hr: 'Što je ugrađeno? (npr. 20 obujmica DN 100)' },
  unclearWhatLabel: { de: 'Was wurde verbaut? (Artikel oder Freitext)', ro: 'Ce s-a montat? (articol sau text liber)', pl: 'Co zamontowano? (artykuł lub tekst)', hr: 'Što je ugrađeno? (artikl ili slobodni tekst)' },
  unclearWhatPlaceholder: { de: 'z. B. Rohrschellen, Bogen, Kugelhahn...', ro: 'de ex. brățări țeavă, cot, robinet...', pl: 'np. obejmy do rur, kolano, zawór...', hr: 'npr. obujmice, koljeno, kuglasti ventil...' },
  unclearSelectUnit: { de: 'Einheit wählen', ro: 'Alege unitatea', pl: 'Wybierz jednostkę', hr: 'Odaberi jedinicu' },
  unclearQtyPiecePlaceholder: { de: 'Menge in Stück (z. B. 10)', ro: 'Cantitate în bucăți (de ex. 10)', pl: 'Ilość w sztukach (np. 10)', hr: 'Količina u komadima (npr. 10)' },
  unclearQtyMeterPlaceholder: { de: 'Meterzahl (z. B. 12.5)', ro: 'Număr de metri (de ex. 12.5)', pl: 'Liczba metrów (np. 12.5)', hr: 'Broj metara (npr. 12.5)' },
  unclearOrderedSuggestions: { de: 'Bestellte / GAEB-Positionen:', ro: 'Poziții comandate / din deviz:', pl: 'Pozycje zamówione / z przedmiaru:', hr: 'Naručene / troškovničke stavke:' },
  unclearOrderedBadge: { de: 'Bestellt', ro: 'Comandat', pl: 'Zamówione', hr: 'Naručeno' },
  unclearQty: { de: 'Menge (z. B. 20 Stk)', ro: 'Cantitate (de ex. 20 buc)', pl: 'Ilość (np. 20 szt)', hr: 'Količina (npr. 20 kom)' },
  unclearRecord: { de: 'Als unklar erfassen', ro: 'Înregistrează ca neclar', pl: 'Zapisz jako niejasne', hr: 'Unesi kao nejasno' },
  unclearSection: { de: 'Zuordnung offen – Projektleiter ordnet zu', ro: 'Alocare deschisă – șeful de proiect alocă', pl: 'Do przypisania – kierownik przypisze', hr: 'Otvoreno dodjeljivanje – voditelj dodjeljuje' },
  unclearSubInfo: { de: 'Erfassen Sie ein verbautes Produkt. Beim Tippen werden auch bereits bestellte Materialien vorgeschlagen.', ro: 'Înregistrează un produs montat. La tastare se vor sugera și materialele deja comandate.', pl: 'Zapisz zamontowany produkt. Podczas wpisywania wyświetlą się zamówione materiały.', hr: 'Zabilježi ugrađeni proizvod. Tijekom tipkanja predlažu se već naručeni materijali.' },
  unclearOpenBadge: { de: 'Zuordnung offen', ro: 'Alocare deschisă', pl: 'Do przypisania', hr: 'Otvoreno' },

  // Mehrverbrauch / Over-Consumption Fullscreen Overlay
  overTitle: { de: 'Mehraufwand / Mehrverbrauch', ro: 'Consum suplimentar / Mehraufwand', pl: 'Dodatkowy nakład / zużycie', hr: 'Dodatni rad / potrošnja' },
  overPlannedRoom: { de: 'Geplant Raum', ro: 'Planificat încăpere', pl: 'Plan pomieszczenia', hr: 'Planirano u prostoriji' },
  overNewInstalled: { de: 'Neu verbaut', ro: 'Nou montat', pl: 'Nowo zamontowane', hr: 'Novo ugrađeno' },
  overExcess: { de: 'Mehrverbrauch', ro: 'Consum suplimentar', pl: 'Nadmierne zużycie', hr: 'Dodatna potrošnja' },
  overExtraQtyLabel: { de: 'Zusätzlich benötigte Menge:', ro: 'Cantitate suplimentară necesară:', pl: 'Dodatkowo potrzebna ilość:', hr: 'Dodatno potrebna količina:' },
  overQuickLabel: { de: 'Schnellauswahl für Mehraufwand:', ro: 'Selectare rapidă supliment:', pl: 'Szybki wybór:', hr: 'Brzi odabir:' },
  overReasonLabel: { de: 'Grund für Bauleiter & Nachtrag wählen:', ro: 'Alege motivul pentru șeful de șantier:', pl: 'Wybierz powód dla kierownika budowy:', hr: 'Odaberi razlog za voditelja gradilišta:' },
  overDetailReasonLabel: { de: 'Detail-Begründung (3 Zeilen für Baustellen-Notizen):', ro: 'Justificare detaliată (3 rânduri pentru note de șantier):', pl: 'Szczegółowe uzasadnienie (3 linie notatki):', hr: 'Detaljno obrazloženje (3 retka za bilješke):' },
  overCommentPlaceholder: { de: 'Begründung für Mehraufwand eingeben (erscheint im Bauleiter-Dashboard)...', ro: 'Introdu justificarea suplimentului (apare în tabloul de bord)...', pl: 'Wpisz uzasadnienie dodatkowego nakładu...', hr: 'Unesi obrazloženje dodatnog rada...' },
  overConfirmBtn: { de: '✓ Mehraufwand buchen', ro: '✓ Înregistrează suplimentul', pl: '✓ Zapisz dodatkowy nakład', hr: '✓ Uknjiži dodatni rad' },
  overConsumptionBadge: { de: 'Mehrverbrauch', ro: 'Consum suplimentar', pl: 'Nadmierne zużycie', hr: 'Dodatna potrošnja' },
  overRecorded: { de: 'Mehrverbrauch erfasst', ro: 'Consum suplimentar înregistrat', pl: 'Zarejestrowano nadmierne zużycie', hr: 'Zabilježena dodatna potrošnja' },

  // Reasons
  reasonPlanChange: { de: 'Planänderung Bauherr', ro: 'Modificare plan beneficiar', pl: 'Zmiana planu przez inwestora', hr: 'Izmjena plana investitora' },
  reasonObstacle: { de: 'Altbau-Hindernis / Versprung', ro: 'Obstacol clădire veche / deviere', pl: 'Przeszkoda / uskok w starym budynku', hr: 'Prepreka u staroj zgradi / skok' },
  reasonDamage: { de: 'Verschnitt / Beschädigung', ro: 'Pierderi la tăiere / deteriorare', pl: 'Odpady / uszkodzenie', hr: 'Otpad / oštećenje' },
  reasonExtraConn: { de: 'Zusätzlicher Anschluss', ro: 'Racord suplimentar', pl: 'Dodatkowe podłączenie', hr: 'Dodatni priključak' },

  // Complete Room (Monteur fertig) Modal
  completeModalTitle: { de: 'Monteur fertig melden', ro: 'Raportează montator gata', pl: 'Zgłoś monter gotowy', hr: 'Prijavi monter završio' },
  completeModalSub: { de: 'Raumabschluss & Delta-Erfassung', ro: 'Finalizare încăpere & înregistrare diferențe', pl: 'Zakończenie i rejestracja różnic', hr: 'Završetak prostorije i evidentiranje razlika' },
  completeNoticeText: { de: 'Die Fertigstellung meldet den Raum als fertiggestellt. Das Mengen-Delta (Minder- oder Mehrverbrauch) wird für den Bauleiter im Admin-Panel zur VOB-Abrechnung hinterlegt:', ro: 'Finalizarea raportează încăperea ca finalizată. Diferența de cantitate (economie sau consum suplimentar) este salvată pentru șeful de șantier în panoul admin pentru decontare:', pl: 'Zakończenie zgłasza pomieszczenie jako gotowe. Różnica ilościowa (mniejsze lub większe zużycie) zostanie zapisana w panelu kierownika do rozliczenia:', hr: 'Završetak prijavljuje prostoriju kao završenu. Razlika u količini (manja ili veća potrošnja) sprema se za voditelja gradilišta u administratorskoj ploči:' },
  completeDelta: { de: 'Delta', ro: 'Diferență', pl: 'Różnica', hr: 'Razlika' },
  completeUnder: { de: 'Minderverbrauch (Einsparung)', ro: 'Economie / consum redus', pl: 'Mniejsze zużycie (oszczędność)', hr: 'Manja potrošnja (ušteda)' },
  completeOver: { de: 'Mehrverbrauch (Nachtrag)', ro: 'Consum suplimentar (supliment)', pl: 'Nadmierne zużycie (dodatek)', hr: 'Dodatna potrošnja (dodatak)' },
  completeExact: { de: 'Exakt wie geplant', ro: 'Exact conform planului', pl: 'Dokładnie wg planu', hr: 'Točno prema planu' },
  completeRoomConfirm: { de: 'Jetzt als „Monteur fertig“ abschließen', ro: 'Finalizează acum ca „Montator gata”', pl: 'Zakończ teraz jako „Monter gotowy”', hr: 'Završi sada kao „Monter završio”' },
  roomCompletedTitle: { de: 'Monteur fertig gemeldet', ro: 'Montator gata raportat', pl: 'Zgłoszono monter gotowy', hr: 'Monter završio prijavljeno' },
  roomCompletedSub: { de: 'Mengen-Delta im Bauleiter-Admin-Panel hinterlegt', ro: 'Diferența de cantitate salvată în panoul admin', pl: 'Różnica ilościowa zapisana w panelu kierownika', hr: 'Razlika u količini spremljena u administratorskoj ploči' },
  photosRequiredTitle: { de: 'Fotos erforderlich', ro: 'Poze obligatorii', pl: 'Wymagane zdjęcia', hr: 'Potrebne fotografije' },
  photosRequiredMsg: { de: 'Bevor Sie „Monteur fertig“ melden können, müssen zuerst Fotos für diesen Raum aufgenommen werden.', ro: 'Înainte de a raporta „Montator gata”, trebuie să faceți fotografii pentru această încăpere.', pl: 'Zanim zgłosisz „Monter gotowy”, musisz najpierw zrobić zdjęcia dla tego pomieszczenia.', hr: 'Prije nego što prijavite „Monter završio”, morate prvo napraviti fotografije za ovu prostoriju.' },
  maxDeliveryReached: { de: 'Liefermenge erreicht', ro: 'Cantitate livrată atinsă', pl: 'Osiągnięto limit dostawy', hr: 'Isporučena količina dosegnuta' },
  maxDeliveryReachedMsg: { de: 'Für dieses Material wurden insgesamt nur {delivered} {qu} geliefert. Mehrverbrauch ist nur bis zur gelieferten Menge möglich. Weiterer Bedarf muss als Nachtrag bestellt werden.', ro: 'Pentru acest material s-au livrat doar {delivered} {qu} în total. Consumul suplimentar este posibil doar până la cantitatea livrată. Necesarul suplimentar trebuie comandat ca supliment.', pl: 'Dla tego materiału dostarczono łącznie tylko {delivered} {qu}. Nadmierne zużycie jest możliwe tylko do ilości dostarczonej. Dalsze zapotrzebowanie należy zamówić jako dodatek.', hr: 'Za ovaj materijal ukupno je isporučeno samo {delivered} {qu}. Dodatna potrošnja moguća je samo do isporučene količine. Dodatne potrebe moraju se naručiti kao dodatak.' },
  noOverPossible: { de: 'Kein Mehrverbrauch möglich', ro: 'Consum suplimentar imposibil', pl: 'Brak możliwości nadmiernego zużycia', hr: 'Nije moguća dodatna potrošnja' },
  noOverPossibleMsg: { de: 'Die gelieferte Gesamtmenge ({delivered} {qu}) ist bereits voll verplant ({planned} {qu}). Zusätzlicher Bedarf muss als Nachtrag angelegt werden.', ro: 'Cantitatea livrată ({delivered} {qu}) este deja planificată integral ({planned} {qu}). Necesarul suplimentar trebuie creat ca supliment.', pl: 'Dostarczona ilość ({delivered} {qu}) jest już w pełni zaplanowana ({planned} {qu}). Dodatkowe zapotrzebowanie należy utworzyć jako dodatek.', hr: 'Isporučena količina ({delivered} {qu}) već je u potpunosti planirana ({planned} {qu}). Dodatna potreba mora se unijeti kao dodatak.' },
  maxAvailableDelivery: { de: 'Max. aus Lieferung verfügbar:', ro: 'Max. disponibil din livrare:', pl: 'Maks. dostępne z dostawy:', hr: 'Maks. dostupno iz isporuke:' },

  // Nachtrag / Reorder
  nachtrag: { de: 'Nachtrag', ro: 'Supliment', pl: 'Dodatek', hr: 'Dodatak' },
  nachtragTitle: { de: 'Nachtrag erfassen', ro: 'Adaugă supliment', pl: 'Dodaj dodatek', hr: 'Unesi dodatak' },
  typeMat: { de: 'Material', ro: 'Material', pl: 'Materiał', hr: 'Materijal' },
  typeStd: { de: 'Arbeitszeit', ro: 'Timp de lucru (ore)', pl: 'Czas pracy (godz.)', hr: 'Radno vrijeme (sati)' },
  fldTaetigkeit: { de: 'Tätigkeit / Grund', ro: 'Activitate / motiv', pl: 'Czynność / powód', hr: 'Radnja / razlog' },
  fldStunden: { de: 'Stunden (z. B. 2,5 h)', ro: 'Ore (de ex. 2,5 h)', pl: 'Godziny (np. 2,5 h)', hr: 'Sati (npr. 2,5 h)' },
  reMat: { de: 'Material / Artikel', ro: 'Material / articol', pl: 'Materiał / artykuł', hr: 'Materijal / artikl' },
  reQty: { de: 'Menge (z. B. 2 Stk)', ro: 'Cantitate (de ex. 2 buc)', pl: 'Ilość (np. 2 szt)', hr: 'Količina (npr. 2 kom)' },
  reBest: { de: 'Besteller / Ansprechpartner', ro: 'Solicitant / contact', pl: 'Zamawiający / kontakt', hr: 'Naručitelj / kontakt' },
  reNote: { de: 'Notiz / Begründung', ro: 'Notă / justificare', pl: 'Notatka / uzasadnienie', hr: 'Napomena / obrazloženje' },
  reCreate: { de: 'Nachtrag anlegen', ro: 'Creează supliment', pl: 'Utwórz dodatek', hr: 'Kreiraj dodatak' },
  reCreateHours: { de: 'Arbeitszeit erfassen', ro: 'Înregistrează orele de lucru', pl: 'Zapisz czas pracy', hr: 'Unesi radne sate' },
  signatureLabel: { de: 'Unterschrift', ro: 'Semnătură', pl: 'Podpis', hr: 'Potpis' },
  signatureSigned: { de: 'Unterschrieben', ro: 'Semnat', pl: 'Podpisano', hr: 'Potpisano' },
  signatureSignHere: { de: 'Hier mit dem Finger unterschreiben', ro: 'Semnează aici cu degetul', pl: 'Podpisz tutaj palcem', hr: 'Potpišite ovdje prstom' },
  signatureClear: { de: 'Löschen', ro: 'Șterge', pl: 'Wyczyść', hr: 'Obriši' },
  missingFieldsTitle: { de: 'Noch auszufüllen:', ro: 'De completat:', pl: 'Do uzupełnienia:', hr: 'Preostalo za ispuniti:' },
  fieldsComplete: { de: '✓ Alle Angaben vollständig – Nachtrag kann angelegt werden', ro: '✓ Toate datele sunt complete – suplimentul poate fi salvat', pl: '✓ Wszystkie dane kompletne – można utworzyć dodatek', hr: '✓ Svi podaci potpuni – dodatak se može kreirati' },
  nachtragOpen: { de: 'Bereits erfasste Nachträge', ro: 'Suplimente deja înregistrate', pl: 'Już zapisane dodatki', hr: 'Već uneseni dodaci' },

  // Photos
  photoTitle: { de: 'Rundum-Fotodokumentation', ro: 'Documentație foto de ansamblu', pl: 'Dokumentacja zdjęciowa', hr: 'Foto-dokumentacija uokolo' },
  photoSub: { de: 'Fotos je Zähl-Version sichern die Abrechnung und den Baufortschritt lückenlos ab.', ro: 'Pozele la fiecare numărare asigură dovada și decontarea lucrărilor.', pl: 'Zdjęcia przy każdym obmiarze zapewniają dowód i rozliczenie prac.', hr: 'Fotografije uz svaki obračun osiguravaju dokaz i obračun radova.' },
  addPhotoCamera: { de: 'Foto aufnehmen (Kamera)', ro: 'Fă o poză (Cameră)', pl: 'Zrób zdjęcie (Aparat)', hr: 'Uslikaj (Kamera)' },
  addPhotoGallery: { de: 'Aus Mediathek wählen', ro: 'Alege din galerie', pl: 'Wybierz z galerii', hr: 'Odaberi iz galerije' },
  photoCount: { de: '{n} Fotos hinterlegt', ro: '{n} poze atașate', pl: '{n} załączonych zdjęć', hr: '{n} priloženih fotografija' },
  photoBadge: { de: 'Foto', ro: 'Poză', pl: 'Zdjęcie', hr: 'Slika' },
  finishBooking: { de: 'Buchung abschließen ✓', ro: 'Finalizează înregistrarea ✓', pl: 'Zakończ wpis ✓', hr: 'Završi unos ✓' },

  // Done Screen
  doneTitle: { de: 'Erfolgreich gespeichert', ro: 'Salvat cu succes', pl: 'Pomyślnie zapisano', hr: 'Uspješno spremljeno' },
  doneSub: { de: 'Lokal im Belegjournal gesichert. Wird beim nächsten Sync automatisch übertragen.', ro: 'Salvat local în jurnal. Se va transmite automat la următoarea sincronizare.', pl: 'Zapisano lokalnie. Zostanie przesłane przy następnej synchronizacji.', hr: 'Spremljeno lokalno. Prenijet će se automatski kod sljedeće sinkronizacije.' },
  backToRooms: { de: 'Zurück zur Raumliste', ro: 'Înapoi la încăperi', pl: 'Wróć do pomieszczeń', hr: 'Natrag na popis prostorija' },

  // PIN & Auth
  pinTitle: { de: 'PIN eingeben', ro: 'Introdu codul PIN', pl: 'Wpisz kod PIN', hr: 'Unesi PIN' },
  pinSub: { de: '4-stelligen Monteur-PIN eingeben', ro: 'Introdu codul PIN din 4 cifre', pl: 'Wpisz 4-cyfrowy kod PIN', hr: 'Unesi 4-znamenkasti PIN' },
  pinWrong: { de: 'Falscher PIN. Bitte erneut versuchen.', ro: 'PIN incorect. Reîncearcă.', pl: 'Błędny PIN. Spróbuj ponownie.', hr: 'Pogrešan PIN. Pokušaj ponovno.' },
  setupTitle: { de: 'Monteur-Einrichtung', ro: 'Configurare montator', pl: 'Konfiguracja montera', hr: 'Postavljanje montera' },
  setupSub: { de: 'Bitte deinen Namen und einen 4-stelligen PIN für die App-Nutzung festlegen.', ro: 'Setează numele tău și un PIN din 4 cifre pentru utilizarea aplicației.', pl: 'Podaj swoje imię i 4-cyfrowy PIN do korzystania z aplikacji.', hr: 'Postavi svoje ime i 4-znamenkasti PIN za korištenje aplikacije.' },
  nameLabel: { de: 'Dein Name (Monteur)', ro: 'Numele tău (Montator)', pl: 'Twoje imię (Monter)', hr: 'Tvoje ime (Monter)' },
  pinLabel: { de: '4-stelliger PIN', ro: 'Cod PIN din 4 cifre', pl: '4-cyfrowy PIN', hr: '4-znamenkasti PIN' },
  startApp: { de: 'App starten', ro: 'Pornește aplicația', pl: 'Uruchom aplikację', hr: 'Pokreni aplikaciju' },

  // Alerts & Offline Sync
  offlineAlertTitle: { de: 'Offline-Modus aktiv', ro: 'Mod offline activ', pl: 'Tryb offline aktywny', hr: 'Izvanmrežni način aktivan' },
  offlineAlertMsg: { de: 'Keine Internetverbindung verfügbar. Bitte im Offline-Modus weiterarbeiten und später synchronisieren, sobald wieder Empfang da ist.', ro: 'Nu există conexiune la internet. Continuați în modul offline și sincronizați mai târziu, când aveți semnal.', pl: 'Brak połączenia z internetem. Kontynuuj w trybie offline i zsynchronizuj później, gdy pojawi się zasięg.', hr: 'Nema internetske veze. Nastavite raditi u izvanmrežnom načinu rada i sinkronizirajte kasnije čim budete imali signal.' },
  syncSuccessTitle: { de: 'Synchronisation erfolgreich', ro: 'Sincronizare reușită', pl: 'Synchronizacja udana', hr: 'Sinkronizacija uspješna' },
  syncSuccessMsg: { de: '{n} Buchungen wurden übertragen und der neueste Baustellenstand geladen.', ro: '{n} înregistrări au fost transferate și s-a descărcat stadiul actual al șantierului.', pl: '{n} wpisów zostało przesłanych i pobrano najnowszy stan budowy.', hr: '{n} unosa je preneseno i preuzeto je najnovije stanje gradilišta.' },
  syncNoPending: { de: 'Alle Buchungen sind bereits aktuell. Baustellenstand wurde aktualisiert.', ro: 'Toate înregistrările sunt deja la zi. Stadiul șantierului a fost actualizat.', pl: 'Wszystkie wpisy są aktualne. Stan budowy został zaktualizowany.', hr: 'Svi unosi su već ažurirani. Stanje gradilišta je osvježeno.' },
  syncUploading: { de: 'Buchungen und Fotos werden übertragen...', ro: 'Se încarcă înregistrările și pozele...', pl: 'Przesyłanie wpisów i zdjęć...', hr: 'Prijenos unosa i fotografija...' },
  syncDownloading: { de: 'Neueste Daten der Baustelle werden geladen...', ro: 'Se descarcă datele actualizate...', pl: 'Pobieranie najnowszych danych...', hr: 'Preuzimanje najnovijih podataka...' },
};

// Glossary for material categories & abbreviations (DE -> foreign translations)
export const GLOSSARY = {
  rohr: { ro: 'Țeavă', pl: 'Rura', hr: 'Cijev' },
  bogen: { ro: 'Cot', pl: 'Kolano', hr: 'Koljeno' },
  abzweig: { ro: 'Ramificație', pl: 'Odgałęzienie', hr: 'Odvojak' },
  reduzierung: { ro: 'Reducție', pl: 'Redukcja', hr: 'Redukcija' },
  schelle: { ro: 'Brățară', pl: 'Obejma', hr: 'Obujmica' },
  ventil: { ro: 'Robinet', pl: 'Zawór', hr: 'Ventil' },
  muffe: { ro: 'Mufă', pl: 'Mufa', hr: 'Mufa' },
  isolierung: { ro: 'Izolație', pl: 'Izolacja', hr: 'Izolacija' },
};

export function t(key, lang = 'de', vars = {}) {
  const item = TRANSLATIONS[key];
  let text = (item && (item[lang] || item['de'])) || key;
  if (vars && typeof vars === 'object') {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return text;
}
