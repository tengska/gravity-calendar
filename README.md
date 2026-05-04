# Gravity Calendar -- Suomen Gravity MTB Tapahtumat 2026

Selainpohjainen sovellus, joka kokoaa Suomen gravity-maastopyöräilytapahtumat yhteen paikkaan. Näyttää tapahtumat kolmesta eri sarjasta ja hakee reaaliaikaisen sääennusteen tapahtumapaikoille.

## Sovelluksen linkki

GitHub: [tengska/gravity-calendar](https://github.com/tengska/gravity-calendar)

Netlify: [gravitycalendar.netlify.app](https://gravitycalendar.netlify.app/)

## Ominaisuudet

- **Tapahtumakalenteri** -- Suomi DH Cup, Finnish Enduro Cup ja MTB Rally 2026 tapahtumat
- **Suodattimet** -- filtteröi sarjan, lajin, kuukauden ja tilan mukaan
- **Lajittelu** -- järjestä tapahtumat päivämäärän tai sarjan mukaan
- **Tekstihaku** -- etsi tapahtumia nimen, paikan tai järjestäjän perusteella
- **Kortti- ja listanäkymä** -- vaihda kortti- ja listanäkymän välillä
- **Kuukausierottimet** -- tapahtumat ryhmitellään kuukauden mukaan molemmissa näkymissä
- **Sääennuste** -- hakee Open-Meteo API:sta reaaliaikaisen sääennusteen tapahtumapaikoille (max 16 vrk)
- **Historiallinen sää** -- näyttää viime vuoden sään samoille päiville, kun ennuste ei ole saatavilla
- **Näytä kartalla** -- avaa tapahtumapaikan Google Mapsissa
- **Suodattimien tyhjennys** -- nollaa kaikki suodattimet yhdellä klikkauksella
- **Animaatiot** -- korttien sisääntuloanimaatiot ja hover-efektit
- **Responsiivinen** -- toimii mobiililla ja työpöydällä

## Teknologiat

- **HTML5, CSS3, JavaScript** (natiivi, ei ulkoisia JS-kirjastoja)
- **Fetch API** -- AJAX-kutsut events.json ja Open-Meteo API:lle
- **Open-Meteo API** -- ilmainen sää-API (ei vaadi API-avainta)
- **Google Fonts** -- Outfit + Space Mono

## API-kutsut

1. **events.json** -- staattinen tapahtumatiedosto (AJAX fetch)
2. **Open-Meteo Forecast API** -- `https://api.open-meteo.com/v1/forecast` (live REST API)
3. **Open-Meteo Archive API** -- `https://archive-api.open-meteo.com/v1/archive` (historiallinen säädata)

## Tietolähteet

| Sarja | Lähde |
|-------|-------|
| Suomi DH Cup | [pyoraily.fi](https://pyoraily.fi/tapahtumat-ja-kilpailut/suomi-dh-cup/) |
| Finnish Enduro Cup | [eba.mtb-enduro.fi](https://eba.mtb-enduro.fi/kilpailut/) |
| MTB Rally | [mtbrally.com](https://www.mtbrally.com/fi/calendar) |
| Säädata | [Open-Meteo](https://open-meteo.com/) |

## Projektin rakenne

```
/
  index.html      # Pääsivu
  style.css       # Tyylit
  app.js          # Sovelluslogiikka (AJAX, filtterit, sää)
  events.json     # Tapahtumatiedot
  README.md       # Tämä tiedosto
```

## Tapahtumadatan päivittäminen

Tapahtumatiedot ovat `events.json`-tiedostossa. Päivittäminen:
1. Muokkaa `events.json` GitHubissa
2. Netlify deployaa muutoksen automaattisesti

## Itsearviointi

Sovellus täyttää tehtävän vaatimukset:
- AJAX-kutsu live REST API:lle (Open-Meteo sää-API)
- Data tallennetaan muuttujaan ja valittu data näytetään
- Viimeistelty ulkoasu CSS:llä (tumma teema, animaatiot, responsiivinen)
- Käyttöliittymässä on suodattimet, lajittelu ja hakukenttä uuden haun tekemiseen
- Kaikki event handlerit lisätty dynaamisesti (addEventListener)
- Natiivi JS -- ei ulkoisia JS-kirjastoja
- Koodi on kommentoitu
- Julkaistu [GitHubissa](https://github.com/tengska/gravity-calendar) ja [Netlifyssä](https://gravitycalendar.netlify.app/)

## Tekijä

Karla Tengström

## Projektiin käytetty aika

~2 päivää

## Tulevaisuuden parannusehdotukset

- **GitHub Action** -- automaattinen events.json-päivitys, joka tarkistaa lähdesivustot muutoksien tai uusien tapahtumien varalta ja päivittää datan ilman manuaalista työtä
- **Kansainväliset kisat** -- laajentaminen kattamaan myös kansainväliset gravity-tapahtumat (esim. UCI DH World Cup, EWS)
