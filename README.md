# Custom Tuning · Platformă back-office (MVP)

MVP funcțional pentru validare cu clientul, înainte de implementarea completă.
Stack: **Vite + React 19 + TypeScript + Tailwind v4 + React Router + Zustand + FullCalendar**.
Datele sunt persistate local (localStorage + IndexedDB pentru poze) — fără backend, fără cont, deploy static.
Identitate vizuală preluată de pe customtuning.ro: **logo-ul oficial** (`src/assets/custom-tuning-logo*.png`,
variantă neagră pentru fundal deschis și albă pentru fundal închis, plus favicon), **temă deschisă** (alb/gri)
cu accent **roșu de brand**.

## Rulare

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ — se poate urca pe orice hosting static
npm run preview
```

Butonul **„Resetează demo”** (jos în sidebar) readuce datele la setul inițial.

## Module

| Modul | Ce face |
|---|---|
| **Dashboard** | KPI zi/lună, lucrări active, notificări scadente, stoc sub prag |
| **Programări** | **Calendar FullCalendar** (lună / săptămână / zi): press & drag peste zile sau ore = eveniment nou, drag & drop și resize, linie „acum”, filtre pe operator și pe strat (primire / execuție); plus listă filtrabilă |
| **Concedii** | Situația pe **toți angajații** (30 în demo): drept pro-rata din data angajării, zile consumate / planificate / în cerere / rămase, următoarele absențe, cereri de aprobat, conflicte cu programări — **doar owner și manager** |
| **Programare nouă** | Wizard: client → mașină → servicii (fișe detaliate) → primire mașină + fereastră de execuție cu estimare de manoperă |
| **Fișă programare** | Pipeline status, fișe servicii editabile, poze defecte, notificări, istoric, link tracking, fișă PDF |
| **Clienți** | PF/PJ (CNP, adresă, firmă, RO/CUI), mașini asociate, istoric lucrări și valoare |
| **Mașini** | Date tehnice (VIN, serie șasiu, motorizare), istoric lucrări, istoric folii aplicate |
| **Stoc** | Role cu **număr de rolă**, prag de alertă, +/− manual, jurnal mișcări; adăugare rapidă din **produse uzuale presetate** și **furnizori din listă** |
| **Notificări** | Coada de retușuri (7 zile lucrătoare + reminder la 3 zile), trimitere WhatsApp/email |
| **Rapoarte** | Încasări/lună, bază impozabilă + TVA colectat, servicii pe volum și valoare, top clienți, consum folie |
| **Setări** | Datele firmei (denumire, CUI) și regimul de TVA — **doar owner/manager** |
| **Tracking public** | Pagină fără cont pentru client: `#/tracking/<token>` |

## Cum acoperă specificațiile

- **Fișe servicii complete**, generate dintr-un catalog (`src/data/serviceCatalog.ts`) — acoperă și serviciile listate pe customtuning.ro
  (colantări, protecție ceramică, folii geamuri, folie protecție parbriz, chip tuning, detailing, bodykit/tuning, evacuări, jante, suspensii):
  colantare (PPF + folie de culoare, producător, finisaj, rolă, metri), jante (dimensiune, lățime, ET, anvelope),
  tuning (producător, element + **cod produs** per element), suspensii (cod suspensie, cod amortizor/arc pe fiecare colț,
  culoare marker sigiliu), evacuare, detailing (interior / exterior 1–3 pași), protecții ceramice (Krytex × 7, cu **cod sticlă**).
- **Elemente de caroserie** (bară față, grilă, lip, aripi, praguri, evazări, bară spate, diffuser, eleroane…) cu cod și observații per element, plus elemente adăugate ad-hoc.
- **Rolă din stoc bifată în fișă → numărul rolei se preia automat**, iar la trecerea în „Finalizat” metrii se scad din stoc și se scriu în jurnalul de mișcări.
- **Notificare retuș**: la finalizarea unei lucrări de colantare se programează automat SMS la **7 zile lucrătoare** (weekend-urile sunt sărite) + **reminder după încă 3 zile**.
- **Poze defecte** încărcate pe lucrare, cu trimitere către client pe email sau WhatsApp.
- **Client PF/PJ**: nume, prenume, CNP, adresă, denumire firmă, RO/CUI.

## Programare ≠ execuție

Sunt două lucruri diferite, cu momente diferite în calendar:

| | Ce este | Cum apare în calendar | Câmpuri |
|---|---|---|---|
| **Primire mașină** | când vine clientul cu mașina | bloc alb cu contur punctat, etichetă `PRIM` | `startAt`, `durationMin` (implicit 30 min) |
| **Execuție planificată** | fereastra de lucru din atelier | bloc plin colorat pe status, etichetă `EXEC` | `workStartAt`, `workEndAt`, `estimateMin` |
| **Execuție reală** | ce s-a întâmplat efectiv | — | `actualStartAt`, `actualEndAt` (butoanele ▶ Începe / ■ Finalizează) |

Execuția poate fi în aceeași zi cu primirea sau în altă zi (ex. mașina stă până vin piesele).
Ambele straturi se pot ascunde din bara de filtre a calendarului, iar fiecare se mută/redimensionează independent prin drag.

**Estimarea timpului de lucru** vine automat din serviciile alese (`estimateMin` per serviciu în catalog;
primul serviciu la 100%, restul la 85% pentru că echipa lucrează în paralel), rotunjită la sfert de oră.
Operatorul o poate suprascrie manual — atunci se marchează `estimateManual` și butonul „auto” o readuce la sugestie.
La final, fișa compară efectivul cu estimarea („în estimare” / „peste estimare”).

## Prețuri: RON și TVA

Moneda este **RON** peste tot (fișe, calendar, rapoarte, tracking, fișa PDF). Regimul de TVA se
configurează din **Setări** și se aplică global:

| Setare | Efect |
|---|---|
| Plătitor / neplătitor de TVA | La „neplătitor” dispare orice linie de TVA — se afișează doar prețul final |
| Cotă (21% implicit, și 11 / 9 / 5) | 21% e cota standard în România de la 1 august 2025 |
| Prețurile din fișe sunt cu TVA inclus / fără TVA | Decide dacă TVA-ul se **scoate** din prețul introdus sau se **adaugă** peste el |

Implicit: plătitor de TVA, 21%, prețuri finale cu TVA inclus (cazul obișnuit pentru clienți persoane fizice).
Totalul unei lucrări apare descompus — *Subtotal (fără TVA) · TVA 21% · Total de plată* — pe fișa programării,
în wizard și pe fișa PDF, iar în câmpul de preț din fișa de serviciu apare mereu cealaltă față a sumei
(„Bază 4.628,10 RON + TVA 971,90 RON”). Rapoartele arată separat baza impozabilă și TVA-ul colectat.

Calculul stă într-un singur loc (`src/lib/money.ts`), deci schimbarea cotei nu atinge niciun ecran.
Prețurile implicite din catalog sunt valori de piață în RON (ex. colantare integrală 8.900 RON, chip tuning 2.500 RON).

## Zile aglomerate

- **Lună**: max 3 evenimente pe zi, restul intră în „+N altele” (popover la click).
- **Săptămână / Zi**: evenimentele care se suprapun se așază pe coloane paralele (max 4 vizibile, restul în „+N”).
- **Filtre**: pe operator și pe strat (doar primiri sau doar execuții) — cea mai rapidă cale de a descâlci o zi plină.
- Statusul dă culoarea, deci într-o zi plină se vede dintr-o privire ce e în lucru, ce așteaptă piese și ce e doar programat.

## Concedii pentru o echipă mare

Ecranul e construit pentru ~30 de oameni, nu pentru 4 carduri:

- **Tabel cu toată echipa**: drept anual, consumate, planificate, în cerere, rămase (bară + culoare de risc),
  cu sortare (cele mai puține zile rămase, cele mai multe consumate, nume, vechime) și căutare.
- **Dreptul se calculează din data angajării**: 21 de zile lucrătoare pe an (configurabil per persoană,
  ucenicii cu minimul legal de 20), iar în anul angajării proporțional cu perioada lucrată.
- **Zilele se numără lucrător** — weekendurile nu consumă concediu.
- **Doar „concediu de odihnă” scade din sold**; medicalul, training-ul și zilele libere se urmăresc separat.
- **Următoarele absențe** (60 de zile) cu „mâine / în 3 zile / în curs”.
- **Cererile de aprobat au CTA**: cardul KPI duce direct în lista filtrată („Vezi cererile →”), tab-ul „În așteptare”
  are contor, există „Aprobă toate”, iar meniul din stânga arată un badge cu numărul de cereri din orice ecran.
- La adăugarea unei absențe se vede pe loc soldul persoanei și cât rămâne după cerere („depășește dreptul anual”).

## Stoc: adăugare rapidă

- **Produse uzuale** pe categorie (PPF SunTek/XPEL/STEK, folii Avery / 3M / KPMF / Inozetek, folii geam LLumar,
  ceramice Krytex, consumabile) — o alegere completează furnizor, denumire, lățime, finisaj, unitate, prag și raft.
- **Furnizorul se alege din listă** (presetați + cei deja folosiți în stoc), cu „Alt furnizor…” pentru cazuri noi.
- **Numărul de rolă e sugerat automat**: următorul liber din categorie (`R-12`, `C-22`, `G-03`, `KX-…`).
- Locațiile din depozit apar ca sugestii, iar unitatea se schimbă singură pe categorie (metri vs. bucăți).

## Roluri (demo)

Utilizatorul curent se schimbă din colțul stânga-jos al sidebar-ului:

| Rol | Vede concediile | Restul aplicației |
|---|---|---|
| Owner (Andrei) | da | tot, inclusiv Setări |
| Manager (Cosmin) | da | tot, inclusiv Setări |
| Operator (Robert, Daniel) | **nu** — meniul „Concedii” dispare, benzile din calendar nu se afișează, ruta directă e blocată | tot, mai puțin Setări (regimul de TVA) |

În producție rolul vine din autentificare, nu dintr-un selector.

## Ce am adăugat față de macheta inițială (propuneri)

1. **Calendar cu 3 vizualizări** (FullCalendar, MIT) — press & drag peste zile sau ore pentru un eveniment nou, drag & drop / resize pentru reprogramare, ca în Google Calendar.
2. **Separarea primire / execuție** + estimare automată de manoperă din servicii, cu suprascriere manuală și comparație estimat vs. efectiv.
3. **Client și mașină noi direct din modalul de programare** — fără să pierzi selecția din calendar.
4. **Catalog de servicii declarativ** — un serviciu nou sau un câmp nou înseamnă o intrare în catalog, nu ecran nou.
5. **Jurnal de stoc (mișcări)** — orice scădere e trasabilă la lucrare, cu autor și dată; fără el nu se poate face inventar.
6. **Cozi de notificări în loc de „trimite acum”** — retușul se programează la finalizare și rămâne în coadă până e marcat trimis.
7. **Istoric folii per mașină** — la retuș/garanție se vede instant ce folie și ce rolă au fost aplicate.
8. **Tracking public pe token** — reduce telefoanele „e gata mașina?”.
9. **Prag minim per produs** + alerte pe dashboard.
10. **Fișă PDF** prin print, cu stiluri dedicate.
11. **Căutare globală** (client, mașină, nr. înmatriculare, cod programare).
12. **RON + TVA configurabil** dintr-un singur loc, cu descompunere bază / TVA / total pe fiecare lucrare.
13. **Sold de concediu calculat**, nu ținut de mână — din data angajării, în zile lucrătoare.
14. **Stoc cu presetări** (produse uzuale + furnizori + număr de rolă sugerat) — adăugarea durează câteva secunde.

## Limite cunoscute ale MVP-ului (de rezolvat la implementarea completă)

- **Fără backend**: datele stau în browserul curent. Un al doilea utilizator nu vede aceleași date.
  De adăugat: API + bază de date (Postgres), autentificare și roluri (admin / operator).
- **SMS/WhatsApp/email se trimit manual** din coada de notificări. De conectat gateway SMS (Twilio / SMSO)
  + WhatsApp Business API + un job programat care trimite automat la scadență.
- **Pozele** stau în IndexedDB local; în producție merg în object storage, cu trimitere oficială către client.
- Fără facturare, fără contract PDF semnat, fără import/export.

## Structură

```
src/
  data/       tipuri, catalog servicii, seed demo, store (zustand + persist)
  components/ UI kit, layout, calendar, formular servicii, modale
  pages/      un fișier per ecran
  lib/        utilitare (date, format, poze IndexedDB)
```
