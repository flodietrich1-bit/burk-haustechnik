import PDFDocument from 'pdfkit';

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

      doc.text(`Verbaute Positionen: ${aufmass.summaryItems.length}`, 300, startY + 10);
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
        doc.text(`${item.plannedTotalQty}`, 315, tableY + 4, { width: 45, align: 'right' });
        doc.text(`${item.totalInstalledUpToDate}`, 365, tableY + 4, { width: 50, align: 'right' });
        doc.font('Helvetica-Bold').text(`${item.periodInstalledQty}`, 420, tableY + 4, { width: 45, align: 'right' });
        doc.font('Helvetica').text(item.qu || 'Stk', 470, tableY + 4, { width: 35, align: 'center' });
        doc.text(`${Number(item.periodVolume || 0).toFixed(2)}`, 505, tableY + 4, { width: 45, align: 'right' });
        tableY += 18;
      });

      // Signature area
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
