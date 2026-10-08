import PDFDocument from 'pdfkit';

function getRoomPercent(r) {
  if (r.progressPercent !== undefined && r.progressPercent !== null) {
    return Math.round(r.progressPercent);
  }
  if (r.isCompleted) return 100;
  const planned = r.plannedPositions || (r.positions ? r.positions.filter(p => !p.isExtraPosition) : []);
  let totPlan = 0;
  let totInst = 0;
  planned.forEach(p => {
    const pl = Number(p.plannedQty || 0);
    const inst = Number(p.totalInstalledToDate || 0);
    if (pl > 0) {
      totPlan += pl;
      totInst += Math.min(pl, inst);
    }
  });
  if (totPlan > 0) {
    return Math.min(99, Math.round((totInst / totPlan) * 100));
  }
  return 0;
}

/**
 * Generate a professional DIN A4 VOB Aufmaß PDF
 */
export async function generateAufmassPdf(aufmass) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margin: 40,
        info: {
          Title: `Aufmaß ${aufmass.aufmassNumber} - ${aufmass.projectName}`,
          Author: 'BURK Haustechnik GmbH',
          Subject: 'VOB-Aufmaß',
          Creator: 'ToolTime Aufmaß-Engine'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // 1. Header with branding
      doc.fontSize(16).fillColor('#1E293B').font('Helvetica-Bold').text('BURK Haustechnik', 40, 40);
      doc.fontSize(9).fillColor('#64748B').font('Helvetica').text('Sanitär • Heizung • Klimatechnik', 40, 58);

      doc.fontSize(14).fillColor('#0F172A').font('Helvetica-Bold').text(`Aufmaß ${aufmass.aufmassNumber}`, 40, 85);
      doc.fontSize(10).fillColor('#475569').font('Helvetica').text(`Bauvorhaben: ${aufmass.projectName}`, 40, 105);

      // Metadata box
      const startY = 125;
      doc.rect(40, startY, 515, 65).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#334155').fontSize(9).font('Helvetica');
      doc.text(`Stichtag: ${new Date(aufmass.dateTo).toLocaleDateString('de-DE')}`, 50, startY + 10);
      doc.text(`Zeitraum: ${new Date(aufmass.dateFrom).toLocaleDateString('de-DE')} bis ${new Date(aufmass.dateTo).toLocaleDateString('de-DE')}`, 50, startY + 25);
      doc.text(`Erstellt von: ${aufmass.createdBy}`, 50, startY + 40);

      const specialCount = (aufmass.roomsData || []).reduce((acc, r) => acc + (r.specialPositions?.length || 0), 0);
      doc.text(`Verbaute Positionen: ${aufmass.summaryItems.length} (${specialCount} Sonderposten)`, 300, startY + 10);
      doc.text(`Bearbeitete Räume: ${aufmass.roomsData.length}`, 300, startY + 25);
      doc.font('Helvetica-Bold').text(`Abrechnungsvolumen: ${Number(aufmass.totalPeriodVolume || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`, 300, startY + 40);

      // Positions Table
      let tableY = startY + 80;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A').text('Kumulierte Gesamtübersicht der Positionen', 40, tableY);
      tableY += 18;

      // Table Header
      doc.rect(40, tableY, 515, 20).fill('#0F172A');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      doc.text('Pos-Nr', 45, tableY + 5);
      doc.text('Bezeichnung', 110, tableY + 5);
      doc.text('Plan', 315, tableY + 5, { width: 45, align: 'right' });
      doc.text('Kumuliert', 365, tableY + 5, { width: 50, align: 'right' });
      doc.text('Delta', 420, tableY + 5, { width: 45, align: 'right' });
      doc.text('Einheit', 470, tableY + 5, { width: 35, align: 'center' });
      doc.text('Betrag (€)', 505, tableY + 5, { width: 45, align: 'right' });
      tableY += 20;

      // Table Rows
      doc.font('Helvetica').fontSize(8);
      (aufmass.summaryItems || []).forEach((item, idx) => {
        if (tableY > 750) {
          doc.addPage();
          tableY = 40;
        }
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(40, tableY, 515, 18).fill(bg);
        doc.fillColor('#1E293B');
        doc.text(item.posNr || '-', 45, tableY + 4);
        doc.text((item.shortText || '-').substring(0, 38), 110, tableY + 4, { width: 200, ellipsis: true });
        doc.text(`${item.plannedTotalQty ?? item.plannedQty ?? 0}`, 315, tableY + 4, { width: 45, align: 'right' });
        doc.text(`${item.totalInstalledUpToDate}`, 365, tableY + 4, { width: 50, align: 'right' });
        doc.font('Helvetica-Bold').text(`${item.periodInstalledQty}`, 420, tableY + 4, { width: 45, align: 'right' });
        doc.font('Helvetica').text(item.qu || 'Stk', 470, tableY + 4, { width: 35, align: 'center' });
        doc.text(`${Number(item.periodVolume ?? item.totalCost ?? 0).toFixed(2)}`, 505, tableY + 4, { width: 45, align: 'right' });
        tableY += 18;
      });

      // Rooms Breakdown Table
      if (aufmass.roomsData && aufmass.roomsData.length > 0) {
        doc.addPage();
        let rY = 40;
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text('Detailliertes Raumaufmaß (Raumübersicht)', 40, rY);
        rY += 20;

        aufmass.roomsData.forEach(r => {
          const pct = getRoomPercent(r);
          if (rY > 670) {
            doc.addPage();
            rY = 40;
          }

          // Room Header Box
          doc.rect(40, rY, 515, 20).fill('#F1F5F9');
          doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold');
          doc.text(`${r.roomCode || 'Raum'} – ${r.roomName || ''} (Etage ${r.floor || '-'})`, 48, rY + 5);

          // Bold percentage text right at the room title
          const pctText = `${pct}% fertiggestellt${r.isCompleted ? ' ✓' : ''}`;
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(pctText, 350, rY + 5, { width: 195, align: 'right' });
          rY += 25;

          const planned = (r.plannedPositions && r.plannedPositions.length > 0)
            ? r.plannedPositions
            : (r.positions ? r.positions.filter(p => !p.isExtraPosition) : []);
          const special = (r.specialPositions && r.specialPositions.length > 0)
            ? r.specialPositions
            : (r.positions ? r.positions.filter(p => p.isExtraPosition) : []);

          // 1. SECTION: Planmäßig verbaut (laut Plan)
          if (rY > 730) {
            doc.addPage();
            rY = 40;
          }
          doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
          doc.text('1. Planmäßig verbaut (laut Plan)', 45, rY);
          rY += 12;

          if (planned.length === 0) {
            doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica-Oblique');
            doc.text('Keine planmäßigen Teile verbaut', 50, rY);
            rY += 12;
          } else {
            // Header for planned items
            doc.fillColor('#64748B').fontSize(7).font('Helvetica-Bold');
            doc.text('Pos-Nr', 45, rY);
            doc.text('Bezeichnung', 110, rY);
            doc.text('Plan', 330, rY, { width: 50, align: 'right' });
            doc.text('Ist', 390, rY, { width: 50, align: 'right' });
            doc.text('Delta', 450, rY, { width: 50, align: 'right' });
            doc.text('Einheit', 505, rY, { width: 35, align: 'center' });
            rY += 11;

            doc.font('Helvetica').fontSize(7.5);
            planned.forEach(p => {
              if (rY > 750) {
                doc.addPage();
                rY = 40;
              }
              doc.fillColor('#334155');
              doc.text(p.posNr || '-', 45, rY);
              doc.text((p.shortText || '-').substring(0, 42), 110, rY, { width: 210, ellipsis: true });
              doc.text(`${p.plannedQty || 0}`, 330, rY, { width: 50, align: 'right' });
              doc.text(`${p.totalInstalledToDate || 0}`, 390, rY, { width: 50, align: 'right' });
              doc.font('Helvetica-Bold').text(`+${p.installedInPeriod || 0}`, 450, rY, { width: 50, align: 'right' });
              doc.font('Helvetica').text(p.qu || 'Stk', 505, rY, { width: 35, align: 'center' });
              rY += 12;
            });
            rY += 4;
          }

          // 2. SECTION: Sonderposten (Zusätzlich verbaut / Mehrverbrauch)
          if (rY > 720) {
            doc.addPage();
            rY = 40;
          }
          const hasSpecial = special.length > 0;
          doc.rect(40, rY, 515, 16).fill(hasSpecial ? '#FEF2F2' : '#F8FAFC');
          doc.fillColor(hasSpecial ? '#991B1B' : '#64748B').fontSize(8).font('Helvetica-Bold');
          doc.text(`2. Sonderposten (Zusätzlich verbaut / Mehrverbrauch) [${special.length}]`, 48, rY + 4);
          rY += 18;

          if (!hasSpecial) {
            doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Oblique');
            doc.text('✓ Keine Sonderposten in diesem Raum – alle Arbeiten planmäßig ausgeführt.', 48, rY);
            rY += 14;
          } else {
            // Header for Sonderposten table
            doc.rect(40, rY, 515, 14).fill('#FEE2E2');
            doc.fillColor('#7F1D1D').fontSize(7).font('Helvetica-Bold');
            doc.text('Pos-Nr', 45, rY + 3);
            doc.text('Bezeichnung', 100, rY + 3);
            doc.text('Art', 235, rY + 3);
            doc.text('Zusätzlich', 315, rY + 3, { width: 45, align: 'right' });
            doc.text('Verursacher', 370, rY + 3);
            doc.text('Begründung', 435, rY + 3);
            rY += 14;

            special.forEach((p, sIdx) => {
              if (rY > 750) {
                doc.addPage();
                rY = 40;
              }
              const rowBg = sIdx % 2 === 0 ? '#FFFFFF' : '#FFF5F5';
              doc.rect(40, rY, 515, 14).fill(rowBg);

              doc.fillColor('#991B1B').fontSize(7.5).font('Helvetica-Bold');
              doc.text(p.posNr || '-', 45, rY + 3);

              doc.fillColor('#1E293B').font('Helvetica');
              doc.text((p.shortText || '-').substring(0, 26), 100, rY + 3, { width: 130, ellipsis: true });

              const artText = p.specialType === 'mehrverbrauch' ? 'Mehrverbrauch' : (p.specialType === 'zusatzmaterial' ? 'Zusatzmaterial' : 'Sonderposten');
              doc.fillColor('#7F1D1D');
              doc.text(artText, 235, rY + 3, { width: 75 });

              const excessQty = p.totalInstalledToDate || p.excessQty || p.installedInPeriod || 0;
              doc.font('Helvetica-Bold').fillColor('#991B1B');
              doc.text(`+${excessQty} ${p.qu || 'Stk'}`, 315, rY + 3, { width: 45, align: 'right' });

              doc.font('Helvetica').fillColor('#475569');
              doc.text((p.causedBy || 'Monteur').substring(0, 14), 370, rY + 3, { width: 60 });

              doc.font('Helvetica-Oblique').fillColor('#64748B');
              doc.text((p.reason || 'Baustellenanpassung').substring(0, 26), 435, rY + 3, { width: 115, ellipsis: true });

              rY += 14;
            });
            rY += 8;
          }
          rY += 4;
        });
        tableY = rY;
      }
      if (tableY > 680) {
        doc.addPage();
        tableY = 60;
      } else {
        tableY += 40;
      }
      doc.strokeColor('#94A3B8').lineWidth(1);
      doc.moveTo(40, tableY).lineTo(240, tableY).stroke();
      doc.moveTo(315, tableY).lineTo(515, tableY).stroke();
      doc.fontSize(8).fillColor('#64748B').text('Datum / Unterschrift Auftragnehmer (BURK)', 40, tableY + 5);
      doc.text('Datum / Unterschrift Bauleitung / Auftraggeber', 315, tableY + 5);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
