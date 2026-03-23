import { reply } from "../../lib/utils.js";

function extractInviteCode(text = "") {
  const match = text.match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/i);
  return match?.[1] || null;
}

function cleanName(name) {
  if (!name) return "-";

  // kalau object → ambil field yang masuk akal
  if (typeof name === "object") {
    return (
      name?.text ||
      name?.name ||
      name?.subject ||
      name?.title ||
      "-"
    );
  }

  return String(name);
}

function pickCount(data) {
  return (
    data?.subscribers_count ||
    data?.subscribersCount ||
    data?.followers_count ||
    data?.members_count ||
    data?.thread_metadata?.subscribers_count ||
    data?.thread_metadata?.subscribersCount ||
    null
  );
}

function formatCount(num) {
  if (!num) return "-";
  return new Intl.NumberFormat("id-ID").format(num);
}

function getQuotedNewsletter(quoted) {
  const ctx =
    quoted?.message?.extendedTextMessage?.contextInfo ||
    quoted?.message?.imageMessage?.contextInfo ||
    quoted?.message?.videoMessage?.contextInfo ||
    quoted?.message?.documentMessage?.contextInfo ||
    quoted?.message?.contextInfo;

  const info = ctx?.forwardedNewsletterMessageInfo;

  if (!info) return null;

  return {
    id: info.newsletterJid,
    name: cleanName(info.newsletterName),
  };
}

async function getByInvite(sock, code) {
  const data = await sock.newsletterMetadata("invite", code);

  return {
    id: data?.id || data?.jid || data?.newsletterJid,
    name: cleanName(
      data?.name ||
      data?.thread_metadata?.name ||
      data?.meta?.name
    ),
    subscribers: pickCount(data),
    link: `https://whatsapp.com/channel/${code}`,
  };
}

async function getByJid(sock, jid) {
  try {
    const data = await sock.newsletterMetadata("jid", jid);

    return {
      id: data?.id || jid,
      name: cleanName(
        data?.name ||
        data?.thread_metadata?.name ||
        data?.meta?.name
      ),
      subscribers: pickCount(data),
      link: data?.invite
        ? `https://whatsapp.com/channel/${data.invite}`
        : null,
    };
  } catch {
    return {
      id: jid,
      name: "-",
      subscribers: null,
      link: null,
    };
  }
}

async function handle(sock, messageInfo) {
  const {
    m,
    message,
    remoteJid,
    content,
    quoted,
    prefix,
    command,
  } = messageInfo;

  try {
    await sock.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const code = extractInviteCode(content || "");
    const quotedData = getQuotedNewsletter(quoted);

    if (!code && !quotedData?.id) {
      await sock.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      return reply(
        m,
        `╭─〔 *CEK CHANNEL* 〕
│ Format salah gunakan ${prefix + command} link
│ 
│ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲: ${prefix + command} https://whatsapp.com/channel/xxxx
╰────────────────`
      );
    }

    let result;

    if (code) {
      result = await getByInvite(sock, code);
    } else {
      result = await getByJid(sock, quotedData.id);

      // fallback kalau name kosong
      if (!result.name || result.name === "-") {
        result.name = quotedData.name;
      }
    }

    const text =
`╭─〔 *CHANNEL INFO* 〕
│ 📢 𝗡𝗮𝗺𝗮: ${result.name}
│ 🆔 𝗜𝗗: ${result.id}
│ 👥 𝗣𝗲𝗻𝗴𝗶𝗸𝘂𝘁: ${formatCount(result.subscribers)}
${result.link ? `│ 🔗 𝗟𝗶𝗻𝗸: ${result.link}` : ""}
╰────────────────`;

    await reply(m, text);

    await sock.sendMessage(remoteJid, {
      react: { text: "✅", key: message.key },
    });

  } catch (err) {
    console.error("CEKIDCH ERROR:", err);

    await sock.sendMessage(remoteJid, {
      react: { text: "❌", key: message.key },
    });

    return reply(m, "❌ Gagal ambil data channel");
  }
}

export default {
  handle,
  Commands: ["cekidch", "idch"],
  OnlyOwner: true,
  OnlyPremium: false,
};

/* 
╭─〔 CEK ID CH 〕─⬣
│ GITHUB: https://github.com/GitaNraeni/miniature-engine
│ Created By: GitaNraeni
╰────────────⬣
*/
