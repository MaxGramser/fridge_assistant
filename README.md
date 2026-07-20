# 🧊 Fridge Assistant

Een inventarissysteem voor je **koelkast, vriezer en voorraadkast** in Home Assistant.
Weet altijd *wat* er ligt, *sinds wanneer*, en *wat als eerste op moet*.

> Nederlands nu, i18n-ready (en/nl). Werkt volledig lokaal; AI-schattingen zijn optioneel.

## Wat het doet

- **Items toevoegen** met naam, inhoud, locatie (koelkast/vriezer/buiten), datum-erin en houdbaarheidsdatum.
- **Automatische houdbaarheid**: een ingebouwde database van veelvoorkomende producten/gerechten vult de datum automatisch in op basis van *wat erin zit* en *waar het ligt*.
- **AI-schatting** voor onbekende producten (via je bestaande Home Assistant conversation-agent, of een eigen OpenAI-key). Voeg het resultaat met één klik als eigen template toe.
- **Uniek item-code label** (`AB12`-stijl) per item — bedoeld om te matchen met een geprinte sticker.
- **Dashboard**: zie in één oogopslag wat er ligt en wat het eerst op moet.
- **Waarschuwingen**: event + persistent notification wanneer iets binnen X dagen over datum gaat (instelbaar).
- **Opruim-modus**: haal in één keer alles eruit dat niet meer goed is.
- **Print sticker**-knoppen overal (de daadwerkelijke printer is een optionele add-on — fase 2).

## Installatie (HACS)

1. HACS → Integraties → ⋮ → *Custom repositories* → deze repo toevoegen als **Integration**.
2. Installeer **Fridge Assistant** en herstart Home Assistant.
3. Instellingen → Apparaten & Services → *Integratie toevoegen* → **Fridge Assistant**.
4. Open **Koelkast** in de zijbalk.

## Optioneel: printer add-on (fase 2)

De integratie werkt volledig zonder printer. Wil je fysieke stickers printen (bv. Dymo LabelWriter),
dan komt er een aparte, optionele **Fridge Assistant Printer** add-on die de print-knoppen afhandelt.

## Licentie

MIT
