import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils/format";
import type { ReportsExportMeta, ReportsReceiptPayload } from "@/lib/reports/export-data";

const PRIMARY: [number, number, number] = [26, 39, 68];
const PREMIUM: [number, number, number] = [201, 168, 76];
const MUTED: [number, number, number] = [107, 101, 96];
const FOREGROUND: [number, number, number] = [26, 26, 26];
const BORDER: [number, number, number] = [216, 212, 204];
const SUCCESS: [number, number, number] = [5, 150, 105];
const PAGE_MARGIN = 14;

// jsPDF's standard fonts don't reliably render the narrow/no-break spaces
// that Intl.NumberFormat("pt-BR") inserts around the currency symbol.
function money(value: number) {
  return formatCurrency(value).replace(/[\u00a0\u202f]/g, " ");
}

function getFinalY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? 40;
}

interface LogoImage {
  dataUrl: string;
  width: number;
  height: number;
}

const LOGO_LOAD_TIMEOUT_MS = 6000;

// jsPDF can only embed raster data (via canvas), so this also rasterizes
// SVG logos on the fly — the browser can draw an <img src="*.svg"> onto a
// canvas just like any other image. Resolves null (falling back to the
// initials badge) on any failure so a broken/slow logo never blocks export.
function loadLogoImage(url: string): Promise<LogoImage | null> {
  const load = new Promise<LogoImage | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context || width === 0 || height === 0) {
        resolve(null);
        return;
      }

      try {
        context.drawImage(image, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL("image/png"), width, height });
      } catch {
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
    image.src = url;
  });

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), LOGO_LOAD_TIMEOUT_MS)
  );

  return Promise.race([load, timeout]);
}

function drawHeader(doc: jsPDF, meta: ReportsExportMeta, logo: LogoImage | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const { workshop } = meta;

  const LOGO_SIZE = 14;
  const LOGO_X = PAGE_MARGIN;
  const LOGO_Y = 12;
  const DIVIDER_X = LOGO_X + LOGO_SIZE + 4;
  const TEXT_X = DIVIDER_X + 5;

  if (logo) {
    const aspect = logo.width / logo.height;
    const drawWidth = aspect > 1 ? LOGO_SIZE : LOGO_SIZE * aspect;
    const drawHeight = aspect > 1 ? LOGO_SIZE / aspect : LOGO_SIZE;
    const offsetX = LOGO_X + (LOGO_SIZE - drawWidth) / 2;
    const offsetY = LOGO_Y + (LOGO_SIZE - drawHeight) / 2;
    doc.addImage(logo.dataUrl, "PNG", offsetX, offsetY, drawWidth, drawHeight);
  } else {
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const initials = workshop.name.slice(0, 2).toUpperCase();
    doc.text(initials, LOGO_X + LOGO_SIZE / 2, LOGO_Y + 8.5, { align: "center" });
  }

  // Company text block — name, document type, contact, address — stacked
  // to the right of the logo, tracked with a running cursor so optional
  // lines (e.g. phone) don't leave a visual gap when absent.
  let textY = 16.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...PRIMARY);
  doc.text(workshop.name.toUpperCase(), TEXT_X, textY);

  textY += 3.8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PREMIUM);
  doc.text("Comprovante de Prestação de Serviço", TEXT_X, textY);

  textY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FOREGROUND);
  doc.text(
    workshop.document ? `CNPJ: ${workshop.document}` : "CNPJ não configurado",
    TEXT_X,
    textY
  );

  if (workshop.phone) {
    textY += 3.8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(workshop.phone, TEXT_X, textY);
  }

  textY += 3.8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(workshop.address ?? "Endereço não configurado", TEXT_X, textY);

  // Subtle divider between the logo and the text block, spanning the
  // company text block's actual height.
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(DIVIDER_X, LOGO_Y, DIVIDER_X, Math.max(textY - 2, LOGO_Y + LOGO_SIZE));

  const rightX = pageWidth - PAGE_MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PREMIUM);
  doc.text(meta.receiptNumber, rightX, 17, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Período: ${meta.periodLabel}`, rightX, 22, { align: "right" });
  doc.text(`Referente a: ${meta.clientLabel}`, rightX, 26.5, { align: "right" });

  const dividerY = Math.max(textY, 26.5) + 5;
  doc.setDrawColor(...PREMIUM);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN, dividerY, pageWidth - PAGE_MARGIN, dividerY);

  const missingCompanyInfo = !workshop.document || !workshop.phone || !workshop.address;
  let y = dividerY + 6;
  if (missingCompanyInfo) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "* Complete o CNPJ, telefone e endereço da empresa em Configurações para exibi-los aqui.",
      PAGE_MARGIN,
      y
    );
    y += 5;
  }

  return y;
}

function ensureSpace(doc: jsPDF, y: number, needed = 30) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - PAGE_MARGIN) {
    doc.addPage();
    return 20;
  }
  return y;
}

export async function exportReceiptToPdf(payload: ReportsReceiptPayload) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = payload.meta.workshop.logoUrl
    ? await loadLogoImage(payload.meta.workshop.logoUrl)
    : null;
  let y = drawHeader(doc, payload.meta, logo);

  if (payload.groups.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("Nenhum lançamento selecionado para este comprovante.", PAGE_MARGIN, y + 6);
  }

  payload.groups.forEach((group) => {
    y = ensureSpace(doc, y, 40);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.text(group.clientName, PAGE_MARGIN, y);
    y += 5;

    const contactParts = [
      group.clientDocument ? `Documento: ${group.clientDocument}` : null,
      group.clientPhone ?? null,
      group.clientAddress ?? null,
    ].filter(Boolean);

    if (contactParts.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      const contactLines = doc.splitTextToSize(
        contactParts.join(" · "),
        doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2
      );
      doc.text(contactLines, PAGE_MARGIN, y);
      y += contactLines.length * 4 + 2;
    }

    y += 2;
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [["Data", "Serviço", "Valor"]],
      body: group.rows.map((row) => [row.date, row.description, money(row.amount)]),
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      styles: { fontSize: 8.5 },
      columnStyles: { 2: { halign: "right" } },
    });
    y = getFinalY(doc) + 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...SUCCESS);
    doc.text(`Subtotal: ${money(group.subtotal)}`, doc.internal.pageSize.getWidth() - PAGE_MARGIN, y, {
      align: "right",
    });
    y += 10;
  });

  y = ensureSpace(doc, y, 20);
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN * 2, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL GERAL", PAGE_MARGIN + 5, y + 9);
  doc.text(money(payload.grandTotal), pageWidth - PAGE_MARGIN - 5, y + 9, { align: "right" });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Comprovante emitido em ${payload.meta.generatedAtLabel} · ${payload.meta.workshop.name}`,
      PAGE_MARGIN,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 8, {
      align: "right",
    });
  }

  const fileSlug = payload.meta.clientLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
  doc.save(`comprovante-${fileSlug}.pdf`);
}
