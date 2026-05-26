/**
 * ============================================
 * GRAVITY CALENDAR — app.js
 * Suomen Gravity MTB Tapahtumat 2026
 *
 * Fetches event data from events.json and
 * weather forecasts from Open-Meteo API.
 * Native JS only — no external libraries.
 * ============================================
 */

// ---- State ----
let allEvents = [];        // All events loaded from JSON
let filteredEvents = [];   // Events after applying filters
let weatherCache = {};     // Cache weather responses to avoid duplicate API calls
let currentView = 'cards'; // Current view mode: 'cards', 'list', or 'map'
let weatherQueue = [];     // Queue for staggered weather mini loading
let leafletMap = null;     // Leaflet map instance
let mapMarkers = [];       // Map marker layer group

// ---- DOM References ----
const eventsGrid = document.getElementById('events-grid');
const loadingEl = document.getElementById('loading');
const emptyStateEl = document.getElementById('empty-state');
const resultsCountEl = document.getElementById('results-count');
const weatherModal = document.getElementById('weather-modal');
const weatherBody = document.getElementById('weather-body');
const modalCloseBtn = document.getElementById('modal-close');

// Filter elements
const filterSort = document.getElementById('filter-sort');
const filterSearch = document.getElementById('filter-search');
const btnResetFilters = document.getElementById('btn-reset-filters');
const viewCardsBtn = document.getElementById('view-cards');
const viewListBtn = document.getElementById('view-list');
const emptyResetLink = document.getElementById('empty-reset-link');
const filtersSection = document.getElementById('filters-section');
const filterToggleBtn = document.getElementById('filter-toggle');
const filterToggleIcon = document.getElementById('filter-toggle-icon');
const mapContainer = document.getElementById('map-container');
const viewMapBtn = document.getElementById('view-map');
const btnSuggestEvent = document.getElementById('btn-suggest-event');
const btnFeedback = document.getElementById('btn-feedback');
const suggestModal = document.getElementById('suggest-modal');
const feedbackModal = document.getElementById('feedback-modal');

// Multi-select default labels
var multiSelectDefaults = {
  'filter-series':     'Kaikki sarjat',
  'filter-discipline': 'Kaikki lajit',
  'filter-month':      'Kaikki kuukaudet',
  'filter-status':     'Kaikki'
};


// ============================================
// 1. FETCH EVENTS DATA (AJAX)
// ============================================

/**
 * Loads event data from events.json using fetch API (AJAX).
 * This is the primary data source for the application.
 */
function loadEvents() {
  fetch('events.json')
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Verkkovirhe: ' + response.status);
      }
      return response.json();
    })
    .then(function(data) {
      allEvents = data.map(updateEventStatus);
      allEvents.sort(function(a, b) {
        return new Date(a.dateStart) - new Date(b.dateStart);
      });
      loadingEl.classList.add('hidden');
      applyFilters();
    })
    .catch(function(error) {
      console.error('Tapahtumien lataus epäonnistui:', error);
      loadingEl.innerHTML = '<p>⚠️ Tapahtumien lataus epäonnistui. Yritä päivittää sivu.</p>';
    });
}


// ============================================
// 2. WEATHER API (AJAX — Open-Meteo)
// ============================================

/**
 * Fetches weather forecast for a specific location from Open-Meteo API.
 * Open-Meteo is free and requires no API key.
 */
function fetchWeather(lat, lon, dateStart, dateEnd) {
  var cacheKey = lat + ',' + lon + ',' + dateStart;
  if (weatherCache[cacheKey]) {
    return Promise.resolve(weatherCache[cacheKey]);
  }

  var url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + lat
    + '&longitude=' + lon
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode,windspeed_10m_max'
    + '&timezone=Europe/Helsinki'
    + '&start_date=' + dateStart
    + '&end_date=' + dateEnd;

  return fetch(url)
    .then(function(response) {
      if (!response.ok) throw new Error('Sää-API virhe: ' + response.status);
      return response.json();
    })
    .then(function(data) {
      weatherCache[cacheKey] = data;
      return data;
    });
}

/**
 * Fetches historical weather for the same calendar dates from the previous year.
 * Used for events beyond the 16-day forecast range.
 */
function fetchHistoricalWeather(lat, lon, dateStart, dateEnd) {
  var startYear = new Date(dateStart).getFullYear();
  var lastYearStart = dateStart.replace(startYear, startYear - 1);
  var lastYearEnd = dateEnd.replace(new Date(dateEnd).getFullYear(), startYear - 1);

  var cacheKey = 'hist-' + lat + ',' + lon + ',' + lastYearStart;
  if (weatherCache[cacheKey]) {
    return Promise.resolve(weatherCache[cacheKey]);
  }

  var url = 'https://archive-api.open-meteo.com/v1/archive'
    + '?latitude=' + lat
    + '&longitude=' + lon
    + '&start_date=' + lastYearStart
    + '&end_date=' + lastYearEnd
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max'
    + '&timezone=Europe/Helsinki';

  return fetch(url)
    .then(function(response) {
      if (!response.ok) throw new Error('Archive API virhe: ' + response.status);
      return response.json();
    })
    .then(function(data) {
      weatherCache[cacheKey] = data;
      return data;
    });
}

/**
 * Maps WMO weather code to a human-readable description and emoji.
 */
function weatherCodeToInfo(code) {
  var weatherMap = {
    0:  { emoji: '☀️', text: 'Selkeä' },
    1:  { emoji: '🌤️', text: 'Melko selkeä' },
    2:  { emoji: '⛅', text: 'Puolipilvinen' },
    3:  { emoji: '☁️', text: 'Pilvinen' },
    45: { emoji: '🌫️', text: 'Sumua' },
    48: { emoji: '🌫️', text: 'Huurtavaa sumua' },
    51: { emoji: '🌧️', text: 'Heikkoa tihkua' },
    53: { emoji: '🌧️', text: 'Tihkua' },
    55: { emoji: '🌧️', text: 'Tiheää tihkua' },
    61: { emoji: '🌧️', text: 'Heikkoa sadetta' },
    63: { emoji: '🌧️', text: 'Sadetta' },
    65: { emoji: '🌧️', text: 'Voimakasta sadetta' },
    66: { emoji: '🌨️', text: 'Jäätävää sadetta' },
    67: { emoji: '🌨️', text: 'Voimakasta jäätävää sadetta' },
    71: { emoji: '❄️', text: 'Heikkoa lumisadetta' },
    73: { emoji: '❄️', text: 'Lumisadetta' },
    75: { emoji: '❄️', text: 'Voimakasta lumisadetta' },
    77: { emoji: '❄️', text: 'Lumijyväsiä' },
    80: { emoji: '🌦️', text: 'Heikkoja kuuroja' },
    81: { emoji: '🌦️', text: 'Kuuroja' },
    82: { emoji: '🌦️', text: 'Voimakkaita kuuroja' },
    85: { emoji: '🌨️', text: 'Lumikuuroja' },
    86: { emoji: '🌨️', text: 'Voimakkaita lumikuuroja' },
    95: { emoji: '⛈️', text: 'Ukkosta' },
    96: { emoji: '⛈️', text: 'Ukkosta ja rakeita' },
    99: { emoji: '⛈️', text: 'Voimakasta ukkosta' }
  };
  return weatherMap[code] || { emoji: '🌡️', text: 'Tuntematon' };
}


// ============================================
// 3. MULTI-SELECT HELPERS
// ============================================

/**
 * Returns an array of selected values from a multi-select component.
 */
function getSelectedValues(containerId) {
  var checked = document.querySelectorAll('#' + containerId + ' .multi-select-option.checked');
  return Array.from(checked).map(function(el) { return el.dataset.value; });
}

/**
 * Updates the trigger button text to reflect current selections.
 * Shows names for 1-2 selections, count for 3+, default label for none.
 */
function updateTriggerText(containerId) {
  var defaultText = multiSelectDefaults[containerId];
  var container = document.getElementById(containerId);
  var trigger = container.querySelector('.multi-select-trigger');
  var selected = container.querySelectorAll('.multi-select-option.checked');

  if (selected.length === 0) {
    trigger.textContent = defaultText;
    trigger.classList.remove('has-selection');
  } else if (selected.length <= 2) {
    var names = Array.from(selected).map(function(el) {
      return el.dataset.short || el.dataset.value;
    });
    trigger.textContent = names.join(', ');
    trigger.classList.add('has-selection');
  } else {
    trigger.textContent = selected.length + ' valittu';
    trigger.classList.add('has-selection');
  }
}


// ============================================
// 4. FILTERING LOGIC
// ============================================

/**
 * Applies all active filters to the events array and re-renders.
 */
function applyFilters() {
  var series     = getSelectedValues('filter-series');
  var discipline = getSelectedValues('filter-discipline');
  var month      = getSelectedValues('filter-month');
  var status     = getSelectedValues('filter-status');
  var sortBy     = filterSort.value;
  var search     = filterSearch.value.toLowerCase().trim();

  filteredEvents = allEvents.filter(function(event) {
    if (series.length > 0 && series.indexOf(event.series) === -1) return false;
    if (discipline.length > 0 && discipline.indexOf(event.discipline) === -1) return false;
    if (month.length > 0) {
      var eventMonth = String(new Date(event.dateStart).getMonth() + 1);
      if (month.indexOf(eventMonth) === -1) return false;
    }
    if (status.length > 0 && status.indexOf(event.status) === -1) return false;
    if (search) {
      var searchTarget = (
        event.name + ' ' + event.location + ' ' +
        event.city + ' ' + event.organizer + ' ' + event.series
      ).toLowerCase();
      if (searchTarget.indexOf(search) === -1) return false;
    }
    return true;
  });

  // Sort
  if (sortBy === 'date-desc') {
    filteredEvents.sort(function(a, b) { return new Date(b.dateStart) - new Date(a.dateStart); });
  } else if (sortBy === 'series') {
    filteredEvents.sort(function(a, b) {
      return a.series.localeCompare(b.series) || new Date(a.dateStart) - new Date(b.dateStart);
    });
  } else {
    filteredEvents.sort(function(a, b) { return new Date(a.dateStart) - new Date(b.dateStart); });
  }

  // Show/hide reset button
  var activeCount = 0;
  if (series.length > 0)     activeCount++;
  if (discipline.length > 0) activeCount++;
  if (month.length > 0)      activeCount++;
  if (status.length > 0)     activeCount++;
  if (sortBy !== 'date-asc') activeCount++;
  if (search !== '')         activeCount++;

  if (activeCount > 0) {
    btnResetFilters.textContent = 'Tyhjennä (' + activeCount + ')';
    btnResetFilters.classList.remove('hidden');
  } else {
    btnResetFilters.classList.add('hidden');
  }

  var filterBadge = document.getElementById('filter-badge');
  if (activeCount > 0) {
    filterBadge.textContent = '(' + activeCount + ')';
    filterBadge.classList.remove('hidden');
  } else {
    filterBadge.classList.add('hidden');
  }

  renderEvents(filteredEvents);
}

/**
 * Updates event status (upcoming/past) based on current date.
 * Does not override manually set 'cancelled' status.
 */
function updateEventStatus(event) {
  var updated = {};
  for (var key in event) {
    if (event.hasOwnProperty(key)) updated[key] = event[key];
  }
  if (updated.status === 'cancelled') return updated;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var endDate = new Date(updated.dateEnd);
  endDate.setHours(23, 59, 59, 999);

  updated.status = endDate < today ? 'past' : 'upcoming';
  return updated;
}


// ============================================
// 5. RENDERING
// ============================================

/**
 * Renders event cards or rows into the grid.
 */
function renderEvents(events) {
  eventsGrid.innerHTML = '';
  weatherQueue = [];

  if (currentView === 'map') {
    eventsGrid.classList.add('hidden');
    mapContainer.classList.remove('hidden');
    emptyStateEl.classList.add('hidden');
    resultsCountEl.textContent = events.length + ' tapahtumaa';
    renderMap(events);
    return;
  }

  mapContainer.classList.add('hidden');
  eventsGrid.classList.remove('hidden');

  if (currentView === 'list') {
    eventsGrid.classList.add('list-view');
  } else {
    eventsGrid.classList.remove('list-view');
  }

  resultsCountEl.textContent = events.length + ' tapahtumaa';

  if (events.length === 0) {
    emptyStateEl.classList.remove('hidden');
    return;
  }
  emptyStateEl.classList.add('hidden');

  var lastMonth = null;
  events.forEach(function(event, index) {
    var eventMonth = new Date(event.dateStart).getMonth();
    var eventYear = new Date(event.dateStart).getFullYear();
    var monthKey = eventYear + '-' + eventMonth;
    if (monthKey !== lastMonth) {
      lastMonth = monthKey;
      var divider = document.createElement('div');
      divider.className = 'month-divider';
      divider.textContent = formatMonthYear(event.dateStart);
      eventsGrid.appendChild(divider);
    }

    var el = currentView === 'list' ? createEventRow(event) : createEventCard(event);
    el.classList.add('card-entering');
    el.style.animationDelay = (index * 60) + 'ms';
    eventsGrid.appendChild(el);
  });

  processWeatherQueue(0);
}

/**
 * Creates a single event card DOM element.
 */
function createEventCard(event) {
  var card = document.createElement('div');
  card.className = 'event-card';
  if (event.status === 'cancelled') card.classList.add('cancelled');
  if (event.status === 'past') card.classList.add('past');

  var seriesClass = 'series-rally';
  if (event.series === 'Suomi DH Cup') seriesClass = 'series-dh';
  if (event.series === 'Finnish Enduro Cup') seriesClass = 'series-enduro';
  if (event.series === 'Tapahtumat/Muut') seriesClass = 'series-events';

  var dateDisplay = formatDateRange(event.dateStart, event.dateEnd);
  var countdown = getCountdown(event.dateStart, event.status);

  var html = '';
  html += '<span class="card-series ' + seriesClass + '">' + event.seriesShort + '</span>';
  html += '<h3 class="card-name">' + event.name + '</h3>';
  html += '<p class="card-location">'
    + event.location
    + (event.city ? ' <span class="city">· ' + event.city + '</span>' : '')
    + '</p>';
  if (event.organizer) {
    html += '<p class="card-organizer">' + event.organizer + '</p>';
  }

  var dateMuted = event.status !== 'upcoming';
  html += '<p class="card-date' + (dateMuted ? ' date-muted' : '') + '"><span class="date-icon">📅</span> ' + dateDisplay + '</p>';
  if (countdown) {
    html += '<p class="card-countdown">' + countdown + '</p>';
  }

  var hasWeather = event.status === 'upcoming' && isWithinForecastRange(event.dateStart);
  var hasClimate = event.status === 'upcoming' && !isWithinForecastRange(event.dateStart);

  html += '<div class="card-actions">';
  if (event.registrationUrl && event.status === 'upcoming') {
    html += '<a href="' + event.registrationUrl + '" target="_blank" rel="noopener" class="btn-register">Ilmoittaudu</a>';
  }
  if (event.resultsUrl && event.status === 'past' && event.competition !== false) {
    html += '<a href="' + event.resultsUrl + '" target="_blank" rel="noopener" class="btn-results">Tulokset</a>';
  }
  if (event.websiteUrl) {
    html += '<a href="' + event.websiteUrl + '" target="_blank" rel="noopener">Lisätiedot</a>';
  }
  if (event.status === 'cancelled') {
    html += '<span class="btn-cancelled">Peruttu</span>';
  }
  if (event.status === 'upcoming') {
    html += '<a href="https://www.google.com/maps?q=' + event.lat + ',' + event.lon + '" target="_blank" rel="noopener" class="btn-map" title="Näytä kartalla">📍</a>';
  }
  if (hasWeather) {
    html += '<button class="btn-weather" data-event-id="' + event.id + '">🌤️ Sää</button>';
  } else if (hasClimate) {
    html += '<button class="btn-climate" data-event-id="' + event.id + '" title="Viime vuoden sää samoille päiville">🌡️ Sää</button>';
  }
  html += '</div>';

  html += '<div class="card-weather-mini hidden" id="weather-mini-' + event.id + '"></div>';

  card.innerHTML = html;

  var weatherBtn = card.querySelector('.btn-weather');
  if (weatherBtn) weatherBtn.addEventListener('click', function() { showWeatherModal(event); });
  var climateBtn = card.querySelector('.btn-climate');
  if (climateBtn) climateBtn.addEventListener('click', function() { showClimateModal(event); });

  if (event.status === 'upcoming' && isWithinDays(event.dateStart, 7)) {
    weatherQueue.push(event);
  }

  return card;
}


// ============================================
// 6. WEATHER UI
// ============================================

function showWeatherModal(event) {
  weatherModal.classList.remove('hidden');
  weatherBody.innerHTML = '<div class="loading-spinner"></div><p>Haetaan säätietoja...</p>';
  fetchWeather(event.lat, event.lon, event.dateStart, event.dateEnd)
    .then(function(data) { renderWeatherModal(data, event); })
    .catch(function(error) {
      console.error('Sään haku epäonnistui:', error);
      weatherBody.innerHTML = '<p>⚠️ Säätietojen haku epäonnistui. Ennuste on saatavilla vain seuraavalle 16 päivälle.</p>';
    });
}

function renderWeatherModal(data, event) {
  var html = '';
  html += '<div class="weather-modal-header">';
  html += '<h3>🌤️ Sääennuste — ' + event.location + '</h3>';
  html += '<p>' + event.name + '</p>';
  html += '</div>';

  if (data.daily && data.daily.time) {
    data.daily.time.forEach(function(date, i) {
      var weatherInfo = weatherCodeToInfo(data.daily.weathercode[i]);
      var maxTemp = Math.round(data.daily.temperature_2m_max[i]);
      var minTemp = Math.round(data.daily.temperature_2m_min[i]);
      var precipProb = data.daily.precipitation_probability_max[i];
      var wind = Math.round(data.daily.windspeed_10m_max[i]);

      html += '<div class="weather-day">';
      html += '<span class="weather-day-date">' + formatShortDate(date) + '</span>';
      html += '<span class="weather-day-icon">' + weatherInfo.emoji + '</span>';
      html += '<span class="weather-day-temps"><span class="high">' + maxTemp + '°</span> / <span class="low">' + minTemp + '°</span></span>';
      html += '<span class="weather-day-info">' + weatherInfo.text + ' · 💧 ' + precipProb + '% · 💨 ' + wind + ' km/h</span>';
      html += '</div>';
    });
  } else {
    html += '<p>Ennuste ei ole vielä saatavilla tälle ajankohdalle.</p>';
  }

  html += '<p class="weather-notice">Ennuste: Open-Meteo. Luotettavuus heikkenee yli 7 päivän päähän.</p>';
  weatherBody.innerHTML = html;
}

function loadWeatherMini(event) {
  fetchWeather(event.lat, event.lon, event.dateStart, event.dateStart)
    .then(function(data) {
      if (data.daily && data.daily.time && data.daily.time.length > 0) {
        var miniEl = document.getElementById('weather-mini-' + event.id);
        if (!miniEl) return;
        var weatherInfo = weatherCodeToInfo(data.daily.weathercode[0]);
        var maxTemp = Math.round(data.daily.temperature_2m_max[0]);
        var precip = data.daily.precipitation_probability_max[0];
        miniEl.innerHTML =
          '<span class="weather-day-icon">' + weatherInfo.emoji + '</span>'
          + '<span class="weather-temp">' + maxTemp + '°C</span>'
          + '<span class="weather-desc">' + weatherInfo.text + ' · 💧 ' + precip + '%</span>';
        miniEl.classList.remove('hidden');
      }
    })
    .catch(function() {});
}

function showClimateModal(event) {
  weatherModal.classList.remove('hidden');
  weatherBody.innerHTML = '<div class="loading-spinner"></div><p>Haetaan viime vuoden säätietoja...</p>';
  var lastYear = new Date(event.dateStart).getFullYear() - 1;
  fetchHistoricalWeather(event.lat, event.lon, event.dateStart, event.dateEnd)
    .then(function(data) { renderClimateModal(data, event, lastYear); })
    .catch(function(error) {
      console.error('Historiallisen sään haku epäonnistui:', error);
      weatherBody.innerHTML = '<p>⚠️ Historiallisten säätietojen haku epäonnistui.</p>';
    });
}

function renderClimateModal(data, event, lastYear) {
  var html = '';
  var currentYear = lastYear + 1;
  html += '<div class="weather-modal-header">';
  html += '<h3>🌡️ Sää viime vuonna — ' + event.location + '</h3>';
  html += '<p>' + event.name + '</p>';
  html += '</div>';

  if (data.daily && data.daily.time && data.daily.time.length > 0) {
    data.daily.time.forEach(function(date, i) {
      var displayDate = date.replace(lastYear.toString(), currentYear.toString());
      var weatherInfo = weatherCodeToInfo(data.daily.weathercode[i]);
      var maxTemp = Math.round(data.daily.temperature_2m_max[i]);
      var minTemp = Math.round(data.daily.temperature_2m_min[i]);
      var precip = Math.round(data.daily.precipitation_sum[i] * 10) / 10;
      var wind = Math.round(data.daily.windspeed_10m_max[i]);

      html += '<div class="weather-day">';
      html += '<span class="weather-day-date">' + formatShortDate(displayDate) + '</span>';
      html += '<span class="weather-day-icon">' + weatherInfo.emoji + '</span>';
      html += '<span class="weather-day-temps"><span class="high">' + maxTemp + '°</span> / <span class="low">' + minTemp + '°</span></span>';
      html += '<span class="weather-day-info">' + weatherInfo.text + ' · 💧 ' + precip + 'mm · 💨 ' + wind + ' km/h</span>';
      html += '</div>';
    });
  } else {
    html += '<p>Historiallisia tietoja ei saatavilla.</p>';
  }

  html += '<p class="weather-notice">Sää ' + lastYear + ' samoille päiville — ei ennuste. Historiallinen tieto antaa viitteen tyypillisestä säästä.</p>';
  weatherBody.innerHTML = html;
}

/**
 * Creates a compact list row for an event (list view mode).
 */
function createEventRow(event) {
  var row = document.createElement('div');
  row.className = 'event-row';
  if (event.status === 'cancelled') row.classList.add('cancelled');
  if (event.status === 'past') row.classList.add('past');

  var seriesClass = 'series-rally';
  if (event.series === 'Suomi DH Cup') seriesClass = 'series-dh';
  if (event.series === 'Finnish Enduro Cup') seriesClass = 'series-enduro';
  if (event.series === 'Tapahtumat/Muut') seriesClass = 'series-events';

  var dateDisplay = formatDateRange(event.dateStart, event.dateEnd);
  var html = '';

  var rowDateMuted = event.status !== 'upcoming';
  html += '<div class="row-date' + (rowDateMuted ? ' date-muted' : '') + '">📅 ' + dateDisplay + '</div>';
  html += '<span class="row-series card-series ' + seriesClass + '">' + event.seriesShort + '</span>';
  html += '<div class="row-info">';
  html += '<span class="row-name">' + event.name + '</span>';
  html += '<span class="row-location">' + event.location;
  if (event.city) html += ' · ' + event.city;
  html += '</span>';
  html += '</div>';

  var hasWeather = event.status === 'upcoming' && isWithinForecastRange(event.dateStart);
  var hasClimate = event.status === 'upcoming' && !isWithinForecastRange(event.dateStart);

  if (event.status === 'past' || event.status === 'cancelled') {
    html += '<div class="row-actions row-actions-wide">';
    if (event.status === 'past' && event.resultsUrl && event.competition !== false) {
      html += '<a href="' + event.resultsUrl + '" target="_blank" rel="noopener" class="row-btn-register row-btn-results">Tulokset</a>';
    } else if (event.status === 'cancelled') {
      html += '<span class="row-cancelled-label">Peruttu</span>';
    } else {
      html += '<span class="row-action-empty"></span>';
    }
    html += '</div>';
  } else {
    html += '<div class="row-actions">';
    if (event.registrationUrl) {
      html += '<a href="' + event.registrationUrl + '" target="_blank" rel="noopener" class="row-btn-register">Ilmoittaudu</a>';
    } else {
      html += '<span class="row-action-empty"></span>';
    }
    html += '<a href="https://www.google.com/maps?q=' + event.lat + ',' + event.lon + '" target="_blank" rel="noopener" class="btn-map" title="Näytä kartalla">📍</a>';
    if (hasWeather) {
      html += '<button class="btn-weather" title="Näytä sääennuste">🌤️</button>';
    } else if (hasClimate) {
      html += '<button class="btn-climate" title="Viime vuoden sää samoille päiville">🌡️</button>';
    } else {
      html += '<span class="row-action-empty"></span>';
    }
    html += '</div>';
  }

  row.innerHTML = html;

  var weatherBtn = row.querySelector('.btn-weather');
  if (weatherBtn) weatherBtn.addEventListener('click', function() { showWeatherModal(event); });
  var climateBtn = row.querySelector('.btn-climate');
  if (climateBtn) climateBtn.addEventListener('click', function() { showClimateModal(event); });

  return row;
}

/**
 * Processes the weather mini queue with staggered delays.
 */
function processWeatherQueue(index) {
  if (index >= weatherQueue.length) return;
  loadWeatherMini(weatherQueue[index]);
  setTimeout(function() { processWeatherQueue(index + 1); }, 200);
}


// ============================================
// 7. HELPER FUNCTIONS
// ============================================

function formatDateRange(start, end) {
  var s = new Date(start);
  var e = new Date(end);
  var sDay = s.getDate();
  var eDay = e.getDate();
  var sMonth = s.getMonth() + 1;
  var eMonth = e.getMonth() + 1;
  var year = s.getFullYear();
  if (start === end) return sDay + '.' + sMonth + '.' + year;
  if (sMonth === eMonth) return sDay + '.–' + eDay + '.' + sMonth + '.' + year;
  return sDay + '.' + sMonth + '.–' + eDay + '.' + eMonth + '.' + year;
}

function formatShortDate(dateStr) {
  var d = new Date(dateStr);
  var days = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];
  return days[d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.';
}

function getCountdown(dateStart, status) {
  if (status === 'past' || status === 'cancelled') return null;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var start = new Date(dateStart);
  start.setHours(0, 0, 0, 0);
  var diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '🔴 Tänään!';
  if (diffDays === 1) return 'Huomenna!';
  if (diffDays < 0) return null;
  return diffDays + ' päivän päästä';
}

function isWithinForecastRange(dateStr) {
  var today = new Date();
  var target = new Date(dateStr);
  var diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 16;
}

function isWithinDays(dateStr, days) {
  var today = new Date();
  var target = new Date(dateStr);
  var diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
}

function formatMonthYear(dateStr) {
  var d = new Date(dateStr);
  var months = ['Tammikuu','Helmikuu','Maaliskuu','Huhtikuu','Toukokuu','Kesäkuu',
                'Heinäkuu','Elokuu','Syyskuu','Lokakuu','Marraskuu','Joulukuu'];
  return months[d.getMonth()] + ' ' + d.getFullYear();
}


// ============================================
// 8. RESET FILTERS
// ============================================

function resetFilters() {
  document.querySelectorAll('.multi-select-option.checked').forEach(function(el) {
    el.classList.remove('checked');
  });
  Object.keys(multiSelectDefaults).forEach(function(id) {
    updateTriggerText(id);
  });
  filterSort.value = 'date-asc';
  filterSearch.value = '';
  applyFilters();
}


// ============================================
// 9. EVENT LISTENERS (dynamically added!)
// ============================================

// Multi-select: open/close on trigger click, option toggle on option click
Object.keys(multiSelectDefaults).forEach(function(id) {
  var container = document.getElementById(id);
  var trigger = container.querySelector('.multi-select-trigger');

  trigger.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = container.classList.contains('open');
    document.querySelectorAll('.multi-select.open').forEach(function(ms) { ms.classList.remove('open'); });
    if (!isOpen) container.classList.add('open');
  });

  container.querySelectorAll('.multi-select-option').forEach(function(option) {
    option.addEventListener('click', function(e) {
      e.stopPropagation(); // keep dropdown open after selecting
      option.classList.toggle('checked');
      updateTriggerText(id);
      applyFilters();
    });
  });
});

// Close all dropdowns on outside click
document.addEventListener('click', function() {
  document.querySelectorAll('.multi-select.open').forEach(function(ms) { ms.classList.remove('open'); });
});

// Sort change
filterSort.addEventListener('change', applyFilters);

// Search with debounce
var searchTimeout = null;
filterSearch.addEventListener('input', function() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(applyFilters, 300);
});

// Reset filters button
btnResetFilters.addEventListener('click', resetFilters);

// Empty state reset link
emptyResetLink.addEventListener('click', function(e) {
  e.preventDefault();
  resetFilters();
});

// View toggle
viewCardsBtn.addEventListener('click', function() {
  if (currentView === 'cards') return;
  currentView = 'cards';
  viewCardsBtn.classList.add('active');
  viewListBtn.classList.remove('active');
  viewMapBtn.classList.remove('active');
  renderEvents(filteredEvents);
});

viewListBtn.addEventListener('click', function() {
  if (currentView === 'list') return;
  currentView = 'list';
  viewListBtn.classList.add('active');
  viewCardsBtn.classList.remove('active');
  viewMapBtn.classList.remove('active');
  renderEvents(filteredEvents);
});

// Mobile filter toggle
filterToggleBtn.addEventListener('click', function() {
  filtersSection.classList.toggle('expanded');
  filterToggleIcon.textContent = filtersSection.classList.contains('expanded') ? '▴' : '▾';
});

// Modal close
modalCloseBtn.addEventListener('click', function() { weatherModal.classList.add('hidden'); });
weatherModal.addEventListener('click', function(e) {
  if (e.target === weatherModal) weatherModal.classList.add('hidden');
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !weatherModal.classList.contains('hidden')) {
    weatherModal.classList.add('hidden');
  }
});


// ============================================
// 10. MAP VIEW
// ============================================

function getSeriesColor(series) {
  if (series === 'Suomi DH Cup') return '#7ec850';
  if (series === 'Finnish Enduro Cup') return '#c8693a';
  if (series === 'Tapahtumat/Muut') return '#9b6fc0';
  return '#4d8fa8';
}

function buildEventPopupBlock(event) {
  var seriesClass = 'series-rally';
  if (event.series === 'Suomi DH Cup') seriesClass = 'series-dh';
  if (event.series === 'Finnish Enduro Cup') seriesClass = 'series-enduro';
  if (event.series === 'Tapahtumat/Muut') seriesClass = 'series-events';

  var html = '<div class="map-popup-event">'
    + '<div class="map-popup-series card-series ' + seriesClass + '">' + event.seriesShort + '</div>'
    + '<div class="map-popup-name">' + event.name + '</div>'
    + '<div class="map-popup-date">' + formatDateRange(event.dateStart, event.dateEnd) + '</div>'
    + '<div class="map-popup-actions">';
  if (event.registrationUrl && event.status === 'upcoming') {
    html += '<a class="map-popup-link map-popup-register" href="' + event.registrationUrl + '" target="_blank" rel="noopener">Ilmoittaudu</a>';
  }
  if (event.websiteUrl) {
    html += '<a class="map-popup-link" href="' + event.websiteUrl + '" target="_blank" rel="noopener">Lisätiedot →</a>';
  }
  html += '</div></div>';
  return html;
}

function renderMap(events) {
  if (!leafletMap) {
    leafletMap = L.map('events-map').setView([64.0, 26.0], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18
    }).addTo(leafletMap);
    mapMarkers = L.layerGroup().addTo(leafletMap);
  }

  setTimeout(function() { leafletMap.invalidateSize(); }, 100);
  mapMarkers.clearLayers();

  // Group events by location
  var groups = {};
  events.forEach(function(event) {
    if (!event.lat || !event.lon) return;
    var key = event.lat + ',' + event.lon;
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  });

  var bounds = [];
  Object.keys(groups).forEach(function(key) {
    var group = groups[key];
    var first = group[0];

    // Sort: upcoming first (by date), then collect unique series colors
    var sorted = group.slice().sort(function(a, b) {
      var aUp = a.status === 'upcoming' ? 0 : 1;
      var bUp = b.status === 'upcoming' ? 0 : 1;
      if (aUp !== bUp) return aUp - bUp;
      return new Date(a.dateStart) - new Date(b.dateStart);
    });
    var seen = {};
    var uniqueColors = [];
    sorted.forEach(function(e) {
      if (!seen[e.series]) {
        seen[e.series] = true;
        uniqueColors.push(getSeriesColor(e.series));
      }
    });

    var marker;
    if (uniqueColors.length === 1) {
      marker = L.circleMarker([first.lat, first.lon], {
        radius: group.length > 1 ? 11 : 9,
        fillColor: uniqueColors[0],
        color: '#0d0f0e',
        weight: 2,
        opacity: 1,
        fillOpacity: first.status === 'past' ? 0.35 : 0.85
      });
    } else {
      // Reverse so first upcoming color renders last in DOM but gets highest z-index (on top)
      var reversed = uniqueColors.slice().reverse();
      var total = reversed.length;
      var dotsHtml = reversed.map(function(c, i) {
        var z = i + 1;
        return '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:' + c + ';border:2px solid #0d0f0e;margin:0 -5px;position:relative;z-index:' + z + '"></span>';
      }).join('');
      var dotWidth = 16 + (total - 1) * 6;
      var icon = L.divIcon({
        html: '<div style="display:flex;align-items:center">' + dotsHtml + '</div>',
        className: 'map-multi-marker',
        iconSize: [dotWidth, 18],
        iconAnchor: [dotWidth / 2, 9]
      });
      marker = L.marker([first.lat, first.lon], { icon: icon });
    }

    var location = first.location + (first.city ? ' · ' + first.city : '');
    var popupHtml = '<div style="font-family:Outfit,sans-serif;min-width:200px;max-width:280px">'
      + '<div class="map-popup-location" style="margin-bottom:0.5rem;font-weight:600">' + location + '</div>';
    group.forEach(function(event, i) {
      if (i > 0) popupHtml += '<hr style="border:none;border-top:1px solid #ddd;margin:0.4rem 0">';
      popupHtml += buildEventPopupBlock(event);
    });
    popupHtml += '</div>';
    marker.bindPopup(popupHtml, { maxHeight: 300 });

    mapMarkers.addLayer(marker);
    bounds.push([first.lat, first.lon]);
  });

  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
  }
}


// ============================================
// 11. MOBILE AUTO-COLLAPSE FILTERS ON SCROLL
// ============================================

(function() {
  var ticking = false;

  window.addEventListener('scroll', function() {
    if (window.innerWidth > 600) return;
    if (!ticking) {
      requestAnimationFrame(function() {
        if (window.scrollY > 120 && filtersSection.classList.contains('expanded')) {
          filtersSection.classList.remove('expanded');
          filterToggleIcon.textContent = '▾';
        }
        ticking = false;
      });
      ticking = true;
    }
  });
})();


// ============================================
// 12. MAP VIEW TOGGLE
// ============================================

viewMapBtn.addEventListener('click', function() {
  if (currentView === 'map') return;
  currentView = 'map';
  viewMapBtn.classList.add('active');
  viewCardsBtn.classList.remove('active');
  viewListBtn.classList.remove('active');
  renderEvents(filteredEvents);
});


// ============================================
// 13. SUGGEST EVENT & FEEDBACK FORMS
// ============================================

function openModal(modal) {
  var form = modal.querySelector('form');
  var success = modal.querySelector('.form-success');
  if (form) { form.reset(); form.classList.remove('hidden'); }
  if (success) success.classList.add('hidden');
  modal.querySelector('.form-title').classList.remove('hidden');
  modal.querySelector('.form-desc').classList.remove('hidden');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(modal) {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

btnSuggestEvent.addEventListener('click', function() { openModal(suggestModal); });
btnFeedback.addEventListener('click', function() { openModal(feedbackModal); });

document.getElementById('suggest-modal-close').addEventListener('click', function() {
  closeModal(suggestModal);
});
document.getElementById('feedback-modal-close').addEventListener('click', function() {
  closeModal(feedbackModal);
});

suggestModal.addEventListener('click', function(e) {
  if (e.target === suggestModal) closeModal(suggestModal);
});
feedbackModal.addEventListener('click', function(e) {
  if (e.target === feedbackModal) closeModal(feedbackModal);
});

document.getElementById('suggest-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var form = e.target;
  var formData = new FormData(form);
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(formData).toString()
  }).then(function() {
    form.classList.add('hidden');
    suggestModal.querySelector('.form-title').classList.add('hidden');
    suggestModal.querySelector('.form-desc').classList.add('hidden');
    document.getElementById('suggest-success').classList.remove('hidden');
  }).catch(function() {
    alert('Lähetys epäonnistui. Yritä uudelleen.');
  });
});

document.getElementById('feedback-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var form = e.target;
  var formData = new FormData(form);
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(formData).toString()
  }).then(function() {
    form.classList.add('hidden');
    feedbackModal.querySelector('.form-title').classList.add('hidden');
    feedbackModal.querySelector('.form-desc').classList.add('hidden');
    document.getElementById('feedback-success').classList.remove('hidden');
  }).catch(function() {
    alert('Lähetys epäonnistui. Yritä uudelleen.');
  });
});

document.getElementById('suggest-date-start').addEventListener('change', function() {
  var endInput = document.getElementById('suggest-date-end');
  var val = this.value;
  if (val && val.length === 10 && parseInt(val.split('-')[0], 10) >= 2000 && !endInput.value) {
    endInput.value = val;
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (!suggestModal.classList.contains('hidden')) closeModal(suggestModal);
    if (!feedbackModal.classList.contains('hidden')) closeModal(feedbackModal);
  }
});


// ============================================
// 14. INITIALIZE APP
// ============================================

// Pre-select "Tulevat" (upcoming) status filter so users see future events first
(function() {
  var upcomingOption = document.querySelector('#filter-status .multi-select-option[data-value="upcoming"]');
  if (upcomingOption) {
    upcomingOption.classList.add('checked');
    updateTriggerText('filter-status');
  }
})();

loadEvents();
