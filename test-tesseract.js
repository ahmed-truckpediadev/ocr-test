/**
 * Approach 2: Tesseract.js OCR
 * Converts PDF pages to images, then runs OCR on each image.
 * Works on both scanned and digital PDFs (since we convert to images first).
 */
const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");

const IMAGES_DIR = path.join(__dirname, "images");

// Group images by source PDF
const PDF_GROUPS = {
  "Work_Order_2___Samsara.pdf (Digital)": ["samsara-1.png"],
  "20260331081932790.pdf (Scanned - 4 pages)": [
    "invoice1-1.png",
    "invoice1-2.png",
    "invoice1-3.png",
    "invoice1-4.png",
  ],
  "20260331075307659.pdf (Scanned - 4 pages)": [
    "invoice2-1.png",
    "invoice2-2.png",
    "invoice2-3.png",
    "invoice2-4.png",
  ],
};

async function testTesseract() {
  console.log("=".repeat(80));
  console.log("APPROACH 2: Tesseract.js OCR (image-based)");
  console.log("=".repeat(80));
  console.log("PDF → 300 DPI PNG → Tesseract OCR → Text");
  console.log("Works on scanned/image-based PDFs too.\n");

  // Create a single worker for reuse
  const worker = await Tesseract.createWorker("eng");

  for (const [pdfName, pages] of Object.entries(PDF_GROUPS)) {
    console.log("-".repeat(80));
    console.log(`FILE: ${pdfName}`);
    console.log("-".repeat(80));

    let fullText = "";
    let totalTime = 0;

    for (const page of pages) {
      const imagePath = path.join(IMAGES_DIR, page);
      const startTime = Date.now();

      try {
        const { data } = await worker.recognize(imagePath);
        const elapsed = Date.now() - startTime;
        totalTime += elapsed;

        console.log(
          `  Page ${page}: ${data.text.length} chars, confidence: ${data.confidence.toFixed(1)}%, time: ${elapsed}ms`,
        );
        fullText += `\n--- PAGE: ${page} ---\n` + data.text;
      } catch (err) {
        console.log(`  Page ${page}: ❌ ERROR: ${err.message}`);
      }
    }

    console.log(`\nTotal processing time: ${totalTime}ms`);
    console.log(`Total text length: ${fullText.length} chars`);
    console.log(`\n--- EXTRACTED TEXT (first 2500 chars) ---\n`);
    console.log(fullText.substring(0, 2500));
    if (fullText.length > 2500) {
      console.log(
        `\n... [${fullText.length - 2500} more characters truncated]`,
      );
    }

    // Quality assessment
    const hasText = fullText.trim().length > 50;
    const hasVin = /\b[A-HJ-NPR-Z0-9]{17}\b/i.test(fullText);
    const hasDollar = /\$[\d,]+\.?\d*/g.test(fullText);
    const hasDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/g.test(fullText);

    console.log(`\n--- QUALITY ASSESSMENT ---`);
    console.log(`Has meaningful text: ${hasText ? "✅ YES" : "❌ NO"}`);
    console.log(`Contains VIN pattern: ${hasVin ? "✅ YES" : "❌ NO"}`);
    console.log(`Contains dollar amounts: ${hasDollar ? "✅ YES" : "❌ NO"}`);
    console.log(`Contains dates: ${hasDate ? "✅ YES" : "❌ NO"}`);
    console.log("");
  }

  await worker.terminate();
}

testTesseract().catch(console.error);
