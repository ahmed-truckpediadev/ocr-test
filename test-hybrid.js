/**
 * Approach 4 (Hybrid): Tesseract OCR → GPT-4o Text Parsing
 * First extracts raw text via Tesseract, then sends text to GPT-4o for structuring.
 * This is similar to the existing rate confirmation flow.
 * Cheaper than Vision API but depends on OCR quality.
 */
const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");
const OpenAI = require("openai");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "be-nodejs", ".env") });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const IMAGES_DIR = path.join(__dirname, "images");

const TEST_CASES = [
  {
    name: "Samsara Work Order (Digital)",
    pages: ["samsara-1.png"],
  },
  {
    name: "Take Off Tire (Scanned)",
    pages: ["invoice1-1.png"],
  },
  {
    name: "Thermo King (Scanned)",
    pages: ["invoice1-2.png"],
  },
  {
    name: "Truck Center Freightliner (Scanned, 2 pages)",
    pages: ["invoice2-1.png", "invoice2-2.png"],
  },
];

const EXTRACTION_PROMPT = `Extract the following maintenance/repair invoice fields from this raw text. The text was extracted via OCR so it may contain errors, garbled characters, or misaligned columns. Do your best to interpret the content.

Return ONLY a valid JSON object:
{
  "vin": "17-char VIN or null",
  "unit_number": "Unit/truck/trailer number or null",
  "year": "Vehicle model year or null",
  "make": "Vehicle make/manufacturer or null",
  "model": "Vehicle model or null",
  "type_of_service": "Brief service description (max 50 chars) or null",
  "notes": "Detailed work description/corrections or null",
  "vendor_name": "Service vendor name or null",
  "vendor_address": "Vendor full address or null",
  "invoice_date": "MM/DD/YYYY format or null",
  "invoice_total": "Total amount (no $, comma notation) or null",
  "odometer": "Odometer reading or null"
}

RAW OCR TEXT:
`;

async function testHybrid() {
  console.log("=".repeat(80));
  console.log("APPROACH 4 (HYBRID): Tesseract OCR → GPT-4o Text Parsing");
  console.log("=".repeat(80));
  console.log("Step 1: Tesseract extracts raw text from images");
  console.log("Step 2: GPT-4o parses the raw text into structured fields\n");

  const worker = await Tesseract.createWorker("eng");

  for (const testCase of TEST_CASES) {
    console.log("-".repeat(80));
    console.log(`FILE: ${testCase.name}`);
    console.log("-".repeat(80));

    // Step 1: Tesseract OCR
    let rawText = "";
    let ocrTime = 0;
    let avgConfidence = 0;

    for (const page of testCase.pages) {
      const imagePath = path.join(IMAGES_DIR, page);
      const start = Date.now();
      const { data } = await worker.recognize(imagePath);
      ocrTime += Date.now() - start;
      avgConfidence += data.confidence;
      rawText += data.text + "\n";
    }
    avgConfidence /= testCase.pages.length;

    console.log(
      `OCR time: ${ocrTime}ms, confidence: ${avgConfidence.toFixed(1)}%`,
    );
    console.log(`Raw text length: ${rawText.length} chars`);

    // Step 2: GPT-4o text parsing
    const gptStart = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: EXTRACTION_PROMPT + rawText }],
      temperature: 0,
      max_tokens: 1024,
    });
    const gptTime = Date.now() - gptStart;
    const usage = response.usage;

    console.log(`GPT time: ${gptTime}ms, tokens: ${usage.total_tokens}`);
    console.log(`Total time: ${ocrTime + gptTime}ms`);

    try {
      const result = response.choices[0].message.content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(result);
      console.log(`\n${JSON.stringify(parsed, null, 2)}`);

      const fields = Object.keys(parsed);
      const filled = fields.filter(
        (k) => parsed[k] !== null && parsed[k] !== "",
      );
      console.log(`\nFields extracted: ${filled.length}/${fields.length}`);
    } catch (e) {
      console.log(`Parse error: ${e.message}`);
      console.log(response.choices[0].message.content);
    }
    console.log("");
  }

  await worker.terminate();
}

testHybrid().catch(console.error);
