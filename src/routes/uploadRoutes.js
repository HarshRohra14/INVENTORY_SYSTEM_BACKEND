const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/multerConfig');
const path = require('path');

// POST /api/upload - accept multiple files under field name 'files'
router.post('/', upload.array('files', 20), async (req, res) => {
	try {
		if (!req.files || req.files.length === 0) {
			return res.status(400).json({ success: false, message: 'No files uploaded' });
		}

		const filePaths = req.files.map((f) => {
			// Return a URL path that can be used to fetch the file
			const filename = path.basename(f.path);
			return `/uploads/${filename}`;
		});

		res.status(201).json({ success: true, files: filePaths });
	} catch (err) {
		console.error('Upload error:', err);
		res.status(500).json({ success: false, message: 'Failed to upload files' });
	}
});

module.exports = router;
