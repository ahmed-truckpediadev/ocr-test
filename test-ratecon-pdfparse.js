/**
 * Rate Con Test - Approach 1: Direct PDF Text Extraction (pdf-parse)
 * Baseline test to see how much text can be extracted from each rate con PDF.
 */
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PDF_DIR = path.join(__dirname, "ratecon-pdfs");

async function run() {
  const files = fs
    .readdirSync(PDF_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .sort();

  console.log("=".repeat(80));
  console.log("RATE CON TEST — Approach 1: pdf-parse (Direct Text Extraction)");
  console.log("=".repeat(80));
  console.log(`Testing ${files.length} rate con PDFs\n`);

  const results = [];

  for (const file of files) {
    const filePath = path.join(PDF_DIR, file);
    console.log("-".repeat(80));
    console.log(`FILE: ${file}`);
    console.log("-".repeat(80));

    try {
      const buf = fs.readFileSync(filePath);
      const start = Date.now();
      const data = await pdfParse(buf);
      const elapsed = Date.now() - start;

      const text = data.text.trim();
      const charCount = text.length;
      const pages = data.numpages;
      const hasText = charCount > 50;

      console.log(
        `  Pages: ${pages} | Characters: ${charCount} | Time: ${elapsed}ms`,
      );
      console.log(
        `  Has extractable text: ${hasText ? "✅ YES" : "❌ NO (scanned/image PDF)"}`,
      );

      if (hasText) {
        // Check for key rate con fields in extracted text
        const checks = {
          "Load/Reference #":
            /load\s*#|ref\s*#|reference|order|confirmation/i.test(text),
          "Shipper/Pickup": /shipper|pick\s*up|origin|sender|consignor/i.test(
            text,
          ),
          "Receiver/Delivery": /receiver|deliver|destination|consignee/i.test(
            text,
          ),
          "Dollar Amount": /\$[\d,]+\.?\d*/i.test(text),
          Address:
            /\d+.*(?:st|street|ave|avenue|rd|road|blvd|dr|drive|hwy|way|ln|lane)/i.test(
              text,
            ),
          Date: /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/i.test(text),
          Phone: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text),
          Email: /[\w.-]+@[\w.-]+\.\w+/.test(text),
        };

        const found = Object.entries(checks).filter(([, v]) => v).length;
        console.log(
          `  Key fields found: ${found}/${Object.keys(checks).length}`,
        );
        Object.entries(checks).forEach(([k, v]) => {
          console.log(`    ${v ? "✅" : "❌"} ${k}`);
        });

        console.log(`\n  --- FIRST 800 CHARS ---`);
        console.log(text.substring(0, 800));
      }

      results.push({ file, pages, charCount, hasText, elapsed });
    } catch (err) {
      console.log(`  ❌ ERROR: ${err.message}`);
      results.push({
        file,
        pages: 0,
        charCount: 0,
        hasText: false,
        elapsed: 0,
        error: err.message,
      });
    }
    console.log("");
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  const digital = results.filter((r) => r.hasText).length;
  const scanned = results.filter((r) => !r.hasText).length;
  console.log(`Digital PDFs (text extractable): ${digital}/${results.length}`);
  console.log(`Scanned/Image PDFs (no text):    ${scanned}/${results.length}`);
  console.log("\nDONE.");
}

run().catch(console.error);
