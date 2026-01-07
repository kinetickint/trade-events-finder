import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { EventDetail } from "../types";

// Helper to strip markdown for clean report generation
const cleanText = (text: string) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/##/g, '') // Remove headers
    .replace(/###/g, '')
    .trim();
};

const getFileName = (product: string, ext: string) => {
  const safeName = product.replace(/[^a-z0-9]/gi, '_').substring(0, 20);
  return `Kinetick_Trade_Report_${safeName}_${new Date().getTime()}.${ext}`;
};

export const generateWordDocument = async (
  productQuery: string,
  eventsText: string,
  eventsData: EventDetail[],
  analysisText: string
) => {
  const epcMatch = eventsText.match(/Relevant EPC: (.*?)(?:\n|$)/i);
  const inferredEPC = epcMatch ? epcMatch[1].trim() : "See Analysis";
  
  // Create paragraphs from text
  const createParagraphs = (text: string) => {
    return text.split('\n').map(line => {
      const cleanLine = cleanText(line);
      if (!cleanLine) return new Paragraph({}); // Empty line
      
      // Check if it was a header
      if (line.trim().startsWith('##')) {
        return new Paragraph({
          text: cleanLine,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        });
      }
      
      return new Paragraph({
        children: [new TextRun({ text: cleanLine, size: 24 })], // 12pt font
        spacing: { after: 100 }
      });
    });
  };

  // Create Event Table
  let eventTable = new Paragraph({ text: "No structured event data found." });
  
  if (eventsData && eventsData.length > 0) {
    const headerRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Event Name", bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date", bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Location", bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Type", bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
      ],
    });

    const rows = eventsData.map(evt => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(evt.eventName)] }),
        new TableCell({ children: [new Paragraph(evt.date)] }),
        new TableCell({ children: [new Paragraph(evt.location)] }),
        new TableCell({ children: [new Paragraph(evt.type)] }),
      ]
    }));

    eventTable = new Table({
      rows: [headerRow, ...rows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    });
  }

  // Build document children
  const docChildren: any[] = [];

  // 1. Header: Company Name (Red)
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({ 
          text: "Kinetick International", 
          bold: true, 
          color: "990000", // Dark Red
          size: 28 // 14pt
        }),
      ],
      alignment: AlignmentType.RIGHT,
    })
  );

  // 2. Header: LinkedIn
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: "www.linkedin.com/in/kalpeshkadav", size: 16, color: "555555" }),
      ],
      alignment: AlignmentType.RIGHT,
    })
  );

  // 3. Header: Website & Phone
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: "www.kinetickint.com", size: 16, color: "555555" }),
        new TextRun({ text: " | ", size: 16, color: "555555" }),
        new TextRun({ text: "+91 9322847479", size: 16, color: "555555" }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 300 }
    })
  );

  // 4. Report Title
  docChildren.push(
    new Paragraph({
      text: "Kinetick Trade Scout Report",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Generated On: ", bold: true }),
        new TextRun({ text: new Date().toLocaleDateString() }),
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Product/Service: ", bold: true }),
        new TextRun({ text: productQuery }),
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Identified EPC: ", bold: true }),
        new TextRun({ text: inferredEPC }),
      ],
      spacing: { after: 400 }
    }),
    new Paragraph({
      text: "Upcoming Event Calendar",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }),
    eventTable,
    new Paragraph({
      text: "Strategic Analysis & Calendar Plan",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }),
    ...createParagraphs(analysisText),
    new Paragraph({
      text: "Event Details (Descriptive)",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }),
    ...createParagraphs(eventsText)
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: docChildren
    }]
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getFileName(productQuery, 'docx');
  a.click();
  window.URL.revokeObjectURL(url);
};

export const generatePDFDocument = async (
  productQuery: string,
  eventsText: string,
  eventsData: EventDetail[],
  analysisText: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxLineWidth = pageWidth - (margin * 2);
  let y = 20;

  // Header: Company Name in Red
  doc.setFont("helvetica", "bold");
  doc.setTextColor(150, 0, 0); // Kinetick Red
  doc.setFontSize(14);
  doc.text("Kinetick International", pageWidth - margin, 15, { align: "right" });

  // Header: Contact Info in Gray
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("www.linkedin.com/in/kalpeshkadav", pageWidth - margin, 20, { align: "right" });
  doc.text("www.kinetickint.com | +91 9322847479", pageWidth - margin, 25, { align: "right" });

  y = 40; // Start content below header

  const addText = (text: string, fontSize = 11, isBold = false) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    
    const lines = doc.splitTextToSize(cleanText(text), maxLineWidth);
    
    // Page check
    if (y + (lines.length * fontSize * 0.5) > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = 20;
    }

    doc.setTextColor(0, 0, 0); // Ensure black text for body
    doc.text(lines, margin, y);
    y += (lines.length * 6) + 4; // Line height spacing
  };

  // Report Title
  doc.setTextColor(150, 0, 0); // Kinetick Red-ish
  addText("Kinetick Trade Scout Report", 22, true);
  doc.setTextColor(0, 0, 0); // Reset black
  y += 10;
  
  addText(`Generated On: ${new Date().toLocaleDateString()}`, 11);
  addText(`Product/Service: ${productQuery}`, 11);
  
  const epcMatch = eventsText.match(/Relevant EPC: (.*?)(?:\n|$)/i);
  const inferredEPC = epcMatch ? epcMatch[1].trim() : "See Analysis";
  addText(`Identified EPC: ${inferredEPC}`, 11);
  
  y += 10;

  // Calendar Table
  if (eventsData && eventsData.length > 0) {
    addText("Upcoming Event Calendar", 16, true);
    y += 5;

    const tableColumn = ["Event Name", "Date", "Location", "Type"];
    const tableRows = eventsData.map(evt => [evt.eventName, evt.date, evt.location, evt.type]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [150, 0, 0] }, // Red header to match brand
    });

    // Update Y after table
    y = (doc as any).lastAutoTable.finalY + 15; 
  }

  // Analysis Section
  addText("Strategic Analysis & Calendar Plan", 16, true);
  y += 5;
  
  // Split paragraphs
  analysisText.split('\n').forEach(line => {
    if (line.trim().length > 0) addText(line, 11, line.startsWith('##'));
  });
  
  y += 10;

  // Events Section
  addText("Event Details (Descriptive)", 16, true);
  y += 5;
  
  eventsText.split('\n').forEach(line => {
    if (line.trim().length > 0) addText(line, 11, line.startsWith('##'));
  });

  doc.save(getFileName(productQuery, 'pdf'));
};
