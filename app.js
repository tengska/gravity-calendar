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
let currentView = 'cards'; // Current view mode: 'cards' or 'list'
let weatherQueue = [];     // Queue for staggered weather mini loading

// ---- DOM References ----
const eventsGrid = document.getElementById('events-grid');
const loadingEl = document.getElementById('loading');
const emptyStateEl = document.getElementById('empty-state');
const resultsCountEl = document.getElementById('results-count');
const weatherModal = document.getElementById('weather-modal');
const weatherBody = document.getElementById('weather-body');
const modalCloseBtn = document.getElementById('modal-close');

// Filter elements
const filterSeries = document.getElementById('filter-series');
const filterDiscipline = document.getElementById('filter-discipline');
const filterMonth = document.getElementById('filter-month');
const filterStatus = document.getElementById('filter-status');
const filterSort = document.getElementById('filter-sort');
const filterSearch = document.getElementById('filter-search');
const btnResetFilters = document.getElementById('btn-reset-filters');
const viewCardsBtn = document.getElementById('view-cards');
const viewListBtn = document.getElementById('view-list');
const emptyResetLink = document.getElementById('empty-reset-link');
const filtersSection = document.getElementById('filters-section');
const filterToggleBtn = document.getElementById('filter-toggle');
const filterToggleIcon = document.getElementById('filter-toggle-icon');


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
      // Check if the response is OK
      if (!response.ok) {
        throw new Error('Verkkovirhe: ' + response.status);
      }
      return response.json();
    })
    .then(function(data) {
      // Store events and update status based on current date
      allEvents = data.map(updateEventStatus);

      // Sort events by start date
      allEvents.sort(function(a, b) {
        return new Date(a.dateStart) - new Date(b.dateStart);
      });

      // Hide loading indicator
      loadingEl.classList.add('hidden');

      // Apply initial filters and render
      applyFilters();
    })
    .catch(function(error) {
      // Show error message if fetch fails
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
 *
 * @param {number} lat - Latitude of the event location
 * @param {number} lon - Longitude of the event location
 * @param {string} dateStart - Start date (YYYY-MM-DD)
 * @param {string} dateEnd - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Weather data from Open-Meteo
 */
function fetchWeather(lat, lon, dateStart, dateEnd) {
  // Create cache key to avoid duplicate requests
  var cacheKey = lat + ',' + lon + ',' + dateStart;

  // Return cached data if available
  if (weatherCache[cacheKey]) {
    return Promise.resolve(weatherCache[cacheKey]);
  }

  // Build Open-Meteo API URL for daily forecast
  var url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + lat
    + '&longitude=' + lon
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode,windspeed_10m_max'
    + '&timezone=Europe/Helsinki'
    + '&start_date=' + dateStart
    + '&end_date=' + dateEnd;

  return fetch(url)
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Sää-API virhe: ' + response.status);
      }
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
 * Uses Open-Meteo archive API — free, no key required.
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
 * WMO codes: https://open-meteo.com/en/docs (weathercode section)
 *
 * @param {number} code - WMO weather code
 * @returns {Object} Object with emoji and text description
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
// 3. FILTERING LOGIC
// ============================================

/**
 * Applies all active filters to the events array
 * and re-renders the event cards.
 */
function applyFilters() {
  var series = filterSeries.value;
  var discipline = filterDiscipline.value;
  var month = filterMonth.value;
  var status = filterStatus.value;
  var sortBy = filterSort.value;
  var search = filterSearch.value.toLowerCase().trim();

  // Filter the events
  filteredEvents = allEvents.filter(function(event) {
    // Series filter
    if (series !== 'all' && event.series !== series) return false;

    // Discipline filter
    if (discipline !== 'all' && event.discipline !== discipline) return false;

    // Month filter
    if (month !== 'all') {
      var eventMonth = new Date(event.dateStart).getMonth() + 1;
      if (eventMonth !== parseInt(month)) return false;
    }

    // Status filter
    if (status === 'upcoming' && (event.status === 'past' || event.status === 'cancelled')) return false;
    if (status === 'past' && event.status !== 'past') return false;
    if (status === 'cancelled' && event.status !== 'cancelled') return false;

    // Search filter — matches name, location, city, or organizer
    if (search) {
      var searchTarget = (
        event.name + ' ' +
        event.location + ' ' +
        event.city + ' ' +
        event.organizer + ' ' +
        event.series
      ).toLowerCase();
      if (searchTarget.indexOf(search) === -1) return false;
    }

    return true;
  });

  // Sort filtered events based on selected sort option
  if (sortBy === 'date-desc') {
    filteredEvents.sort(function(a, b) {
      return new Date(b.dateStart) - new Date(a.dateStart);
    });
  } else if (sortBy === 'series') {
    filteredEvents.sort(function(a, b) {
      return a.series.localeCompare(b.series) || new Date(a.dateStart) - new Date(b.dateStart);
    });
  } else {
    filteredEvents.sort(function(a, b) {
      return new Date(a.dateStart) - new Date(b.dateStart);
    });
  }

  // Show/hide reset button based on active filter count
  var activeCount = 0;
  if (series !== 'all') activeCount++;
  if (discipline !== 'all') activeCount++;
  if (month !== 'all') activeCount++;
  if (status !== 'all') activeCount++;
  if (sortBy !== 'date-asc') activeCount++;
  if (search !== '') activeCount++;

  if (activeCount > 0) {
    btnResetFilters.textContent = 'Tyhjennä (' + activeCount + ')';
    btnResetFilters.classList.remove('hidden');
  } else {
    btnResetFilters.classList.add('hidden');
  }

  // Render the filtered events
  renderEvents(filteredEvents);
}

/**
 * Updates event status (upcoming/past) based on current date.
 * Does not override manually set 'cancelled' status.
 *
 * @param {Object} event - Event object
 * @returns {Object} Event with updated status
 */
function updateEventStatus(event) {
  // Create a shallow copy to avoid mutating the original data
  var updated = {};
  for (var key in event) {
    if (event.hasOwnProperty(key)) updated[key] = event[key];
  }

  // Don't override cancelled events
  if (updated.status === 'cancelled') return updated;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var endDate = new Date(updated.dateEnd);
  endDate.setHours(23, 59, 59, 999);

  if (endDate < today) {
    updated.status = 'past';
  } else {
    updated.status = 'upcoming';
  }

  return updated;
}


// ============================================
// 4. RENDERING
// ============================================

/**
 * Renders event cards into the grid.
 *
 * @param {Array} events - Array of event objects to display
 */
function renderEvents(events) {
  // Clear existing cards and weather queue
  eventsGrid.innerHTML = '';
  weatherQueue = [];

  // Toggle grid class based on current view
  if (currentView === 'list') {
    eventsGrid.classList.add('list-view');
  } else {
    eventsGrid.classList.remove('list-view');
  }

  // Update results count
  resultsCountEl.textContent = events.length + ' tapahtumaa';

  // Show empty state if no events match
  if (events.length === 0) {
    emptyStateEl.classList.remove('hidden');
    return;
  }
  emptyStateEl.classList.add('hidden');

  // Create a card or row for each event
  var lastMonth = null;
  events.forEach(function(event, index) {
    // Insert a month divider whenever the month changes (both views)
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

    var el;
    if (currentView === 'list') {
      el = createEventRow(event);
    } else {
      el = createEventCard(event);
    }
    // Staggered entrance animation
    el.classList.add('card-entering');
    el.style.animationDelay = (index * 60) + 'ms';
    eventsGrid.appendChild(el);
  });

  // Process staggered weather mini loading
  processWeatherQueue(0);
}

/**
 * Creates a single event card DOM element.
 *
 * @param {Object} event - Event data object
 * @returns {HTMLElement} The card element
 */
function createEventCard(event) {
  var card = document.createElement('div');
  card.className = 'event-card';

  // Add status class for styling
  if (event.status === 'cancelled') card.classList.add('cancelled');
  if (event.status === 'past') card.classList.add('past');

  // Determine series badge color class
  var seriesClass = 'series-rally';
  if (event.series === 'Suomi DH Cup') seriesClass = 'series-dh';
  if (event.series === 'Finnish Enduro Cup') seriesClass = 'series-enduro';

  // Format date display
  var dateDisplay = formatDateRange(event.dateStart, event.dateEnd);

  // Calculate countdown (days until event)
  var countdown = getCountdown(event.dateStart, event.status);

  // Build card HTML
  var html = '';

  // Series badge
  html += '<span class="card-series ' + seriesClass + '">' + event.seriesShort + '</span>';

  // No top-right badge — status is communicated by background color + bottom label

  // Event name
  html += '<h3 class="card-name">' + event.name + '</h3>';

  // Location and organizer
  html += '<p class="card-location">'
    + event.location
    + (event.city ? ' <span class="city">· ' + event.city + '</span>' : '')
    + '</p>';
  if (event.organizer) {
    html += '<p class="card-organizer">' + event.organizer + '</p>';
  }

  // Date — gray for past/cancelled, lime for upcoming
  var dateMuted = event.status !== 'upcoming';
  html += '<p class="card-date' + (dateMuted ? ' date-muted' : '') + '"><span class="date-icon">📅</span> ' + dateDisplay + '</p>';

  // Countdown
  if (countdown) {
    html += '<p class="card-countdown">' + countdown + '</p>';
  }

  // Action buttons
  var hasWeather = event.status === 'upcoming' && isWithinForecastRange(event.dateStart);
  var hasClimate = event.status === 'upcoming' && !isWithinForecastRange(event.dateStart);

  html += '<div class="card-actions">';

  if (event.registrationUrl && event.status === 'upcoming') {
    html += '<a href="' + event.registrationUrl + '" target="_blank" rel="noopener" class="btn-register">Ilmoittaudu</a>';
  }
  if (event.resultsUrl && event.status === 'past') {
    html += '<a href="' + event.resultsUrl + '" target="_blank" rel="noopener" class="btn-results">Tulokset</a>';
  }
  if (event.websiteUrl) {
    html += '<a href="' + event.websiteUrl + '" target="_blank" rel="noopener">Lisätiedot</a>';
  }
  if (event.status === 'cancelled') {
    html += '<span class="btn-cancelled">Peruttu</span>';
  }

  // Google Maps — only for upcoming events
  if (event.status === 'upcoming') {
    html += '<a href="https://www.google.com/maps?q=' + event.lat + ',' + event.lon + '" target="_blank" rel="noopener" class="btn-map" title="Näytä kartalla">📍</a>';
  }

  if (hasWeather) {
    html += '<button class="btn-weather" data-event-id="' + event.id + '">🌤️ Sää</button>';
  } else if (hasClimate) {
    html += '<button class="btn-climate" data-event-id="' + event.id + '" title="Viime vuoden sää samoille päiville">🌡️ Sää</button>';
  }

  html += '</div>';

  // Weather mini display (populated later if weather is fetched)
  html += '<div class="card-weather-mini hidden" id="weather-mini-' + event.id + '"></div>';

  card.innerHTML = html;

  // Dynamically add weather and climate button event handlers
  var weatherBtn = card.querySelector('.btn-weather');
  if (weatherBtn) {
    weatherBtn.addEventListener('click', function() { showWeatherModal(event); });
  }
  var climateBtn = card.querySelector('.btn-climate');
  if (climateBtn) {
    climateBtn.addEventListener('click', function() { showClimateModal(event); });
  }

  // Queue weather mini for events within 7 days (staggered loading)
  if (event.status === 'upcoming' && isWithinDays(event.dateStart, 7)) {
    weatherQueue.push(event);
  }

  return card;
}


// ============================================
// 5. WEATHER UI
// ============================================

/**
 * Shows a modal with detailed weather forecast for an event.
 *
 * @param {Object} event - Event data object
 */
function showWeatherModal(event) {
  // Show modal
  weatherModal.classList.remove('hidden');

  // Show loading state
  weatherBody.innerHTML = '<div class="loading-spinner"></div><p>Haetaan säätietoja...</p>';

  // Fetch weather data from Open-Meteo API (AJAX call)
  fetchWeather(event.lat, event.lon, event.dateStart, event.dateEnd)
    .then(function(data) {
      renderWeatherModal(data, event);
    })
    .catch(function(error) {
      console.error('Sään haku epäonnistui:', error);
      weatherBody.innerHTML = '<p>⚠️ Säätietojen haku epäonnistui. Ennuste on saatavilla vain seuraavalle 16 päivälle.</p>';
    });
}

/**
 * Renders weather forecast data in the modal.
 *
 * @param {Object} data - Open-Meteo API response
 * @param {Object} event - Event data object
 */
function renderWeatherModal(data, event) {
  var html = '';

  // Header
  html += '<div class="weather-modal-header">';
  html += '<h3>🌤️ Sääennuste — ' + event.location + '</h3>';
  html += '<p>' + event.name + '</p>';
  html += '</div>';

  // Daily forecast rows
  if (data.daily && data.daily.time) {
    data.daily.time.forEach(function(date, i) {
      var weatherInfo = weatherCodeToInfo(data.daily.weathercode[i]);
      var maxTemp = Math.round(data.daily.temperature_2m_max[i]);
      var minTemp = Math.round(data.daily.temperature_2m_min[i]);
      var precip = data.daily.precipitation_sum[i];
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

/**
 * Loads a compact weather summary directly on the event card.
 * Used for events within the next 7 days.
 *
 * @param {Object} event - Event data object
 */
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
    .catch(function() {
      // Silently fail — weather mini is optional
    });
}


/**
 * Shows a modal with last year's weather for the same dates (historical archive).
 * Used when event is beyond the 16-day forecast window.
 */
function showClimateModal(event) {
  weatherModal.classList.remove('hidden');
  weatherBody.innerHTML = '<div class="loading-spinner"></div><p>Haetaan viime vuoden säätietoja...</p>';

  var lastYear = new Date(event.dateStart).getFullYear() - 1;

  fetchHistoricalWeather(event.lat, event.lon, event.dateStart, event.dateEnd)
    .then(function(data) {
      renderClimateModal(data, event, lastYear);
    })
    .catch(function(error) {
      console.error('Historiallisen sään haku epäonnistui:', error);
      weatherBody.innerHTML = '<p>⚠️ Historiallisten säätietojen haku epäonnistui.</p>';
    });
}

/**
 * Renders last year's weather data in the modal.
 * Dates shown as the actual event dates (2026) for clarity.
 */
function renderClimateModal(data, event, lastYear) {
  var html = '';
  var currentYear = lastYear + 1;

  html += '<div class="weather-modal-header">';
  html += '<h3>🌡️ Sää viime vuonna — ' + event.location + '</h3>';
  html += '<p>' + event.name + '</p>';
  html += '</div>';

  if (data.daily && data.daily.time && data.daily.time.length > 0) {
    data.daily.time.forEach(function(date, i) {
      // Show as current-year dates so they match the event dates
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
 *
 * @param {Object} event - Event data object
 * @returns {HTMLElement} The row element
 */
function createEventRow(event) {
  var row = document.createElement('div');
  row.className = 'event-row';

  if (event.status === 'cancelled') row.classList.add('cancelled');
  if (event.status === 'past') row.classList.add('past');

  // Series badge color
  var seriesClass = 'series-rally';
  if (event.series === 'Suomi DH Cup') seriesClass = 'series-dh';
  if (event.series === 'Finnish Enduro Cup') seriesClass = 'series-enduro';

  var dateDisplay = formatDateRange(event.dateStart, event.dateEnd);

  var html = '';

  // Column 1: Date — gray for past/cancelled
  var rowDateMuted = event.status !== 'upcoming';
  html += '<div class="row-date' + (rowDateMuted ? ' date-muted' : '') + '">';
  html += '📅 ' + dateDisplay;
  html += '</div>';

  // Column 2: Series badge
  html += '<span class="row-series card-series ' + seriesClass + '">' + event.seriesShort + '</span>';

  // Column 3: Event info (name + location)
  html += '<div class="row-info">';
  html += '<span class="row-name">' + event.name + '</span>';
  html += '<span class="row-location">' + event.location;
  if (event.city) html += ' · ' + event.city;
  html += '</span>';
  html += '</div>';

  // Column 4: Fixed 3-slot action grid — slots never shift between rows.
  // Slot 1: registration/results text button or invisible placeholder
  // Slot 2: map icon (always shown)
  // Slot 3: weather/climate icon or invisible placeholder
  var hasWeather = event.status === 'upcoming' && isWithinForecastRange(event.dateStart);
  var hasClimate = event.status === 'upcoming' && !isWithinForecastRange(event.dateStart);

  // Past + cancelled: single full-width label spans all action columns
  if (event.status === 'past' || event.status === 'cancelled') {
    html += '<div class="row-actions row-actions-wide">';
    if (event.status === 'past' && event.resultsUrl) {
      html += '<a href="' + event.resultsUrl + '" target="_blank" rel="noopener" class="row-btn-register row-btn-results">Tulokset</a>';
    } else if (event.status === 'cancelled') {
      html += '<span class="row-cancelled-label">Peruttu</span>';
    } else {
      html += '<span class="row-action-empty"></span>';
    }
    html += '</div>';
  } else {
    // Upcoming: 3-slot grid [register | map | weather]
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

  // Dynamically add event handlers
  var weatherBtn = row.querySelector('.btn-weather');
  if (weatherBtn) {
    weatherBtn.addEventListener('click', function() { showWeatherModal(event); });
  }
  var climateBtn = row.querySelector('.btn-climate');
  if (climateBtn) {
    climateBtn.addEventListener('click', function() { showClimateModal(event); });
  }

  return row;
}

/**
 * Processes the weather mini queue with staggered delays
 * to avoid firing all API calls at once.
 *
 * @param {number} index - Current queue index
 */
function processWeatherQueue(index) {
  if (index >= weatherQueue.length) return;
  loadWeatherMini(weatherQueue[index]);
  setTimeout(function() {
    processWeatherQueue(index + 1);
  }, 200);
}


// ============================================
// 6. HELPER FUNCTIONS
// ============================================

/**
 * Formats a date range for display.
 * E.g. "16.–17.5.2026" or "11.7.2026" for single day.
 */
function formatDateRange(start, end) {
  var s = new Date(start);
  var e = new Date(end);

  var sDay = s.getDate();
  var eDay = e.getDate();
  var sMonth = s.getMonth() + 1;
  var eMonth = e.getMonth() + 1;
  var year = s.getFullYear();

  // Same day
  if (start === end) {
    return sDay + '.' + sMonth + '.' + year;
  }

  // Same month
  if (sMonth === eMonth) {
    return sDay + '.–' + eDay + '.' + sMonth + '.' + year;
  }

  // Different months
  return sDay + '.' + sMonth + '.–' + eDay + '.' + eMonth + '.' + year;
}

/**
 * Formats a date string to short Finnish format (e.g. "La 16.5.")
 */
function formatShortDate(dateStr) {
  var d = new Date(dateStr);
  var days = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];
  return days[d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.';
}

/**
 * Returns a countdown string like "23 päivän päästä" or null if past/cancelled.
 */
function getCountdown(dateStart, status) {
  if (status === 'past' || status === 'cancelled') return null;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var start = new Date(dateStart);
  start.setHours(0, 0, 0, 0);

  var diffMs = start - today;
  var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '🔴 Tänään!';
  if (diffDays === 1) return 'Huomenna!';
  if (diffDays < 0) return null;

  return diffDays + ' päivän päästä';
}

/**
 * Checks if a date is within the Open-Meteo forecast range (16 days).
 */
function isWithinForecastRange(dateStr) {
  var today = new Date();
  var target = new Date(dateStr);
  var diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 16;
}

/**
 * Checks if a date is within N days from today.
 */
function isWithinDays(dateStr, days) {
  var today = new Date();
  var target = new Date(dateStr);
  var diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
}

/**
 * Returns a Finnish month+year string for list view month dividers.
 * E.g. "Toukokuu 2026"
 */
function formatMonthYear(dateStr) {
  var d = new Date(dateStr);
  var months = ['Tammikuu','Helmikuu','Maaliskuu','Huhtikuu','Toukokuu','Kesäkuu',
                'Heinäkuu','Elokuu','Syyskuu','Lokakuu','Marraskuu','Joulukuu'];
  return months[d.getMonth()] + ' ' + d.getFullYear();
}


// ============================================
// 7. RESET FILTERS
// ============================================

/**
 * Resets all filters to their default values and re-applies.
 */
function resetFilters() {
  filterSeries.value = 'all';
  filterDiscipline.value = 'all';
  filterMonth.value = 'all';
  filterStatus.value = 'all';
  filterSort.value = 'date-asc';
  filterSearch.value = '';
  applyFilters();
}


// ============================================
// 8. EVENT LISTENERS (dynamically added!)
// ============================================

// Filter change handlers — all added dynamically
filterSeries.addEventListener('change', applyFilters);
filterDiscipline.addEventListener('change', applyFilters);
filterMonth.addEventListener('change', applyFilters);
filterStatus.addEventListener('change', applyFilters);
filterSort.addEventListener('change', applyFilters);

// Search input with debounce for better performance
var searchTimeout = null;
filterSearch.addEventListener('input', function() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(applyFilters, 300);
});

// Reset filters button handler
btnResetFilters.addEventListener('click', resetFilters);

// Empty state reset link handler
emptyResetLink.addEventListener('click', function(e) {
  e.preventDefault();
  resetFilters();
});

// View toggle handlers — switch between card grid and list view
viewCardsBtn.addEventListener('click', function() {
  if (currentView === 'cards') return;
  currentView = 'cards';
  viewCardsBtn.classList.add('active');
  viewListBtn.classList.remove('active');
  renderEvents(filteredEvents);
});

viewListBtn.addEventListener('click', function() {
  if (currentView === 'list') return;
  currentView = 'list';
  viewListBtn.classList.add('active');
  viewCardsBtn.classList.remove('active');
  renderEvents(filteredEvents);
});

// Mobile filter toggle — CSS hides filters-inner by default, expanded class shows it
filterToggleBtn.addEventListener('click', function() {
  filtersSection.classList.toggle('expanded');
  filterToggleIcon.textContent = filtersSection.classList.contains('expanded') ? '▴' : '▾';
});

// Modal close handlers
modalCloseBtn.addEventListener('click', function() {
  weatherModal.classList.add('hidden');
});

// Close modal when clicking overlay background
weatherModal.addEventListener('click', function(e) {
  if (e.target === weatherModal) {
    weatherModal.classList.add('hidden');
  }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !weatherModal.classList.contains('hidden')) {
    weatherModal.classList.add('hidden');
  }
});


// ============================================
// 9. INITIALIZE APP
// ============================================
loadEvents();
