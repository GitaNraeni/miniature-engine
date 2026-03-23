import axios from "axios";

function weatherCodeToText(code = -1) {
  const map = {
    0: "Cerah",
    1: "Sebagian cerah",
    2: "Sedikit berawan",
    3: "Berawan",
    45: "Berkabut",
    48: "Kabut beku",
    51: "Gerimis ringan",
    53: "Gerimis sedang",
    55: "Gerimis lebat",
    61: "Hujan ringan",
    63: "Hujan sedang",
    65: "Hujan lebat",
    80: "Hujan lokal ringan",
    81: "Hujan lokal sedang",
    82: "Hujan lokal lebat",
    95: "Badai petir",
  };

  return map[code] || `Kode ${code}`;
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value}${suffix}`;
}

function getTimezoneLabel(timezone = "") {
  const map = {
    "Asia/Jakarta": "WIB",
    "Asia/Pontianak": "WIB",
    "Asia/Makassar": "WITA",
    "Asia/Jayapura": "WIT",
  };

  return map[timezone] || timezone;
}

function formatTimeInZone(dateInput, timezone = "Asia/Jakarta", withZone = false) {
  if (!dateInput) return "-";

  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

    const parts = new Intl.DateTimeFormat("id-ID", {
      timeZone: timezone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    const text = `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}.${get("minute")}`;

    return withZone ? `${text} ${getTimezoneLabel(timezone)}` : text;
  } catch {
    return String(dateInput);
  }
}

function getRealtimeLocalTime(timezone = "Asia/Jakarta") {
  return formatTimeInZone(new Date(), timezone, true);
}

async function react(sock, jid, key, emoji) {
  try {
    await sock.sendMessage(jid, {
      react: { text: emoji, key }
    });
  } catch {}
}

async function typing(sock, jid, state = true) {
  try {
    await sock.sendPresenceUpdate(state ? "composing" : "paused", jid);
  } catch {}
}

async function searchLocation(query) {
  const { data } = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
    params: {
      name: query,
      count: 1,
      language: "id",
      format: "json",
    }
  });

  const item = data?.results?.[0];
  if (!item) return null;

  return {
    name: item.name,
    admin: item.admin1,
    country: item.country,
    lat: item.latitude,
    lon: item.longitude,
    timezone: item.timezone,
  };
}

async function getWeather(lat, lon, timezone) {
  const { data } = await axios.get("https://api.open-meteo.com/v1/forecast", {
    params: {
      latitude: lat,
      longitude: lon,
      timezone,
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
      ].join(","),
      daily: [
        "temperature_2m_max",
        "temperature_2m_min",
        "sunrise",
        "sunset",
      ].join(","),
      forecast_days: 1,
    }
  });

  return data;
}

function buildCaption(loc, data) {
  const c = data.current;
  const d = data.daily;

  const lokasi = [loc.name, loc.admin, loc.country].filter(Boolean).join(", ");
  const zona = getTimezoneLabel(loc.timezone);

  return `╭─〔 *CEK CUACA* 〕
│ 📍 *Lokasi*   : ${lokasi}
│ 🌍 *Zona*     : ${zona}
│ 🕒 *Sekarang* : ${getRealtimeLocalTime(loc.timezone)}
│
│ 🌤️ *Cuaca*   : ${weatherCodeToText(c.weather_code)}
│ 🌡️ *Suhu*    : ${formatNumber(c.temperature_2m, "°C")}
│ 🥵 *Terasa*  : ${formatNumber(c.apparent_temperature, "°C")}
│ 💧 *Lembap*  : ${formatNumber(c.relative_humidity_2m, "%")}
│ 🌧️ *Hujan*   : ${formatNumber(c.precipitation, " mm")}
│ 💨 *Angin*   : ${formatNumber(c.wind_speed_10m, " km/j")}
│ 🌗 *Status*  : ${c.is_day ? "Siang" : "Malam"}
│ 📡 *Update*  : ${formatTimeInZone(c.time, loc.timezone, true)}
│
│ 🌡️ *Max*     : ${formatNumber(d.temperature_2m_max?.[0], "°C")}
│ 🧊 *Min*     : ${formatNumber(d.temperature_2m_min?.[0], "°C")}
│ 🌅 *Sunrise* : ${formatTimeInZone(d.sunrise?.[0], loc.timezone, true)}
│ 🌇 *Sunset*  : ${formatTimeInZone(d.sunset?.[0], loc.timezone, true)}
╰────────────────`;
}

async function handle(sock, m) {
  const { remoteJid, message, content, prefix, command } = m;

  try {
    const q = content?.trim();

    if (!q) {
      return sock.sendMessage(remoteJid, {
        text:
`╭─〔 *CEK CUACA* 〕
│ Masukin nama kota
│
│ Contoh:
│ ⌕ ${prefix + command} Jakarta
│ ⌕ ${prefix + command} Pontianak
│ ⌕ ${prefix + command} Balikpapan
│ ⌕ ${prefix + command} Mataram
│ ⌕ ${prefix + command} Jayapura
╰────────────────`
      }, { quoted: message });
    }

    await Promise.all([
      react(sock, remoteJid, message.key, "⏳"),
      typing(sock, remoteJid, true)
    ]);

    const loc = await searchLocation(q);

    if (!loc) {
      await react(sock, remoteJid, message.key, "❌");
      return sock.sendMessage(remoteJid, {
        text: `❌ Lokasi "${q}" tidak ditemukan`
      }, { quoted: message });
    }

    const data = await getWeather(loc.lat, loc.lon, loc.timezone);

    await typing(sock, remoteJid, false);

    const text = buildCaption(loc, data);

    await sock.sendMessage(remoteJid, { text }, { quoted: message });

    await react(sock, remoteJid, message.key, "✅");

  } catch (err) {
    console.error(err);

    await typing(sock, remoteJid, false);
    await react(sock, remoteJid, message.key, "❌");

    await sock.sendMessage(remoteJid, {
      text: "❌ Gagal mengambil data cuaca"
    }, { quoted: message });
  }
}

export default {
  handle,
  Commands: ["cekcuaca", "cuaca", "weather"],
  OnlyPremium: false,
  OnlyOwner: false,
};

/* 
╭─〔 CEK CUACA 〕─⬣
│ GITHUB: https://github.com/GitaNraeni/miniature-engine
│ Created By: GitaNraeni
╰────────────⬣
*/
