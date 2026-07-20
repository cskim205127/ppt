import { PDFParse } from "pdf-parse";

export interface PdfExtractResult {
  title: string;
  text: string;
}

/**
 * Extracts plain text from a PDF buffer. `filename` (if the caller has one,
 * e.g. from a form upload) is used as a fallback title since PDFs often
 * don't have a useful embedded title in their metadata.
 */
export async function extractPdfText(buffer: Buffer, filename?: string): Promise<PdfExtractResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const [info, textResult] = await Promise.all([
      parser.getInfo().catch(() => undefined),
      parser.getText(),
    ]);

    const metadataTitle = (info as any)?.info?.Title as string | undefined;
    const title = metadataTitle?.trim() || filename?.replace(/\.pdf$/i, "") || "업로드된 PDF";

    const text = textResult.text.trim();
    if (!text) {
      throw new Error("PDF에서 텍스트를 추출하지 못했습니다 (스캔본 이미지일 수 있음)");
    }

    return { title, text };
  } finally {
    await parser.destroy();
  }
}
