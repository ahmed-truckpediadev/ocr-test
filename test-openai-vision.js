/**
 * Approach 3: OpenAI GPT-4o Vision API
 * Sends PDF page images directly to GPT-4o with a structured extraction prompt.
 * This combines OCR + AI understanding in one step.
 *
 * We test TWO sub-approaches:
 * A) Raw OCR text extraction (just ask GPT-4o to read the text)
 * B) Structured field extraction (ask GPT-4o to extract specific maintenance fields)
 */
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const dotenv = require("dotenv");

// Load API key from the main be-nodejs .env
dotenv.config({ path: path.join(__dirname, "..", "be-nodejs", ".env") });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const IMAGES_DIR = path.join(__dirname, "images");

// Test cases: each represents one maintenance invoice (may be multi-page)
const TEST_CASES = [
  {
    name: "Work_Order_2___Samsara.pdf (Digital - Samsara Work Order)",
    pages: ["samsara-1.png"],
  },
  {
    name: "20260331081932790.pdf (Scanned - Take Off Tire Invoice)",
    pages: ["invoice1-1.png"], // Just page 1 of this multi-invoice PDF
  },
  {
    name: "20260331081932790.pdf (Scanned - Thermo King Invoice)",
    pages: ["invoice1-2.png"], // Page 2
  },
  {
    name: "20260331081932790.pdf (Scanned - TA Truck Service Invoice)",
    pages: ["invoice1-3.png"], // Page 3
  },
  {
    name: "20260331081932790.pdf (Scanned - Bauer Built Tire Invoice)",
    pages: ["invoice1-4.png"], // Page 4
  },
  {
    name: "20260331075307659.pdf (Scanned - Truck Center Freightliner)",
    pages: ["invoice2-1.png", "invoice2-2.png"], // First 2 pages (same invoice)
  },
  {
    name: "20260331075307659.pdf (Scanned - MCT Companies Carrier)",
    pages: ["invoice2-3.png", "invoice2-4.png"], // Last 2 pages (same invoice)
  },
];

const MAINTENANCE_EXTRACTION_PROMPT = `You are an AI assistant that extracts structured data from maintenance receipts, invoices, repair tickets, and work orders for a trucking fleet management system.

Analyze the attached image(s) of a maintenance document and extract the following fields. Return ONLY a valid JSON object with these keys. If a field cannot be found, set its value to null.

{
  "vin": "Vehicle Identification Number (17-character alphanumeric, e.g. 1XKZDP9X5HJ172975)",
  "unit_number": "Unit/truck/trailer number or asset name (e.g. 505, 220302, 40)",
  "year": "Vehicle model year (4-digit number)",
  "make": "Vehicle make/manufacturer (e.g. Kenworth, Freightliner, Carrier)",
  "model": "Vehicle model if available (e.g. T880, T680)",
  "type_of_service": "Brief description of the main service/job performed (e.g. 'Engine Oil Change', 'Tire Replacement')",
  "notes": "Detailed description of work done, corrections, closing notes, or technician comments. Combine all relevant description text.",
  "vendor_name": "Name of the service vendor/shop",
  "vendor_address": "Full address of the service vendor/shop",
  "invoice_date": "Invoice or completion date in MM/DD/YYYY format",
  "invoice_total": "Total amount charged (numeric value only, no $ sign, use comma notation for thousands: e.g. 1,245.75)",
  "odometer": "Odometer reading if available (numeric only)"
}

Important rules:
- For VIN, look for a 17-character alphanumeric code (no I, O, Q letters)
- For unit_number, look for asset name, unit #, vehicle #, PO #, or trailer # 
- For invoice_total, use the grand total or final total (including tax), not subtotals
- For invoice_date, prefer the completion date or invoice date over the open/start date
- For type_of_service, provide a concise summary (max 50 chars)
- For notes, combine work description, corrections, and closing notes
- Return ONLY the JSON object, no markdown formatting, no explanation`;

async function testOpenAIVision() {
  console.log("=".repeat(80));
  console.log("APPROACH 3: OpenAI GPT-4o Vision API");
  console.log("=".repeat(80));
  console.log(
    "Sends page images directly to GPT-4o for combined OCR + extraction.\n",
  );

  for (const testCase of TEST_CASES) {
    console.log("-".repeat(80));
    console.log(`FILE: ${testCase.name}`);
    console.log("-".repeat(80));

    try {
      // Build image content array
      const imageContents = testCase.pages.map((page) => {
        const imagePath = path.join(IMAGES_DIR, page);
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString("base64");
        return {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Image}`,
            detail: "high",
          },
        };
      });

      const startTime = Date.now();

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: MAINTENANCE_EXTRACTION_PROMPT },
              ...imageContents,
            ],
          },
        ],
        temperature: 0,
        max_tokens: 2048,
      });

      const elapsed = Date.now() - startTime;
      const result = response.choices[0].message.content;
      const usage = response.usage;

      console.log(`Processing time: ${elapsed}ms`);
      console.log(
        `Tokens: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`,
      );
      console.log(`\n--- EXTRACTED JSON ---\n`);

      // Try to parse and pretty-print
      try {
        const cleanResult = result
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        const parsed = JSON.parse(cleanResult);
        console.log(JSON.stringify(parsed, null, 2));

        // Field coverage assessment
        const fields = Object.keys(parsed);
        const filledFields = fields.filter(
          (k) => parsed[k] !== null && parsed[k] !== "",
        );
        console.log(`\n--- FIELD COVERAGE ---`);
        console.log(
          `Fields extracted: ${filledFields.length}/${fields.length}`,
        );
        filledFields.forEach((k) =>
          console.log(
            `  ✅ ${k}: ${JSON.stringify(parsed[k]).substring(0, 80)}`,
          ),
        );
        fields
          .filter((k) => parsed[k] === null || parsed[k] === "")
          .forEach((k) => console.log(`  ⬜ ${k}: (not found)`));
      } catch (parseErr) {
        console.log("Raw response (JSON parse failed):");
        console.log(result);
      }

      console.log("");
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}\n`);
    }
  }
}

testOpenAIVision().catch(console.error);
