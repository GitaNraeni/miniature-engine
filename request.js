import { reply } from "../../lib/utils.js";
import { listOwner } from "../../lib/users.js";
import { getGroupMetadata } from "../../lib/cache.js";

function formatNumber(jid = "") {
  return jid.split("@")[0] || jid;
}

async function getGroupName(sock, remoteJid) {
  try {
    const metadata = await getGroupMetadata(sock, remoteJid);
    return metadata?.subject || "Grup Tidak Diketahui";
  } catch {
    return "Grup Tidak Diketahui";
  }
}

async function getGroupLink(sock, remoteJid) {
  try {
    const inviteCode = await sock.groupInviteCode(remoteJid);
    return inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : "-";
  } catch {
    return "-";
  }
}

async function handle(sock, messageInfo) {
  const { m, remoteJid, content, prefix, command, sender, pushName, isGroup } =
    messageInfo;

  try {
    if (!content || !content.trim()) {
      return await reply(
        m,
        `⚠️ _Format salah!_\n\n` +
          `Contoh penggunaan:\n` +
          `*${prefix + command}* min tambahin fitur tebak lagu dong`
      );
    }

    if (content.trim().length < 10) {
      return await reply(
        m,
        "⚠️ _Request terlalu pendek. Coba jelaskan detail fiturnya (Minimal 10 karakter ya)._"
      );
    }

    const owners = listOwner();
    if (!owners || owners.length === 0) {
      return await reply(
        m,
        "⚠️ _Owner belum terdaftar di database/config._"
      );
    }

    const senderNumber = formatNumber(sender);
    const senderName = pushName || "Tanpa Nama";

    let asalChat = "Private Chat";
    let groupName = "-";
    let groupId = "-";
    let groupLink = "-";

    if (isGroup) {
      groupName = await getGroupName(sock, remoteJid);
      groupId = remoteJid;
      groupLink = await getGroupLink(sock, remoteJid);
      asalChat = "Grup";
    }

    // Tampilan teks khusus Request yang rapi dan futuristik
    const textRequest = `🔔 *F E A T U R E   R E Q U E S T* 🔔
──────────────────────────

👤 *I N F O  U S E R*
⬡ *Nama  :* ${senderName}
⬡ *Wa.me :* wa.me/${senderNumber}
⬡ *JID   :* ${sender}

📍 *I N F O  L O K A S I*
⬡ *Dari  :* ${asalChat}
⬡ *Grup  :* ${isGroup ? groupName : "-"}
⬡ *Link  :* ${isGroup ? groupLink : "-"}
⬡ *ID    :* ${isGroup ? groupId : "-"}

📩 *D E T A I L   R E Q U E S T*
┌─────────────────────────
│ ${content.trim().split("\n").join("\n│ ")}
└─────────────────────────`;

    let berhasilKirim = 0;

    for (const owner of owners) {
      try {
        await sock.sendMessage(owner, { text: textRequest }, { quoted: m });
        berhasilKirim++;
      } catch (err) {
        console.error(`Gagal kirim request ke owner ${owner}:`, err.message);
      }
    }

    if (berhasilKirim === 0) {
      return await reply(
        m,
        "⚠️ _Request gagal dikirim ke semua owner._"
      );
    }

    await reply(
      m,
      "✅ _Request fitur berhasil dikirim ke Owner._\nTerima kasih atas idenya, semoga cepat direalisasikan! 🚀"
    );
  } catch (error) {
    console.error("Error pada fitur request:", error);
    await reply(m, "⚠️ _Terjadi kesalahan saat mengirim request._");
  }
}

export default {
  handle,
  Commands: ["req", "request"], // Command khusus request
  OnlyPremium: false,
  OnlyOwner: false,
};

/* 
╭─〔 REQUEST OWNER 〕─⬣
│ GITHUB: https://github.com/GitaNraeni/miniature-engine
│ Created By: GitaNraeni
╰────────────⬣
*/
