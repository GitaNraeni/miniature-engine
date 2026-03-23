import { updateList, getDataByGroupId } from "../../lib/list.js";
import { downloadQuotedMedia, downloadMedia, checkIfAdmin } from "../../lib/utils.js";
import { deleteCache } from "../../lib/globalCache.js";
import mess from "../../strings.js";

async function handle(sock, messageInfo) {
  const {
    remoteJid,
    isGroup,
    message,
    content,
    sender,
    isQuoted,
    command,
    prefix,
    type,
  } = messageInfo;

  try {
    let idList = remoteJid;

    if (!isGroup) {
      // Chat Pribadi
      idList = "owner";
    } else {
      const isAdmin = await checkIfAdmin(sock, remoteJid, sender);

      if (!isAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: mess.general.isAdmin },
          { quoted: message }
        );
        return;
      }
    }

    // Validasi isi pesan
    if (!content.trim()) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `_⚠️ Format Penggunaan:_\n\n_Contoh :_ *${
          prefix + command
        } payment | Halo @name Untuk Pembayaran Hanya Melalui Dana ...*\n\n_Apabila ingin update list dan gambar, silakan kirim/reply gambarnya dengan caption_ *${
          prefix + command
        }*`,
        message
      );
    }

    let text = "";
    let keyword = "";

    const parts = content.split("|");
    keyword = (parts.shift() || "").trim();
    text = parts.join("|");

    // Ambil isi dari quoted kalau ada
    if (isQuoted) {
      switch (isQuoted.type) {
        case "text":
          text ||= isQuoted.text || "-";
          break;
        case "image":
          text ||= isQuoted.content?.caption || "-";
          break;
        case "sticker":
          text ||= "sticker";
          break;
        case "video":
          text ||= isQuoted.content?.caption || "-";
          break;
        case "audio":
          text ||= "-";
          break;
        case "document":
          text ||= "-";
          break;
      }
    }

    const lowercaseKeyword = (keyword || "").trim().toLowerCase();

    if (!keyword || !text) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `⚠️ _Format tidak valid!_\n\nContoh : ${
          prefix + command
        } payment | Pembayaran Hanya Melalui Dana ...\n\n_Apabila ingin update list dan gambar, silakan kirim/reply gambarnya dengan caption_ *${
          prefix + command
        }*`,
        message
      );
    }

    // Cek apakah keyword ada
    const currentList = await getDataByGroupId(idList);

    if (!currentList?.list?.[lowercaseKeyword]) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `⚠️ _Keyword *${lowercaseKeyword}* tidak ditemukan._`,
        message
      );
    }

    const oldData = currentList.list[lowercaseKeyword] || {};

    // reset cache
    deleteCache(`list-${idList}`);

    // Tangani media jika ada
    const mediaUrl = await handleMedia(messageInfo);

    // Update ke database
    const result = await updateList(idList, lowercaseKeyword, {
      text: text || oldData.text || "",
      media: mediaUrl || oldData.media || null,
    });

    if (result.success) {
      return sendMessageWithTemplate(
        sock,
        remoteJid,
        `${lowercaseKeyword} _berhasil di perbarui_\n\n_Ketik *list* untuk melihat daftar list._`,
        message
      );
    }

    return sendMessageWithTemplate(
      sock,
      remoteJid,
      `❌ ${result.message}`,
      message
    );
  } catch (error) {
    console.error("Error processing command:", error);
    return sendMessageWithTemplate(
      sock,
      remoteJid,
      "_❌ Maaf, terjadi kesalahan saat memproses data._",
      message
    );
  }
}

// Fungsi untuk mengirim pesan dengan template
function sendMessageWithTemplate(sock, remoteJid, text, quoted) {
  return sock.sendMessage(remoteJid, { text }, { quoted });
}

// Fungsi untuk menangani unduhan media
async function handleMedia({ isQuoted, type, message }) {
  const supportedMediaTypes = [
    "image",
    "audio",
    "sticker",
    "video",
    "document",
  ];

  if (isQuoted && supportedMediaTypes.includes(isQuoted.type)) {
    return await downloadQuotedMedia(message, true);
  } else if (supportedMediaTypes.includes(type)) {
    return await downloadMedia(message, true);
  }
  return null;
}

export default {
  handle,
  Commands: ["updatelist"],
  OnlyPremium: false,
  OnlyOwner: false,
};

// GITHUB: https://github.com/GitaNraeni/miniature-engine