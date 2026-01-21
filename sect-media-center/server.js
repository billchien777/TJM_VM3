const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(express.json());
app.use(express.static('public'));

// 1. 影片上傳、剪輯與 AI 標籤 API
app.post('/api/upload', upload.single('video'), async (req, res) => {
    const { title, thresholdType, thresholdValue, category } = req.body;
    // ensure req.file exists
    if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded' });
    }
    const inputPath = req.file.path;
    const outputPath = \public/processed/\.mp4\;

    // 使用 FFmpeg 進行自動標準化剪輯 (例如轉為 720p 節省算力)
    ffmpeg(inputPath)
        .size('1280x720')
        .save(outputPath)
        .on('end', async () => {
            // 呼叫 AI 服務進行自動標籤 (CLIP)
            try {
                // Note: Ensure the Python AI service is running on port 5000
                const aiResult = await axios.post('http://localhost:5000/tagging', { filePath: outputPath });
                
                // 將資料紀錄儲存 (這裡可串接 MongoDB 或本地 JSON)
                const videoData = {
                    title, category: aiResult.data.best_match, // AI 自動歸類
                    tags: aiResult.data.tags,
                    threshold: { type: thresholdType, value: thresholdValue },
                    url: outputPath
                };
                
                res.json({ message: '上傳並自動分類成功', data: videoData });
            } catch (err) {
                console.error('AI Service Error:', err.message);
                res.status(500).json({ error: 'AI 分類失敗', details: err.message });
            }
        })
        .on('error', (err) => {
            console.error('FFmpeg Error:', err);
            res.status(500).json({ error: 'Video processing failed' });
        });
});

// 2. 權限校驗 API (與 VM 2 連動)
app.post('/api/access', async (req, res) => {
    const { userAddress, videoId } = req.body;
    // 呼叫 VM 2 的 Bridge 檢查點數或勳章
    try {
        const response = await axios.get(\http://VM2_IP:3000/user/\/stats\);
        
        // 假設影片需要特定勳章
        if (response.data.hasMedal) {
            res.json({ access: true, streamUrl: '...' });
        } else {
            res.json({ access: false, reason: '勳章等級不足' });
        }
    } catch (err) {
         res.status(500).json({ error: 'Access check failed', reason: err.message });
    }
});

app.listen(4000, () => console.log(' 藏經閣後端啟動於 Port 4000'));
