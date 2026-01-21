const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
// Ensure uploads directory exists (in case mkdir failed or verifying)
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });
app.use(express.json());
app.use(express.static('public'));

// 1. 影片上傳、剪輯與 AI 標籤 API
app.post('/api/upload', upload.single('video'), async (req, res) => {
    // Basic validation
    if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded" });
    }

    const { title, thresholdType, thresholdValue, category } = req.body;
    const inputPath = req.file.path;
    const outputPath = `public/processed/${req.file.filename}.mp4`;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 使用 FFmpeg 進行自動標準化剪輯 (例如轉為 720p 節省算力)
    ffmpeg(inputPath)
        .size('1280x720')
        .save(outputPath)
        .on('end', async () => {
            // 呼叫 AI 服務進行自動標籤 (CLIP)
            try {
                // Determine absolute path for AI service (if running in same VM)
                // The prompt says "http://localhost:5000/tagging"
                const aiResult = await axios.post('http://localhost:5000/tagging', { filePath: path.resolve(outputPath) });

                // 將資料紀錄儲存 (這裡可串接 MongoDB 或本地 JSON)
                const videoData = {
                    title, category: aiResult.data.best_match, // AI 自動歸類
                    tags: aiResult.data.tags,
                    threshold: { type: thresholdType, value: thresholdValue },
                    url: outputPath
                };

                res.json({ message: "上傳並自動分類成功", data: videoData });
            } catch (err) {
                console.error("AI Service Error:", err.message);
                // Even if AI fails, return the video path so user knows processing finished
                res.status(200).json({ message: "影片處理成功，但 AI 分類失敗", data: { url: outputPath, error: "AI tagging failed" } });
            }
        })
        .on('error', (err) => {
            console.error("FFmpeg Error:", err);
            res.status(500).json({ error: "影片處理失敗" });
        });
});

// 2. 權限校驗 API (與 VM 2 連動)
app.post('/api/access', async (req, res) => {
    const { userAddress, videoId } = req.body;
    // 呼叫 VM 2 的 Bridge 檢查點數或勳章
    // NOTE: VM2_IP needs to be configured. For now keeping verbatim or handling error.
    try {
        const response = await axios.get(`http://VM2_IP:3000/user/${userAddress}/stats`);

        // 假設影片需要特定勳章
        if (response.data.hasMedal) {
            res.json({ access: true, streamUrl: "..." });
        } else {
            res.json({ access: false, reason: "勳章等級不足" });
        }
    } catch (err) {
        console.error("Bridge Error:", err.message);
        res.status(502).json({ error: "無法連接至 VM 2" });
    }
});

app.listen(4000, () => console.log('🚀 藏經閣後端啟動於 Port 4000'));
