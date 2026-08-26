const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const asyncHandler = require('../lib/asyncHandler');
const { getSupabaseClient } = require('../lib/supabaseClient');
const { UPLOADS_DIR } = require('../lib/config');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Direct Supabase Storage CDN Streaming: uploaded files are mirrored to the
// 'media' Storage bucket for permanent hosting; falls back to serving from
// local disk (via the /uploads static route) if Storage is unavailable.
router.post('/upload', upload.array('photos', 10), asyncHandler(async (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const supabase = getSupabaseClient();
  const urls = [];

  for (const file of req.files) {
    let finalUrl = `/uploads/${file.filename}`;

    if (supabase && supabase.storage) {
      try {
        // Auto-ensure storage buckets exist
        await supabase.storage.createBucket('product-images', { public: true }).catch(() => {});
        await supabase.storage.createBucket('media', { public: true }).catch(() => {});

        const fileContent = fs.readFileSync(file.path);
        const targetBucket = 'product-images';
        const targetPath = `products/${file.filename}`;

        const { data: sData, error: sErr } = await supabase.storage.from(targetBucket).upload(targetPath, fileContent, {
          contentType: file.mimetype || (file.filename.endsWith('.mov') ? 'video/quicktime' : 'video/mp4'),
          upsert: true
        });

        if (!sErr && sData) {
          const { data: pubData } = supabase.storage.from(targetBucket).getPublicUrl(targetPath);
          if (pubData && pubData.publicUrl) {
            finalUrl = pubData.publicUrl;
            console.log('✅ Supabase Storage Upload Success:', finalUrl);
          }
        } else if (sErr) {
          console.warn('Supabase upload error:', sErr.message);
        }
      } catch (err) {
        console.warn('Supabase upload exception:', err.message);
      }
    }

    urls.push(finalUrl);
  }

  res.json({ success: true, urls, count: urls.length });
}));

module.exports = router;
