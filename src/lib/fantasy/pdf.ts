import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import type { Match, Player, Team } from "./types";
import { CATEGORY_LABEL, POSITION_LABEL } from "./types";

export async function generateActaPDF(match: Match, team: Team, players: Player[]): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;

  // Header stripe
  doc.setFillColor(43, 138, 62);
  doc.rect(0, 0, pageW / 3, 10, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(pageW / 3, 0, pageW / 3, 10, "F");
  doc.setFillColor(216, 47, 47);
  doc.rect((pageW * 2) / 3, 0, pageW / 3, 10, "F");

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("BZG Fantasy Eskubaloia", margin, 22);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Acta de partido - Berdezurigorri / BZG Etxebarri", margin, 28);

  // Match info block
  const info: [string, string][] = [
    ["Equipo BZG", team.name],
    ["Categoría", CATEGORY_LABEL[team.category]],
    ["Rival", match.opponent],
    ["Fecha", new Date(match.date).toLocaleDateString("es-ES")],
    ["Jornada", `#${match.round}`],
    ["Local / Visitante", match.locationType === "local" ? "Local" : "Visitante"],
    ["Código partido", match.matchCode],
  ];

  autoTable(doc, {
    startY: 34,
    body: info,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
    margin: { left: margin, right: 70 },
  });

  // QR
  const qrDataUrl = await QRCode.toDataURL(match.matchCode, { width: 180, margin: 0 });
  doc.addImage(qrDataUrl, "PNG", pageW - margin - 30, 34, 30, 30);
  doc.setFontSize(8);
  doc.text(match.matchCode, pageW - margin - 30 + 15, 68, { align: "center" });

  // Stats table
  const head = [
    [
      "#",
      "Jugador/a",
      "G",
      "A",
      "Rec",
      "Blq",
      "Prd",
      "7m+",
      "7m-",
      "2m",
      "Par",
      "P7m",
      "MVP",
      "Observaciones",
    ],
  ];
  const body = players
    .filter((p) => p.active)
    .sort((a, b) => a.dorsal - b.dorsal)
    .map((p) => [
      String(p.dorsal),
      `${p.publicName} (${POSITION_LABEL[p.position]})`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

  autoTable(doc, {
    startY: 78,
    head,
    body,
    styles: { fontSize: 9, cellPadding: 1.5, minCellHeight: 8 },
    headStyles: { fillColor: [43, 138, 62], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 42 },
      13: { cellWidth: 30 },
    },
    theme: "grid",
    margin: { left: margin, right: margin },
  });

  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Observaciones generales:", margin, finalY);
  doc.setLineWidth(0.2);
  doc.line(margin, finalY + 12, pageW - margin, finalY + 12);
  doc.line(margin, finalY + 20, pageW - margin, finalY + 20);
  doc.line(margin, finalY + 28, pageW - margin, finalY + 28);

  doc.setFont("helvetica", "normal");
  doc.text("Firma delegado/a:", margin, finalY + 44);
  doc.line(margin + 35, finalY + 44, margin + 100, finalY + 44);
  doc.text("Firma entrenador/a:", pageW / 2 + 10, finalY + 44);
  doc.line(pageW / 2 + 50, finalY + 44, pageW - margin, finalY + 44);

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    "Documento generado por BZG Fantasy Eskubaloia. Uso interno del club.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: "center" },
  );

  return doc.output("blob");
}
