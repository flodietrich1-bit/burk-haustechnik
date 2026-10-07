import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Layer color palette for TGA / CAD installation plans
 */
const LAYER_COLORS = {
  ARCH_WALL: '#1E293B',       // Dark Charcoal
  WALL: '#1E293B',
  WAND: '#1E293B',
  ROOM: '#4338CA',            // Indigo
  RAUM: '#4338CA',
  SAN_WC: '#0D9488',          // Teal
  SAN_WASHBASIN: '#0D9488',
  SAN_SHOWER: '#0D9488',
  SANITAER: '#0D9488',
  SAN_PIPES: '#2563EB',       // Blue (Kaltwasser / Trinkwasser)
  SAN_PIPE_COLD: '#2563EB',
  SAN_PIPE_HOT: '#DC2626',    // Red (Warmwasser / Zirkulation)
  HEATING_PIPES: '#DC2626',   // Red (Heizung Vorlauf)
  HEATING_RETURN: '#9333EA',  // Purple (Heizung Rücklauf)
  HEIZUNG: '#DC2626',
  LUEFTUNG: '#059669',        // Green
  VENTILATION: '#059669',
  DEFAULT: '#475569'          // Slate
};

/**
 * Render a high-resolution vector architectural blueprint PDF from parsed DXF/DWG entities.
 */
export async function renderCadToVectorPdf({
  entities = [],
  rooms = [],
  title = 'Montageplan',
  floor = 'EG',
  fileName = 'plan.dwg',
  projectName = 'Bauvorhaben',
  cadFormat = 'AutoCAD DWG',
  outputPath = null
}) {
  return new Promise((resolve, reject) => {
    try {
      // DIN A3 Landscape (1190.55 x 841.89 points)
      const doc = new PDFDocument({
        size: 'A3',
        layout: 'landscape',
        margin: 36,
        info: {
          Title: `${title} - ${projectName}`,
          Author: 'BURK Haustechnik',
          Subject: `Ausführungs- und Montageplan ${floor}`,
          Creator: 'ToolTime CAD Engine'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (outputPath) {
          fs.writeFileSync(outputPath, buffer);
        }
        resolve(buffer);
      });

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 36;

      // 1. Blueprint Outer Background & Drawing Border
      doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2)
        .lineWidth(1.5)
        .strokeColor('#1E293B')
        .stroke();

      // Subtle inner margin line (DIN architectural drawing standard)
      doc.rect(margin + 6, margin + 6, pageWidth - (margin + 6) * 2, pageHeight - (margin + 6) * 2)
        .lineWidth(0.5)
        .strokeColor('#CBD5E1')
        .stroke();

      // 2. Title Block (DIN Planstempel) in bottom-right corner
      const stampWidth = 320;
      const stampHeight = 110;
      const stampX = pageWidth - margin - stampWidth;
      const stampY = pageHeight - margin - stampHeight;

      doc.rect(stampX, stampY, stampWidth, stampHeight)
        .fillAndStroke('#F8FAFC', '#1E293B');

      // Title block division lines
      doc.moveTo(stampX, stampY + 32).lineTo(stampX + stampWidth, stampY + 32).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
      doc.moveTo(stampX, stampY + 70).lineTo(stampX + stampWidth, stampY + 70).stroke();
      doc.moveTo(stampX + 170, stampY + 32).lineTo(stampX + 170, stampY + stampHeight).stroke();

      // Header Company
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1E3A8A')
        .text('BURK HAUSTECHNIK GMBH', stampX + 12, stampY + 8);
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748B')
        .text('Sanitär · Heizung · Klimatechnik · TGA Montageplanung', stampX + 12, stampY + 20);

      // Plan Details Left Column
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('BAUVORHABEN:', stampX + 12, stampY + 36);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(projectName, stampX + 12, stampY + 45, { width: 150 });
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('GESCHOSS / EBENE:', stampX + 12, stampY + 76);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2563EB').text(floor, stampX + 12, stampY + 86);

      // Plan Details Right Column
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('PLANINHALT:', stampX + 178, stampY + 36);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(title, stampX + 178, stampY + 46, { width: 130 });
      doc.fontSize(6.5).font('Helvetica').fillColor('#64748B').text(`Datei: ${fileName}`, stampX + 178, stampY + 74, { width: 135 });
      doc.fontSize(6.5).font('Helvetica').fillColor('#64748B').text(`Stand: ${new Date().toLocaleDateString('de-DE')} · ${cadFormat}`, stampX + 178, stampY + 88);

      // 3. Drawing Canvas Area
      const drawArea = {
        x: margin + 18,
        y: margin + 18,
        width: pageWidth - (margin * 2) - 36,
        height: pageHeight - (margin * 2) - stampHeight - 20
      };

      // Background grid (architectural millimeter grid)
      doc.save();
      const gridSize = 40;
      doc.lineWidth(0.25).strokeColor('#F1F5F9');
      for (let x = drawArea.x; x <= drawArea.x + drawArea.width; x += gridSize) {
        doc.moveTo(x, drawArea.y).lineTo(x, drawArea.y + drawArea.height).stroke();
      }
      for (let y = drawArea.y; y <= drawArea.y + drawArea.height; y += gridSize) {
        doc.moveTo(drawArea.x, y).lineTo(drawArea.x + drawArea.width, y).stroke();
      }
      doc.restore();

      // 4. Calculate Bounding Box of Entities
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      entities.forEach(e => {
        if (e.type === 'LINE' && e.vertices) {
          e.vertices.forEach(v => {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
          });
        } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices) {
          e.vertices.forEach(v => {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
          });
        } else if (e.type === 'CIRCLE' && e.center) {
          minX = Math.min(minX, e.center.x - (e.radius || 0));
          maxX = Math.max(maxX, e.center.x + (e.radius || 0));
          minY = Math.min(minY, e.center.y - (e.radius || 0));
          maxY = Math.max(maxY, e.center.y + (e.radius || 0));
        } else if ((e.type === 'TEXT' || e.type === 'MTEXT') && (e.startPoint || e.position)) {
          const pt = e.startPoint || e.position;
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y);
          maxY = Math.max(maxY, pt.y);
        }
      });

      // If no valid entities, synthesize a structured room layout view
      if (minX === Infinity || maxX === -Infinity || (maxX - minX < 1) || (maxY - minY < 1)) {
        renderSynthesizedRoomLayout(doc, drawArea, rooms, floor);
      } else {
        // Compute scale and translation to fit drawing area
        const bboxWidth = Math.max(1, maxX - minX);
        const bboxHeight = Math.max(1, maxY - minY);
        const scaleX = (drawArea.width * 0.85) / bboxWidth;
        const scaleY = (drawArea.height * 0.85) / bboxHeight;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = drawArea.x + (drawArea.width - bboxWidth * scale) / 2 - (minX * scale);
        // CAD Y-axis is inverted relative to PDF Y-axis
        const offsetY = drawArea.y + drawArea.height - (drawArea.height - bboxHeight * scale) / 2 + (minY * scale);

        const mapX = (x) => offsetX + (x * scale);
        const mapY = (y) => offsetY - (y * scale);

        // Render CAD Entities
        entities.forEach(e => {
          const layerUpper = (e.layer || '').toUpperCase();
          const strokeColor = LAYER_COLORS[layerUpper] || LAYER_COLORS.DEFAULT;

          doc.save();

          if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
            const isWall = layerUpper.includes('WALL') || layerUpper.includes('WAND');
            doc.lineWidth(isWall ? 2.0 : 1.2)
              .strokeColor(strokeColor)
              .moveTo(mapX(e.vertices[0].x), mapY(e.vertices[0].y))
              .lineTo(mapX(e.vertices[1].x), mapY(e.vertices[1].y))
              .stroke();
          } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices && e.vertices.length > 1) {
            doc.lineWidth(1.2).strokeColor(strokeColor);
            doc.moveTo(mapX(e.vertices[0].x), mapY(e.vertices[0].y));
            for (let i = 1; i < e.vertices.length; i++) {
              doc.lineTo(mapX(e.vertices[i].x), mapY(e.vertices[i].y));
            }
            if (e.shape || e.closed) doc.closePath();
            doc.stroke();
          } else if (e.type === 'CIRCLE' && e.center) {
            doc.lineWidth(1.2).strokeColor(strokeColor);
            const r = (e.radius || 5) * scale;
            doc.circle(mapX(e.center.x), mapY(e.center.y), Math.max(1.5, r)).stroke();
          } else if ((e.type === 'TEXT' || e.type === 'MTEXT')) {
            const pt = e.startPoint || e.position || { x: minX, y: minY };
            const textStr = (e.text || e.string || '').replace(/\\[A-Za-z0-9_]+;/g, '').trim();
            if (textStr) {
              const tx = mapX(pt.x);
              const ty = mapY(pt.y);
              doc.fontSize(8.5).font('Helvetica-Bold').fillColor(strokeColor)
                .text(textStr, tx, ty - 8, { lineBreak: false });
            }
          }

          doc.restore();
        });
      }

      // 5. Watermark & Legend on Top Left
      renderLegend(doc, margin + 14, margin + 14);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function renderLegend(doc, x, y) {
  doc.save();
  doc.rect(x, y, 175, 80).fillAndStroke('rgba(255,255,255,0.92)', '#CBD5E1');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#1E293B').text('LEGENDE / GEWERKE', x + 8, y + 8);
  
  const items = [
    { label: 'Architektur / Wände', color: '#1E293B', width: 2.0 },
    { label: 'Trinkwasser kalt (PEX/Edelstahl)', color: '#2563EB', width: 1.5 },
    { label: 'Trinkwasser warm / Zirkulation', color: '#DC2626', width: 1.5 },
    { label: 'Sanitärobjekte (WC, WT, Dusche)', color: '#0D9488', width: 1.5 }
  ];

  items.forEach((it, idx) => {
    const iy = y + 24 + idx * 13;
    doc.lineWidth(it.width).strokeColor(it.color).moveTo(x + 8, iy + 4).lineTo(x + 28, iy + 4).stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#334155').text(it.label, x + 34, iy);
  });
  doc.restore();
}

function renderSynthesizedRoomLayout(doc, area, rooms, floor) {
  doc.save();
  const roomList = (rooms && rooms.length > 0) ? rooms : [
    { name: `Technikraum & Verteilung (${floor})`, code: `${floor}-101` },
    { name: `Hauptmontageabschnitt (${floor})`, code: `${floor}-102` }
  ];

  const cols = Math.min(3, roomList.length);
  const rows = Math.ceil(roomList.length / cols);
  const cardW = (area.width - (cols + 1) * 20) / cols;
  const cardH = (area.height - (rows + 1) * 20) / rows;

  roomList.forEach((rm, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const rx = area.x + 20 + col * (cardW + 20);
    const ry = area.y + 20 + row * (cardH + 20);

    // Architectural room box
    doc.rect(rx, ry, cardW, cardH).lineWidth(1.5).strokeColor('#1E293B').fillAndStroke('#F8FAFC', '#1E293B');
    // Inner offset
    doc.rect(rx + 4, ry + 4, cardW - 8, cardH - 8).lineWidth(0.5).strokeColor('#E2E8F0').stroke();

    // Room Label
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1E3A8A').text(rm.name || 'Raum', rx + 14, ry + 16, { width: cardW - 28 });
    doc.fontSize(8.5).font('Helvetica').fillColor('#64748B').text(`Raum-Code: ${rm.code || `${floor}-${idx + 101}`}`, rx + 14, ry + 32);

    // Symbolic installation lines
    doc.lineWidth(1.5).strokeColor('#2563EB').moveTo(rx + 14, ry + cardH - 24).lineTo(rx + cardW - 14, ry + cardH - 24).stroke();
    doc.lineWidth(1.5).strokeColor('#DC2626').moveTo(rx + 14, ry + cardH - 16).lineTo(rx + cardW - 14, ry + cardH - 16).stroke();
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0D9488').text('TGA INSTALLATION ZONE', rx + 14, ry + cardH - 36);
  });
  doc.restore();
}
