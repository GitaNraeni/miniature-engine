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

// 🔥 FIX TIME (NO DATE PARSE)
function formatTime(iso) {
  if (!iso) return "-";

  try {
    const [datePart, timePart] = String(iso).split("T");
    if (!datePart || !timePart) return iso;

    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    const bulan = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
    ];

    return `${day} ${bulan[(month || 1) - 1]} ${year}, ${String(hour).padStart(2, "0")}.${String(minute).padStart(2, "0")}`;
  } catch {
    return iso;
  }
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
      timezone, // 🔥 pakai timezone asli
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

  return `╭─〔 *CEK CUACA* 〕
│
│ 📍 *Lokasi*   : ${lokasi}
│ 🌤️ *Cuaca*   : ${weatherCodeToText(c.weather_code)}
│ 🌡️ *Suhu*    : ${formatNumber(c.temperature_2m, "°C")}
│ 🥵 *Terasa*  : ${formatNumber(c.apparent_temperature, "°C")}
│ 💧 *Lembap*  : ${formatNumber(c.relative_humidity_2m, "%")}
│ 🌧️ *Hujan*   : ${formatNumber(c.precipitation, " mm")}
│ 💨 *Angin*   : ${formatNumber(c.wind_speed_10m, " km/j")}
│ 🕒 *Waktu*   : ${formatTime(c.time)}
│ 🌗 *Status*  : ${c.is_day ? "Siang" : "Malam"}
│
│ 🌡️ *Max*     : ${formatNumber(d.temperature_2m_max?.[0], "°C")}
│ 🧊 *Min*     : ${formatNumber(d.temperature_2m_min?.[0], "°C")}
│ 🌅 *Sunrise* : ${formatTime(d.sunrise?.[0])}
│ 🌇 *Sunset*  : ${formatTime(d.sunset?.[0])}
│
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
│
│ Masukin nama kota
│
│ Contoh:
│ ⌕ ${prefix + command} Jakarta
│ ⌕ ${prefix + command} Bandung
│
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
