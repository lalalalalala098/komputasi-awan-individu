/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Lazy initialize Gemini client to avoid crashing on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("⚠️ GEMINI_API_KEY environment variable is not configured or uses placeholder. Running without AI capabilities.");
      return null;
    }
    
    try {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch (err) {
      console.error("❌ Failed to initialize GoogleGenAI client:", err);
      return null;
    }
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API Endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Server-side Gemini Eco-Consultation route
  app.post("/api/eco-consult", async (req, res) => {
    const { message, chatHistory } = req.body;

    if (!message) {
      res.status(400).json({ error: "Pesan (message) wajib diisi." });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Intelligently generate a themed, educational, highly contextual simulated response from the server!
      const query = message.toLowerCase();
      let replyText = "";
      if (query.includes("jelantah") || query.includes("minyak")) {
        replyText = "Halo Eco-Ranger! Minyak jelantah sisa penggorengan itu sangat berbahaya jika dibuang di wastafel dapur karena bisa membeku, menyumbat saluran pipa RT, serta mencemari cadangan air tanah warga. Kamu bisa menyaringnya lalu menyimpannya di botol bekas. Setelah cukup, barter langsung dengan Pak Budi via peta warga untuk diolah menjadi lilin aromaterapi warga, atau donasikan langsung ke kampanye warga untuk koin token melimpah!";
      } else if (query.includes("makan") || query.includes("pakan") || query.includes("kesukaan")) {
        replyText = "Sebagai virtual Eco-Guardian yang gemar melestarikan klorofil, pakan terfavoritku adalah sisa brokoli, kulit pisang matang, kulit jeruk, atau sayuran basah organik sisa dapurmu! Dengan rajin memberi makan sisa organik ini, kamu membantuku berevolusi ke bentuk raksasa klorofil yang tangguh sekaligus mengurangi timbunan sampah basah di kelurahan.";
      } else if (query.includes("kardus") || query.includes("kertas") || query.includes("pupuk")) {
        replyText = "Kardus keras atau kertas bekas yang hancur sangat kaya selulosa dan menjadi pakan favorit cacing tanah komposting. Bu Retno di RT seberang sedang menggarap kebun kascing (kompos cacing) swadaya warga dan butuh suplai kardus basah. Hubungi Bu Retno lewat peta warga untuk barter kardusmu dengan pupuk organik subur buat tanamanmu!";
      } else if (query.includes("plastik") || query.includes("botol")) {
        replyText = "Botol plastik PET bening yang kering memiliki nilai daur ulang industri yang tinggi! Bersihkan botol plastikmu dari sisa minuman, pencet hingga gepeng, lalu donasikan langsung ke kampanye warga di tab Event. Kamu akan memperoleh koin Eco-Tokens instan dan jadwal kurir gratis untuk jemput sampahmu!";
      } else {
        replyText = `Halo! Aku adalah Eco-Guardian Guru AI. Pertanyaanmu tentang "${message}" luar biasa menginspirasi jiwa pahlawan sampahmu! Di kelurahan kita, pisahkan selalu sampah kering (wadah plastik, lembaran kertas, kaleng minuman) dari sampah basah dapur. Jangan ragu barter dengan tetangga rukun warga atau konsultasi denganku lagi. Semangat menanam benih kelestarian! 🌿✨`;
      }
      res.json({ reply: replyText, note: "simulated" });
      return;
    }

    try {
      // Build conversation context from simple chatHistory provided by frontend
      const historyStr = (chatHistory || [])
        .map((m: any) => `${m.senderName}: ${m.text}`)
        .join("\n");

      const systemInstruction = 
        `Anda adalah "Eco-Guardian Guru AI", sesosok monster penjaga lingkungan virtual yang bijak, ramah, periang, dan bersemangat. ` +
        `Tugas Anda adalah memandu warga atau anak-anak di RT 05 dalam mengelola sisa-sisa sampah rumah tangga dan memfasilitasi interaksi barter sosial sampah nyata dengan tetangga. ` +
        `Aturan jawaban:\n` +
        `1. Berikan penjelasan dalam Bahasa Indonesia yang segar, inspiratif, edukatif, dan santun.\n` +
        `2. Berikan kiat praktis dan aplikatif (seperti cara membuat kompos dari sayuran, mendaur ulang minyak jelantah menjadi lilin sabun, merendam kertas karton untuk kompos cacing).\n` +
        `3. Selalu semangati mereka untuk terus login dan berkontribusi barter pakan Eco-Guardian.\n` +
        `4. Jaga agar tanggapan Anda ringkas, jelas, dan berkisar antara 2-3 paragraf saja.`;

      const prompt = 
        `Berikut adalah riwayat percakapan sebelumnya:\n${historyStr}\n\n` +
        `Pertanyaan Warga: "${message}"\n\n` +
        `Tanggapan Eco-Guardian Guru AI:`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const replyText = response.text?.trim() || "Maaf, aku sedang tidak fokus menyerap energi hijau. Bisa kamu ulangi perkataanmu?";
      res.json({ reply: replyText });
    } catch (err: any) {
      console.error("❌ Error interacting with Gemini API:", err);
      res.status(500).json({ error: "Terjadi gangguan saat memproses AI Guru.", details: err.message });
    }
  });

  // Vite middleware setup for Development, static path for Production
  if (process.env.NODE_ENV !== "production") {
    console.log("🛠️ Starting Express server in DEVELOPMENT mode with Vite Middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("🚀 Starting Express server in PRODUCTION mode");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve index.html for all non-API paths
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌍 Eco-Guardian Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start Eco-Guardian Server:", error);
});
