import { addSewa } from "../../lib/sewa.js";
import { findGroup, updateGroup } from "../../lib/group.js";
import config from "../../config.js";
import { selisihHari, hariini } from "../../lib/utils.js";
import { deleteCache } from "../../lib/globalCache.js";

async function handle(sock, messageInfo) {
  let { remoteJid, message, content, prefix, command } = messageInfo;

  if (!content || content.trim() === "") {
    return await sock.sendMessage(
      remoteJid,
      {
        text: `_⚠️ Format Penggunaan:_ \n\n_💬 Contoh:_ _*${
          prefix + command
        } https://chat.whatsapp.com/xxx 30*_\n\n_*30* = 30 hari_`,
      },
      { quoted: message }
    );
  }

  const args = content.trim().split(" ");
  if (args.length < 2) {
    return await sock.sendMessage(
      remoteJid,
      { text: `⚠️ Format salah.\nContoh: *${prefix + command} link 30*` },
      { quoted: message }
    );
  }

  const linkGrub = args[0];
  const totalHari = parseInt(args[1], 10);

  if (!linkGrub.includes("chat.whatsapp.com")) {
    return await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Link harus berupa `chat.whatsapp.com`" },
      { quoted: message }
    );
  }

  if (isNaN(totalHari) || totalHari <= 0) {
    return await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Jumlah hari harus angka positif." },
      { quoted: message }
    );
  }

  const result_sewa = linkGrub.split("https://chat.whatsapp.com/")[1];

  try {
    // Ambil info grup
    const res = await sock.query({
      tag: "iq",
      attrs: { type: "get", xmlns: "w:g2", to: "@g.us" },
      content: [{ tag: "invite", attrs: { code: result_sewa } }],
    });

    const groupJid = res.content[0].attrs.id + "@g.us";
    const groupName = res.content[0].attrs.subject || "Unknown";

    // Join grup
    await sock.groupAcceptInvite(result_sewa);

    // === Hitung expired ===
    const expirationDate = new Date(Date.now() + totalHari * 24 * 60 * 60 * 1000);
    const timestampExpiration = expirationDate.getTime();

    // === Tambah ke Sewa ===
    await addSewa(groupJid, {
      linkGrub: linkGrub,
      start: hariini,
      expired: timestampExpiration,
    });

    deleteCache(`sewa-${groupJid}`);

    // === Aktifkan Premium di Group ===
    let groupData = await findGroup(groupJid);
    if (!groupData) {
      groupData = {
        fitur: {},
        userBlock: [],
        createdAt: new Date().toISOString(),
      };
    }

    groupData.fitur.premium = expirationDate.toISOString();
    groupData.updatedAt = new Date().toISOString();

    await updateGroup(groupJid, groupData);

    // === Kirim Notifikasi ===
    await sock.sendMessage(
      remoteJid,
      {
        text: `✅ *Sewa Premium Berhasil!*

🧾 *Group*: ${groupName}
🔗 *Link*: ${linkGrub}
⏰ *Durasi*: ${totalHari} hari
📅 *Expired*: ${selisihHari(timestampExpiration)}

✅ Bot sudah join + **Premium** aktif di grup tersebut.`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error(error);
    let info = "Pastikan link grup valid dan bot belum di-kick sebelumnya.";

    if (error.message?.includes("not-authorized")) {
      info = "Bot pernah dikeluarkan dari grup. Undang manual dulu.";
    }

    await sock.sendMessage(
      remoteJid,
      { text: `⚠️ Gagal bergabung/mengatur sewaprem.\n\n${info}` },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["sewaprem", "addsewaprem", "sewa+prem"],
  OnlyPremium: false,
  OnlyOwner: true,
  limitDeduction: 0,
};
