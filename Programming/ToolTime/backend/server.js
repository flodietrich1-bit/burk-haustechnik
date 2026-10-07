import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  processAndStorePlan,
  convertCadToPdf,
  detectLevelFromFilename,
  generatePlanName,
  PLAN_LEVELS
} from './cadConverterService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup to allow admin-web (localhost:5173 / localhost:8080)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Multer in-memory storage for high-speed streaming
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ToolTime CAD Backend Engine',
    timestamp: new Date().toISOString()
  });
});

/**
 * 1. Endpoint: Convert CAD directly to vector PDF (Preview / Download)
 * POST /api/convert-cad
 */
app.post('/api/convert-cad', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileName = req.file.originalname || 'plan.dwg';
    const floor = req.body.floor || detectLevelFromFilename(fileName);
    const projectName = req.body.projectName || 'Bauvorhaben';
    const planName = req.body.planName || generatePlanName(fileName, floor);

    const pdfBuffer = await convertCadToPdf({
      inputBuffer: req.file.buffer,
      fileName,
      floor,
      projectName,
      planName
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fileName, path.extname(fileName))}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error in /api/convert-cad:', err);
    res.status(500).json({ error: err.message || 'CAD conversion failed' });
  }
});

/**
 * 2. Endpoint: Upload, convert, and store in Firebase Storage & Firestore
 * POST /api/projects/:projectId/plans/upload-and-convert
 */
app.post('/api/projects/:projectId/plans/upload-and-convert', upload.single('file'), async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileName = req.file.originalname || 'plan.dwg';
    const planId = req.body.planId || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const floorOverride = req.body.floor && PLAN_LEVELS.includes(req.body.floor) ? req.body.floor : null;
    const nameOverride = req.body.name ? req.body.name.trim() : null;
    const projectName = req.body.projectName ? req.body.projectName.trim() : 'Bauvorhaben';

    console.log(`[CAD Backend] Processing plan ${planId} (${fileName}) for project ${projectId}...`);

    const result = await processAndStorePlan({
      projectId,
      planId,
      fileBuffer: req.file.buffer,
      fileName,
      floorOverride,
      nameOverride,
      projectName
    });

    res.json({
      success: true,
      plan: result.plan
    });
  } catch (err) {
    console.error('Error in /api/projects/:projectId/plans/upload-and-convert:', err);
    res.status(500).json({
      error: err.message || 'Plan processing failed',
      planId: req.body?.planId,
      status: 'error'
    });
  }
});

// Auto-start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ToolTime CAD Backend Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
