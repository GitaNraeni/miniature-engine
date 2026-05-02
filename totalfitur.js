import fs from "fs";
import path from "path";
import config from "../../config.js";

// Fungsi untuk mencari semua file .js secara rekursif di dalam sebuah folder
function scanDir(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function (file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = scanDir(fullPath, arrayOfFiles);
    } else {
      if (file.endsWith(".js")) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

async function handle(sock, messageInfo) {
  // Tambahkan sender dan remoteJid ke destructuring
  const { m, sender, remoteJid } = messageInfo;

  try {
    // =========================================================
    // DAFTAR FOLDER YANG MAU DI-SCAN
    // Tambahkan atau kurangi nama folder di bawah ini sesuai struktur bot kamu
    // =========================================================
    const foldersToScan = ["./plugins", "./lib", "./handler", "./commands", "./message"];
    let allFiles = [];

    // Loop semua folder yang ada di daftar, kalau foldernya ada, langsung scan!
    foldersToScan.forEach(folder => {
      const dirPath = path.resolve(folder);
      if (fs.existsSync(dirPath)) {
        allFiles = scanDir(dirPath, allFiles);
      }
    });

    const totalPlugin = allFiles.length; // Jumlah total file .js
    let totalFitur = 0; // Jumlah total command/perintah

    let totalOwner = 0;
    let totalPremium = 0;
    let totalGroup = 0;
    let totalUmum = 0;

    // Baca isi kodenya satu per satu
    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");

      // Menghitung jumlah perintah di dalam array Commands: ["...", "..."]
      let commandCount = 1; // Default anggap 1 fitur per file
      const cmdMatch = content.match(/Commands:\s*\[(.*?)\]/is);
      
      if (cmdMatch && cmdMatch[1]) {
        // Pecah berdasarkan koma, hapus spasi & tanda kutip kosong
        const cmds = cmdMatch[1].split(',').filter(c => c.trim().replace(/['"]/g, '') !== '');
        if (cmds.length > 0) {
          commandCount = cmds.length;
        }
      }

      totalFitur += commandCount;

      // Deteksi kategori fitur berdasarkan kode di dalamnya
      const isOwner = /OnlyOwner:\s*true/i.test(content);
      const isPremium = /OnlyPremium:\s*true/i.test(content);
      const isGroup = /isGroup\s*=\s*true/i.test(content) || /OnlyGroup:\s*true/i.test(content) || /if\s*\(\!isGroup\)\s*return/i.test(content);

      if (isOwner) {
        totalOwner += commandCount;
      } else if (isPremium) {
        totalPremium += commandCount;
      } else if (isGroup) {
        totalGroup += commandCount;
      } else {
        totalUmum += commandCount;
      }
    }

    // 1. Ambil Nama Bot Otomatis dari Profil WhatsApp Bot (Fallback ke config)
    const botName = sock.user?.name || config.botname || config.botName || "Kimmy Bot";
    
    // 2. Format Mention User
    const mentionUser = `@${sender.split('@')[0]}`;

    // Tampilan UI Terminal/Menu Futuristik yang Keren
    const textTotal = `╭━━━〔 *📊 S T A T I S T I K  F I T U R* 〕━━━⬣
┃
┃ 🤖 *Bot Name*  : ${botName}
┃ 👤 *Req By*    : ${mentionUser}
┃ 📁 *Total Plugin* : ${totalPlugin} Files
┃ 📦 *Total Fitur*  : ${totalFitur} Commands
┃
┃ ┌──⭓ *D E T A I L  F I T U R*
┃ │ 👑 *Owner*   : ${totalOwner} Fitur
┃ │ 🌟 *Premium* : ${totalPremium} Fitur
┃ │ 👥 *Group*   : ${totalGroup} Fitur
┃ │ 🌐 *Umum*    : ${totalUmum} Fitur
┃ └───────⬣
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣`;

    // 3. Kirim pesan menggunakan sock.sendMessage agar mention berfungsi
    await sock.sendMessage(
      remoteJid, 
      { 
        text: textTotal, 
        mentions: [sender] // Array yang berisi JID orang yang mau di-tag
      }, 
      { quoted: m }
    );

  } catch (error) {
    console.error("Error pada fitur total fitur:", error);
    await sock.sendMessage(
      remoteJid, 
      { text: "⚠️ _Terjadi kesalahan saat membaca source code fitur._" }, 
      { quoted: m }
    );
  }
}

export default {
  handle,
  Commands: ["totalfitur", "statistik"],
  OnlyPremium: false,
  OnlyOwner: false,
};

/* 
╭─〔 TOTAL FITUR AUTO READ 〕─⬣
│ GITHUB: https://github.com/GitaNraeni/miniature-engine
│ Created By: GitaNraeni
╰────────────⬣
*/
