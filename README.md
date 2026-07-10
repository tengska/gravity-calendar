# Gravity Calendar - Suomen Gravity MTB Tapahtumat 2026

Selainpohjainen sovellus, joka kokoaa Suomen gravity-maastopyöräilytapahtumat yhteen paikkaan. Näyttää tapahtumat kolmesta eri sarjasta ja hakee reaaliaikaisen sääennusteen tapahtumapaikoille.

## Sovelluksen linkki

GitHub: [tengska/gravity-calendar](https://github.com/tengska/gravity-calendar)

Netlify: [gravitycalendar.netlify.app](https://gravitycalendar.netlify.app/)

## Ominaisuudet

- **Tapahtumakalenteri** - Suomi DH Cup, Finnish Enduro Cup ja MTB Rally 2026 tapahtumat
- **Teemanvalitsin** - vaalea/tumma teema, valittavissa kaikilla laitteilla; valinta tallentuu selaimeen ja oletusarvona käytetään laitteen järjestelmäasetusta
- **Suodattimet** - filtteröi sarjan, lajin, kuukauden ja tilan mukaan
- **Lajittelu** - järjestä tapahtumat päivämäärän tai sarjan mukaan
- **Tekstihaku** - etsi tapahtumia nimen, paikan tai järjestäjän perusteella
- **Kortti-, lista- ja karttanäkymä** - kolme eri tapaa tarkastella tapahtumia (kartta Leaflet-kirjastolla)
- **Kuukausierottimet** - tapahtumat ryhmitellään kuukauden mukaan kaikissa näkymissä
- **Sääennuste** - hakee Open-Meteo API:sta reaaliaikaisen sääennusteen tapahtumapaikoille (max 16 vrk)
- **Historiallinen sää** - näyttää viime vuoden sään samoille päiville, kun ennuste ei ole saatavilla
- **Ehdota tapahtumaa / Palaute** - lomakkeet Netlify Forms -palvelulla
- **Suodattimien tyhjennys** - nollaa kaikki suodattimet yhdellä klikkauksella
- **Animaatiot** - korttien sisääntulo- ja scroll-animaatiot, hover-efektit
- **Responsiivinen** - toimii mobiililla ja työpöydällä

## Teknologiat

- **HTML5, CSS3, JavaScript**
- **jQuery 3.7.1** - DOM-käsittely, tapahtumakuuntelijat, AJAX-kutsut
- **Bootstrap 5.3.3 + Bootstrap Icons** - UI-komponentit (modaalit, napit, lomakkeet, grid), sekä sisäänrakennettu vaalea/tumma-teematuki (`data-bs-theme`)
- **Leaflet 1.9.4** - interaktiivinen karttanäkymä OpenStreetMap-pohjalla
- **AOS 2.3.4** - Animate On Scroll -kirjasto
- **Open-Meteo API** - ilmainen sää-API (ei vaadi API-avainta)
- **Google Fonts** - Outfit + Space Mono

## Teemanvalitsin

Oikeassa yläkulmassa oleva painike vaihtaa sivun `<html>`-elementin `data-bs-theme`-attribuutin arvoksi `light` tai `dark`. CSS-muuttujat (`style.css`, `:root`) on määritelty molemmille teemoille, ja Bootstrapin omat komponentit (modaalit, sulkemispainikkeet) seuraavat samaa attribuuttia automaattisesti. Valinta tallennetaan `localStorage`-avaimeen `gc-theme`, ja ensimmäisellä käynnillä käytetään selaimen `prefers-color-scheme`-asetusta. Teeman asetus tapahtuu heti `<head>`:ssä ennen sivun piirtoa, jotta väärä teema ei välähdä latauksen aikana.

## API-kutsut

1. **events.json** - staattinen tapahtumatiedosto (`$.getJSON`)
2. **Open-Meteo Forecast API** - `https://api.open-meteo.com/v1/forecast` (live REST API)
3. **Open-Meteo Archive API** - `https://archive-api.open-meteo.com/v1/archive` (historiallinen säädata)

## Tietolähteet

| Sarja | Lähde |
|-------|-------|
| Suomi DH Cup | [pyoraily.fi](https://pyoraily.fi/tapahtumat-ja-kilpailut/suomi-dh-cup/) |
| Finnish Enduro Cup | [eba.mtb-enduro.fi](https://eba.mtb-enduro.fi/kilpailut/) |
| MTB Rally | [mtbrally.com](https://www.mtbrally.com/fi/calendar) |
| Säädata | [Open-Meteo](https://open-meteo.com/) |
| Karttadata | [OpenStreetMap](https://www.openstreetmap.org/) |

## Projektin rakenne

```
/
  index.html      # Pääsivu (Bootstrap-komponentit, jQuery/Leaflet/AOS CDN)
  style.css       # Tyylit (CSS-muuttujat molemmille teemoille + Bootstrap-ylikirjoitukset)
  app.js          # Sovelluslogiikka (jQuery AJAX, filtterit, sää, teemanvalitsin)
  events.json     # Tapahtumatiedot
  README.md       # Tämä tiedosto
```

## Tapahtumadatan päivittäminen

Tapahtumatiedot ovat `events.json`-tiedostossa. Päivittäminen:

1. Muokkaa `events.json` GitHubissa
2. Netlify deployaa muutoksen automaattisesti

## Tekijä

Karla Tengström

## Tulevaisuuden parannusehdotukset

- **GitHub Action** - automaattinen events.json-päivitys, joka tarkistaa lähdesivustot muutoksien tai uusien tapahtumien varalta ja päivittää datan ilman manuaalista työtä
- **Kansainväliset kisat** - laajentaminen kattamaan myös kansainväliset gravity-tapahtumat (esim. UCI DH World Cup, EWS)
