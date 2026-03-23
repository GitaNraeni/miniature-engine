import axios from "axios";

function normalizeText(text = "") {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function scoreCandidate(query, trackName, artistName) {
    const q = normalizeText(query);
    const t = normalizeText(trackName);
    const a = normalizeText(artistName);

    let score = 0;

    if (q.includes(t)) score += 5;
    if (q.includes(a)) score += 5;
    if (q === t) score += 8;
    if (q === a) score += 3;
    if (q === `${t} ${a}` || q === `${a} ${t}`) score += 10;

    return score;
}

function formatDuration(ms = 0) {
    if (!ms || isNaN(ms)) return "-";

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getHighResArtwork(item) {
    const art = item.artworkUrl100 || item.artworkUrl60 || item.artworkUrl30;
    if (!art) return null;

    return art
        .replace("100x100bb", "1000x1000bb")
        .replace("60x60bb", "1000x1000bb")
        .replace("30x30bb", "1000x1000bb");
}

async function react(sock, remoteJid, messageKey, emoji) {
    try {
        await sock.sendMessage(remoteJid, {
            react: {
                text: emoji,
                key: messageKey
            }
        });
    } catch {}
}

async function setTyping(sock, remoteJid, state = true) {
    try {
        await sock.sendPresenceUpdate(state ? "composing" : "paused", remoteJid);
    } catch {}
}

async function getLyrics(artist, title) {
    try {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        const { data } = await axios.get(url, { timeout: 15000 });

        if (!data?.lyrics) return null;

        return data.lyrics.trim();
    } catch {
        return null;
    }
}

async function searchSong(query) {
    const { data } = await axios.get("https://itunes.apple.com/search", {
        params: {
            term: query,
            entity: "song",
            limit: 10
        },
        timeout: 15000
    });

    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) return null;

    const sorted = results
        .map((item) => ({
            title: item.trackName,
            artist: item.artistName,
            duration: item.trackTimeMillis || 0,
            thumbnail: getHighResArtwork(item),
            raw: item,
            score: scoreCandidate(query, item.trackName, item.artistName)
        }))
        .sort((a, b) => b.score - a.score);

    return sorted[0] || null;
}

async function resolveSong(query) {
    const cleanQuery = query.trim();
    const attempts = [];

    const hasDash = cleanQuery.includes("-");
    const hasSlash = cleanQuery.includes("/");

    if (hasDash) {
        const [leftRaw, ...rest] = cleanQuery.split("-");
        const rightRaw = rest.join("-");

        const left = leftRaw.trim();
        const right = rightRaw.trim();

        if (left && right) {
            attempts.push({ title: left, artist: right });
            attempts.push({ title: right, artist: left });
        }
    }

    if (hasSlash) {
        const [leftRaw, ...rest] = cleanQuery.split("/");
        const rightRaw = rest.join("/");

        const left = leftRaw.trim();
        const right = rightRaw.trim();

        if (left && right) {
            attempts.push({ title: right, artist: left });
            attempts.push({ title: left, artist: right });
        }
    }

    for (const item of attempts) {
        const lyrics = await getLyrics(item.artist, item.title);
        if (lyrics) {
            const meta = await searchSong(`${item.artist} ${item.title}`);
            return {
                title: meta?.title || item.title,
                artist: meta?.artist || item.artist,
                duration: meta?.duration || 0,
                thumbnail: meta?.thumbnail || null,
                lyrics
            };
        }
    }

    const searched = await searchSong(cleanQuery);
    if (searched) {
        const lyrics = await getLyrics(searched.artist, searched.title);
        if (lyrics) {
            return {
                title: searched.title,
                artist: searched.artist,
                duration: searched.duration,
                thumbnail: searched.thumbnail,
                lyrics
            };
        }
    }

    const looseQuery = cleanQuery.replace(/[\/-]/g, " ");
    const searchedLoose = await searchSong(looseQuery);
    if (searchedLoose) {
        const lyrics = await getLyrics(searchedLoose.artist, searchedLoose.title);
        if (lyrics) {
            return {
                title: searchedLoose.title,
                artist: searchedLoose.artist,
                duration: searchedLoose.duration,
                thumbnail: searchedLoose.thumbnail,
                lyrics
            };
        }
    }

    return null;
}

function formatCaption({ title, artist, duration, lyrics }) {
    return [
        "╭─〔 *LIRIK LAGU* 〕",
        `│ 🎵 *Title*    : ${title || "-"}`,
        `│ 👤 *Artist*   : ${artist || "-"}`,
        `│ ⏱️ *Durasi*  : ${formatDuration(duration)}`,
        "╰────────────────",
        "",
        lyrics
    ].join("\n");
}

function splitMessage(text, max = 3500) {
    const chunks = [];
    let remaining = text;

    while (remaining.length > max) {
        let slice = remaining.slice(0, max);
        const lastBreak = slice.lastIndexOf("\n");

        if (lastBreak > 500) {
            slice = slice.slice(0, lastBreak);
        }

        chunks.push(slice);
        remaining = remaining.slice(slice.length).trimStart();
    }

    if (remaining.length) chunks.push(remaining);

    return chunks;
}

async function handle(sock, messageInfo) {
    const { remoteJid, message, content, prefix, command } = messageInfo;

    try {
        const query = content?.trim();

        if (!query) {
    return sock.sendMessage(remoteJid, {
        text:
`╭─〔 *LIRIK - HELP* 〕
│ *_Masukin judul / artis lagu_*
│ 
│ Contoh:
│ ⌕ ${prefix + command} Cincin - Hindia
│ ⌕ ${prefix + command} Hindia - Cincin
│ ⌕ ${prefix + command} Cincin
│ ⌕ ${prefix + command} Hindia/Cincin
╰────────────────`
    }, { quoted: message });
}

        await Promise.all([
            react(sock, remoteJid, message.key, "⏳"),
            setTyping(sock, remoteJid, true)
        ]);

        const result = await resolveSong(query);

        await setTyping(sock, remoteJid, false);

        if (!result) {
            await react(sock, remoteJid, message.key, "❌");
            return sock.sendMessage(remoteJid, {
                text: "❌ Lirik tidak ditemukan.\nCoba format: Judul - Artis"
            }, { quoted: message });
        }

        const caption = formatCaption(result);
        const parts = splitMessage(caption);

        if (result.thumbnail) {
            await sock.sendMessage(remoteJid, {
                image: { url: result.thumbnail },
                caption: parts[0]
            }, { quoted: message });

            for (let i = 1; i < parts.length; i++) {
                await sock.sendMessage(remoteJid, {
                    text: `${parts[i]}\n\n_(${i + 1}/${parts.length})_`
                });
            }
        } else {
            for (let i = 0; i < parts.length; i++) {
                const text = parts.length > 1
                    ? `${parts[i]}\n\n_(${i + 1}/${parts.length})_`
                    : parts[i];

                await sock.sendMessage(
                    remoteJid,
                    { text },
                    { quoted: i === 0 ? message : undefined }
                );
            }
        }

        await react(sock, remoteJid, message.key, "✅");
    } catch (err) {
        console.error("ERROR LIRIK:", err.message);

        await setTyping(sock, remoteJid, false);
        await react(sock, remoteJid, message.key, "❌");

        await sock.sendMessage(remoteJid, {
            text: `❌ Error:\n${err.message}`
        }, { quoted: message });
    }
}

export default {
    handle,
    Commands: ["lirik", "searchlirik", "lyrics"],
    OnlyPremium: false,
    OnlyOwner: false,
};

// GITHUB: https://github.com/GitaNraeni/miniature-engine