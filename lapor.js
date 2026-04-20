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
 
async function handle(sock, messageInfo) {
  const { m, remoteJid, content, prefix, command, sender, pushName, isGroup } =
    messageInfo;
 
  try {
    if (!content || !content.trim()) {
      return await reply(
        m,
        `⚠️ _Format salah!_\n\n` +
          `Contoh:\n` +
          `*${prefix + command}* fitur .tt tidak berfungsi/min tambahin fitur abcd`
      );
    }
 
    if (content.trim().length < 10) {
      return await reply(
        m,
        "⚠️ _Laporan terlalu pendek. Minimal 10 karakter ya._"
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
 
    if (isGroup) {
      groupName = await getGroupName(sock, remoteJid);
      groupId = remoteJid;
      asalChat = "Grup";
    }
 
    const textLaporan = `┏━━━〔 *LAPORAN MASUK* 〕━━━⬣
┣ 👤 *Nama:* ${senderName}
┣ 📱 *Nomor:* wa.me/${senderNumber}
┣ 🆔 *JID:* ${sender}
┣ 💬 *Dari:* ${asalChat}
${isGroup ? `┣ 🏷️ *Nama Grup:* ${groupName}\n┣ 🆔 *ID Grup:* ${groupId}\n` : ""}┣ 📝 *Pesan:*
┣ ${content.trim().split("\n").join("\n┣ ")}
┗━━━━━━━━━━━━━━━━━━⬣`;
 
    let berhasilKirim = 0;
 
    for (const owner of owners) {
      try {
        await sock.sendMessage(owner, { text: textLaporan }, { quoted: m });
        berhasilKirim++;
      } catch (err) {
        console.error(`Gagal kirim laporan ke owner ${owner}:`, err.message);
      }
    }
 
    if (berhasilKirim === 0) {
      return await reply(
        m,
        "⚠️ _Laporan gagal dikirim ke semua owner._"
      );
    }
 
    await reply(
      m,
      "✅ _Laporan berhasil dikirim ke owner._\nTerima kasih sudah melapor ya."
    );
  } catch (error) {
    console.error("Error pada fitur lapor:", error);
    await reply(m, "⚠️ _Terjadi kesalahan saat mengirim laporan._");
  }
}
 
export default {
  handle,
  Commands: ["lapor"],
  OnlyPremium: false,
  OnlyOwner: false,
};
 
/* 
╭─〔 LAPOR OWNER 〕─⬣
│ GITHUB: https://github.com/GitaNraeni/miniature-engine
│ Created By: GitaNraeni
╰────────────⬣
*/
