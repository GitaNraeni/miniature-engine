import axios from "axios";

async function handle(sock, messageInfo) {
  const { remoteJid, message, content, prefix, command } = messageInfo;

  try {
    if (!content) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭─〔 🎮 *ROBLOX STALK* 〕─⬣
│ *Format :*
│ ${prefix + command} username
│
│ *Contoh :*
│ ${prefix + command} builderman
╰────────────⬣`,
        },
        { quoted: message }
      );
    }

    const username = content.trim();

    await sock.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    // 1) Username -> User ID
    const lookupResponse = await axios.post(
      "https://users.roblox.com/v1/usernames/users",
      {
        usernames: [username],
        excludeBannedUsers: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const lookupData = lookupResponse.data;

    if (!lookupData?.data?.length) {
      throw new Error("Username Roblox tidak ditemukan");
    }

    const userId = lookupData.data[0].id;

    // 2) Ambil semua data sekaligus
    const [
      userResponse,
      thumbnailResponse,
      friendsResponse,
      followersResponse,
      followingsResponse,
    ] = await Promise.allSettled([
      axios.get(`https://users.roblox.com/v1/users/${userId}`),
      axios.get(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
      ),
      axios.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
      axios.get(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
      axios.get(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
    ]);

    if (userResponse.status !== "fulfilled") {
      throw new Error("Gagal mengambil detail user Roblox");
    }

    const user = userResponse.value.data;

    const thumbnail =
      thumbnailResponse.status === "fulfilled"
        ? thumbnailResponse.value?.data?.data?.[0]?.imageUrl
        : null;

    const friends =
      friendsResponse.status === "fulfilled"
        ? friendsResponse.value?.data?.count ?? 0
        : 0;

    const followers =
      followersResponse.status === "fulfilled"
        ? followersResponse.value?.data?.count ?? 0
        : 0;

    const followings =
      followingsResponse.status === "fulfilled"
        ? followingsResponse.value?.data?.count ?? 0
        : 0;

    // Format tanggal
    let created = "-";
    if (user?.created) {
      const d = new Date(user.created);
      created = d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }

    const profileUrl = `https://www.roblox.com/users/${user.id}/profile`;

    const teks = `╭─〔 🎮 *ROBLOX PROFILE* 〕─⬣
│ 👤 *Username* : ${user?.name || "-"}
│ 🏷️ *Nickname* : ${user?.displayName || "-"}
│ 🆔 *User ID* : ${user?.id || "-"}
│ 📅 *Created Account* : ${created}
├────────────⬣
│ 🚫 *Banned* : ${user?.isBanned ? "Yes" : "No"}
│ ✅ *Verified* : ${user?.hasVerifiedBadge ? "Yes" : "No"}
├────────────⬣
│ 👥 *Friends* : ${friends}
│ 📈 *Followers* : ${followers}
│ 📉 *Following* : ${followings}
├────────────⬣
│ 📝 *Bio / About*
│ ${user?.description?.trim() || "Tidak ada bio"}
├────────────⬣
│ 🔗 *Profile Link*
│ ${profileUrl}
╰────────────⬣`.trim();

    if (thumbnail) {
      await sock.sendMessage(
        remoteJid,
        {
          image: { url: thumbnail },
          caption: teks,
        },
        { quoted: message }
      );
    } else {
      await sock.sendMessage(
        remoteJid,
        { text: teks },
        { quoted: message }
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "✨", key: message.key },
    });
  } catch (err) {
    console.error("Roblox Stalker Error:", err?.response?.data || err?.message);

    await sock.sendMessage(
      remoteJid,
      {
        text: `╭─〔 ❌ *ERROR* 〕─⬣
│ Gagal mengambil data Roblox.
│ 💡 *Detail :*
│ ${err?.response?.data?.errors?.[0]?.message || err?.message || "Unknown error"}
╰────────────⬣`,
      },
      { quoted: message }
    );

    await sock.sendMessage(remoteJid, {
      react: { text: "❌", key: message.key },
    });
  }
}

export default {
  handle,
  Commands: ["roblox", "robloxstalk", "stalroblox"],
  OnlyPremium: false,
  OnlyOwner: false,
  limitDeduction: 2,
};

/* 
╭─〔 ROBLOX STALK 〕─⬣
│ GITHUB: https://github.com/GitaNraeni/miniature-engine
│ Created By: GitaNraeni
╰────────────⬣
*/
