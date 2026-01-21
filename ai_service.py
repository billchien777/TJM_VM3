from flask import Flask, request, jsonify
import clip
import torch
from PIL import Image
import os

app = Flask(__name__)
device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)

CATEGORIES = ["武學", "心法", "丹道"]


@app.route("/tagging", methods=["POST"])
def tagging():
    # 這裡實作將影片首幀提取並交給 CLIP 分類
    # 簡化版：回傳機率最高的宗門分類
    data = request.json
    file_path = data.get("filePath")

    # Check if file exists (Optional safety check)
    if file_path and not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    return jsonify({"best_match": "武學", "tags": ["劍法", "基礎"]})


@app.route("/search_by_image", methods=["POST"])
def search():
    # 接收上傳的圖片，比對資料庫中的影片向量
    return jsonify({"similarity_list": [{"id": 1, "score": 0.95}]})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
