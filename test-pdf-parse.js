/**
 * Approach 1: Direct PDF Text Extraction using pdf-parse
 * This extracts embedded text from PDFs (works great for digitally-generated PDFs,
 * but fails on scanned/image-based PDFs)
 */
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PDF_DIR = path.join(__dirname, "..");
const PDF_FILES = [
  "Work_Order_2___Samsara.pdf",
  "20260331081932790.pdf",
  "20260331075307659.pdf",
];

// Target fields we want to extract (per the maintenance form)
const TARGET_FIELDS = [
  "VIN",
  "Unit Number",
  "Year",
  "Make",
  "Type of Service / Job Description",
  "Notes / Correction Text",
  "Vendor Name / Address (Service Location)",
  "Invoice Date (Service Completed Time)",
  "Invoice Total (Final Cost)",
];

async function testPdfParse() {
  console.log("=".repeat(80));
  console.log("APPROACH 1: Direct PDF Text Extraction (pdf-parse)");
  console.log("=".repeat(80));
  console.log("This method extracts embedded text from the PDF stream.");
  console.log(
    "Works well for digitally-generated PDFs, fails on scanned images.\n",
  );

  for (const file of PDF_FILES) {
    const filePath = path.join(PDF_DIR, file);
    console.log("-".repeat(80));
    console.log(`FILE: ${file}`);
    console.log("-".repeat(80));

    try {
      const dataBuffer = fs.readFileSync(filePath);
      const startTime = Date.now();
      const data = await pdfParse(dataBuffer);
      const elapsed = Date.now() - startTime;

      console.log(`Pages: ${data.numpages}`);
      console.log(`Processing Time: ${elapsed}ms`);
      console.log(`Text Length: ${data.text.length} characters`);
      console.log(`\n--- EXTRACTED TEXT (first 3000 chars) ---\n`);
      console.log(data.text.substring(0, 3000));
      if (data.text.length > 3000) {
        console.log(
          `\n... [${data.text.length - 3000} more characters truncated]`,
        );
      }

      // Quick quality assessment
      const hasText = data.text.trim().length > 50;
      const hasVin = /\b[A-HJ-NPR-Z0-9]{17}\b/i.test(data.text);
      const hasDollar = /\$[\d,]+\.?\d*/g.test(data.text);
      const hasDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/g.test(data.text);

      console.log(`\n--- QUALITY ASSESSMENT ---`);
      console.log(`Has meaningful text: ${hasText ? "✅ YES" : "❌ NO"}`);
      console.log(`Contains VIN pattern: ${hasVin ? "✅ YES" : "❌ NO"}`);
      console.log(`Contains dollar amounts: ${hasDollar ? "✅ YES" : "❌ NO"}`);
      console.log(`Contains dates: ${hasDate ? "✅ YES" : "❌ NO"}`);
      console.log("");
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}\n`);
    }
  }
}

testPdfParse().catch(console.error);
