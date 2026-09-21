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

  // Unclear items
  unclearBtn: { de: 'Position unklar – trotzdem erfassen', ro: 'Poziție neclară – înregistrează oricum', pl: 'Pozycja niejasna – zapisz mimo to', hr: 'Nejasna stavka – ipak unesi' },
  unclearTitle: { de: 'Unklare Position', ro: 'Poziție neclară', pl: 'Pozycja niejasna', hr: 'Nejasna stavka' },
  unclearWhat: { de: 'Was wurde verbaut? (z. B. 20 Rohrschellen DN 100)', ro: 'Ce s-a montat? (de ex. 20 brățări DN 100)', pl: 'Co zamontowano? (np. 20 obejm DN 100)', hr: 'Što je ugrađeno? (npr. 20 obujmica DN 100)' },
  unclearQty: { de: 'Menge (z. B. 20 Stk)', ro: 'Cantitate (de ex. 20 buc)', pl: 'Ilość (np. 20 szt)', hr: 'Količina (npr. 20 kom)' },
  unclearRecord: { de: 'Als unklar erfassen', ro: 'Înregistrează ca neclar', pl: 'Zapisz jako niejasne', hr: 'Unesi kao nejasno' },
  unclearSection: { de: 'Zuordnung offen – Projektleiter ordnet zu', ro: 'Alocare deschisă – șeful de proiect alocă', pl: 'Do przypisania – kierownik przypisze', hr: 'Otvoreno dodjeljivanje – voditelj dodjeljuje' },

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
  nachtragOpen: { de: 'Bereits erfasste Nachträge', ro: 'Suplimente deja înregistrate', pl: 'Już zapisane dodatki', hr: 'Već uneseni dodaci' },

  // Photos
  photoTitle: { de: 'Rundum-Fotodokumentation', ro: 'Documentație foto de ansamblu', pl: 'Dokumentacja zdjęciowa', hr: 'Foto-dokumentacija uokolo' },
  photoSub: { de: 'Fotos je Zähl-Version sichern die Abrechnung und den Baufortschritt lückenlos ab.', ro: 'Pozele la fiecare numărare asigură dovada și decontarea lucrărilor.', pl: 'Zdjęcia przy każdym obmiarze zapewniają dowód i rozliczenie prac.', hr: 'Fotografije uz svaki obračun osiguravaju dokaz i obračun radova.' },
  addPhotoCamera: { de: 'Foto aufnehmen (Kamera)', ro: 'Fă o poză (Cameră)', pl: 'Zrób zdjęcie (Aparat)', hr: 'Uslikaj (Kamera)' },
  addPhotoGallery: { de: 'Aus Mediathek wählen', ro: 'Alege din galerie', pl: 'Wybierz z galerii', hr: 'Odaberi iz galerije' },
  photoCount: { de: '{n} Fotos hinterlegt', ro: '{n} poze atașate', pl: '{n} załączonych zdjęć', hr: '{n} priloženih fotografija' },
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
