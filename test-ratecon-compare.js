/**
 * Rate Con Test — GPT-4o Text vs GPT-4o Vision
 *
 * Tests both approaches on all 12 rate con PDFs and compares:
 * - Approach A: Current pipeline (pdf-parse text → GPT-4o text model)
 * - Approach B: GPT-4o Vision (images → GPT-4o Vision API)
 *
 * Extracts key fields and compares accuracy, speed, cost.
 */
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");

require("dotenv").config({
  path: path.join(__dirname, "..", "be-nodejs", ".env"),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PDF_DIR = path.join(__dirname, "ratecon-pdfs");
const IMG_DIR = path.join(__dirname, "ratecon-images");

// Load the v2 prompt from the actual config
const loadConfig = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "be-nodejs", "config", "load.json"),
    "utf8",
  ),
);
const V2_PROMPT = loadConfig.convertLoadTenderDataFromTxtToJson.v2;

// Key fields we'll compare between approaches
const KEY_FIELDS = [
  "loadNumber",
  "broker.name",
  "carrier.name",
  "shippers[0].name",
  "shippers[0].address",
  "shippers[0].date",
  "receivers[0].name",
  "receivers[0].address",
  "receivers[0].date",
  "charges.total",
  "charges.linehaul",
  "equipment.trailerType",
  "references.referenceId",
  "collaboratorEmails",
];

// Map PDF filenames to their image files
function getImageFiles(pdfName) {
  const base = path
    .basename(pdfName, ".pdf")
    .replace(/ /g, "_")
    .replace(/\$/g, "_");
  const allImages = fs
    .readdirSync(IMG_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();
  return allImages.filter((f) => f.startsWith(base));
}

// Get nested field value from object
function getField(obj, fieldPath) {
  try {
    const parts = fieldPath.replace(/\[(\d+)\]/g, ".$1").split(".");
    let val = obj;
    for (const p of parts) val = val[p];
    return val;
  } catch {
    return undefined;
  }
}

// ============================================================
// APPROACH A: Current Pipeline (pdf-parse → GPT-4o Text)
// ============================================================
async function testTextPipeline(pdfPath, fileName) {
  const result = { approach: "Text Pipeline", file: fileName };

  try {
    // Step 1: Extract text with pdf-parse
    const buf = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(buf);
    const rawText = pdfData.text.trim();
    result.textLength = rawText.length;
    result.hasText = rawText.length > 50;

    if (!result.hasText) {
      result.status = "FAILED — No text extracted (scanned PDF)";
      result.fields = {};
      result.tokens = 0;
      result.time = 0;
      result.cost = 0;
      return result;
    }

    // Step 2: Send to GPT-4o text model (same as current production flow)
    const promptText = V2_PROMPT;
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: promptText + rawText }],
      temperature: 0,
      max_tokens: 4096,
      top_p: 0,
      response_format: { type: "json_object" },
    });

    result.time = Date.now() - startTime;
    result.tokens = {
      input: completion.usage?.prompt_tokens || 0,
      output: completion.usage?.completion_tokens || 0,
      total: completion.usage?.total_tokens || 0,
    };

    // Cost: GPT-4o pricing ($2.50/1M input, $10/1M output)
    result.cost =
      (result.tokens.input * 2.5) / 1000000 +
      (result.tokens.output * 10) / 1000000;

    const responseText = completion.choices[0].message.content;
    result.fields = JSON.parse(responseText);
    result.status = "SUCCESS";
    result.rawResponse = responseText;
  } catch (err) {
    result.status = `ERROR: ${err.message}`;
    result.fields = {};
  }

  return result;
}

// ============================================================
// APPROACH B: GPT-4o Vision (images → GPT-4o Vision API)
// ============================================================
async function testVisionPipeline(pdfPath, fileName) {
  const result = { approach: "Vision Pipeline", file: fileName };

  try {
    const imageFiles = getImageFiles(fileName);
    if (imageFiles.length === 0) {
      result.status = "FAILED — No images found";
      result.fields = {};
      return result;
    }

    result.pages = imageFiles.length;

    // Build vision prompt — use the same schema as v2 but adapted for vision
    const visionSystemPrompt = `You are a senior logistics analyst. You will be shown image(s) of a rate confirmation / load tender document. Extract ALL data and return STRICT JSON ONLY (no commentary, no markdown fences).

CRITICAL — Same extraction rules as text-based parsing:
- This document may contain MULTIPLE pickup stops and/or delivery stops
- Each pickup/delivery stop must be treated independently
- All dates: YYYY-MM-DD format
- All times: 24-hour HH:MM format
- Amounts: numeric only (no $)
- Phone numbers: digits only
- Addresses: "Number Street, City, State, Zip, Country" (use USA when applicable)
- Broker letterhead address ≠ shipper/receiver address
- If info is missing, use empty string "", null, or []
- Extract ALL emails found anywhere → collaboratorEmails array (lowercase, deduplicated)
- For charges: always include linehaul as first item in charges.items

Return the EXACT schema:
{
  "loadNumber": "",
  "payerInfo": "",
  "customer": {"companyName":"","accountsPayableEmail":"","billingAddress":""},
  "broker": {"name":"","address":"","emailForInvoices":"","phone":""},
  "carrier": {"name":"","mcNumber":"","usdot":"","phone":""},
  "references": {"referenceId":"","internalReference":"","poNumber":"","bolNumber":"","quoteDueBy":null,"shipperRef":"","customerPo":"","orderNumber":"","releaseNumber":"","rateConNumber":"","pickupNumber":"","deliveryNumber":"","orderType":"","serviceType":""},
  "equipment": {"trailerType":"","temperatureRequired":null,"temperatureMode":null,"lengthFt":null},
  "distanceMiles": null,
  "shippers": [{"name":"","address":"","date":"","time":"","endDate":"","endTime":"","appointmentType":null,"notes":"","contact":"","phone":"","contactEmail":"","pickupNumber":"","poNumber":"","releaseNumber":"","commodities":[{"label":"","description":"","sku":"","qty":null,"qtyUnit":"","alternateQty":null,"alternateQtyUnit":"","weight":null,"weightUnit":null,"length":null,"width":null,"height":null,"cube":null,"notes":""}]}],
  "receivers": [{"name":"","address":"","date":"","time":"","endDate":"","endTime":"","appointmentType":null,"notes":"","contact":"","phone":"","contactEmail":""}],
  "commodities": [{"label":"","description":"","sku":"","qty":null,"qtyUnit":"","alternateQty":null,"alternateQtyUnit":"","weight":null,"weightUnit":null,"length":null,"width":null,"height":null,"cube":null,"notes":""}],
  "dispatcher": {"name":"","phone":"","email":"","notes":""},
  "driver": {"name":"","phone":"","email":"","truckNumber":"","trailerNumber":""},
  "charges": {"linehaul":null,"fuel":null,"accessorials":null,"total":null,"currency":"USD","items":[{"name":"","amount":null}]},
  "instructions": {"pickup":"","general":[],"trackingRequired":null,"trackingPlatform":null,"documentsEmail":""},
  "collaboratorEmails": []
}`;

    // Build image content array
    const imageContents = imageFiles.map((imgFile) => {
      const imgPath = path.join(IMG_DIR, imgFile);
      const imgBase64 = fs.readFileSync(imgPath).toString("base64");
      return {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${imgBase64}`,
          detail: "high",
        },
      };
    });

    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: visionSystemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all rate confirmation data from this document:",
            },
            ...imageContents,
          ],
        },
      ],
      temperature: 0,
      max_tokens: 4096,
      top_p: 0,
      response_format: { type: "json_object" },
    });

    result.time = Date.now() - startTime;
    result.tokens = {
      input: completion.usage?.prompt_tokens || 0,
      output: completion.usage?.completion_tokens || 0,
      total: completion.usage?.total_tokens || 0,
    };

    // Cost: GPT-4o pricing ($2.50/1M input, $10/1M output)
    result.cost =
      (result.tokens.input * 2.5) / 1000000 +
      (result.tokens.output * 10) / 1000000;

    const responseText = completion.choices[0].message.content;
    result.fields = JSON.parse(responseText);
    result.status = "SUCCESS";
    result.rawResponse = responseText;
  } catch (err) {
    result.status = `ERROR: ${err.message}`;
    result.fields = {};
  }

  return result;
}

// ============================================================
// COMPARE RESULTS
// ============================================================
function compareResults(textResult, visionResult) {
  const comparison = {};

  for (const field of KEY_FIELDS) {
    const textVal = getField(textResult.fields, field);
    const visionVal = getField(visionResult.fields, field);

    const textStr = JSON.stringify(textVal) || "N/A";
    const visionStr = JSON.stringify(visionVal) || "N/A";
    const match = textStr === visionStr;

    comparison[field] = { text: textStr, vision: visionStr, match };
  }

  return comparison;
}

// ============================================================
// MAIN
// ============================================================
async function run() {
  const files = fs
    .readdirSync(PDF_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .sort();

  console.log("=".repeat(100));
  console.log(
    "RATE CON COMPARISON: Current Pipeline (pdf-parse + GPT-4o Text) vs GPT-4o Vision",
  );
  console.log("=".repeat(100));
  console.log(`Testing ${files.length} rate con PDFs\n`);

  const allResults = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pdfPath = path.join(PDF_DIR, file);
    const shortName = file.length > 50 ? file.substring(0, 47) + "..." : file;

    console.log(`\n${"#".repeat(100)}`);
    console.log(`[${i + 1}/${files.length}] ${shortName}`);
    console.log(`${"#".repeat(100)}`);

    // Test both approaches
    console.log(
      "\n  ⏳ Testing Approach A: Text Pipeline (pdf-parse → GPT-4o)...",
    );
    const textResult = await testTextPipeline(pdfPath, file);
    console.log(
      `  ${textResult.status === "SUCCESS" ? "✅" : "❌"} Text: ${textResult.status} | ${textResult.time}ms | ${textResult.tokens?.total || 0} tokens | $${(textResult.cost || 0).toFixed(4)}`,
    );

    console.log(
      "\n  ⏳ Testing Approach B: Vision Pipeline (images → GPT-4o Vision)...",
    );
    const visionResult = await testVisionPipeline(pdfPath, file);
    console.log(
      `  ${visionResult.status === "SUCCESS" ? "✅" : "❌"} Vision: ${visionResult.status} | ${visionResult.time}ms | ${visionResult.tokens?.total || 0} tokens | $${(visionResult.cost || 0).toFixed(4)}`,
    );

    // Compare key fields
    if (textResult.status === "SUCCESS" && visionResult.status === "SUCCESS") {
      const comp = compareResults(textResult, visionResult);
      console.log("\n  --- KEY FIELDS COMPARISON ---");
      console.log(
        `  ${"Field".padEnd(30)} ${"Text Pipeline".padEnd(40)} ${"Vision Pipeline".padEnd(40)} Match`,
      );
      console.log(
        `  ${"-".repeat(30)} ${"-".repeat(40)} ${"-".repeat(40)} -----`,
      );

      for (const [field, vals] of Object.entries(comp)) {
        const textShort =
          vals.text.length > 38
            ? vals.text.substring(0, 35) + "..."
            : vals.text;
        const visionShort =
          vals.vision.length > 38
            ? vals.vision.substring(0, 35) + "..."
            : vals.vision;
        const matchIcon = vals.match ? "✅" : "⚠️";
        console.log(
          `  ${field.padEnd(30)} ${textShort.padEnd(40)} ${visionShort.padEnd(40)} ${matchIcon}`,
        );
      }
    } else if (
      textResult.status !== "SUCCESS" &&
      visionResult.status === "SUCCESS"
    ) {
      console.log("\n  --- VISION-ONLY OUTPUT (text pipeline failed) ---");
      for (const field of KEY_FIELDS) {
        const val = getField(visionResult.fields, field);
        if (val && val !== "" && val !== null) {
          console.log(
            `  ${field.padEnd(30)} ${JSON.stringify(val).substring(0, 60)}`,
          );
        }
      }
    }

    allResults.push({
      file: shortName,
      text: textResult,
      vision: visionResult,
    });
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log("\n\n" + "=".repeat(100));
  console.log("FINAL SUMMARY");
  console.log("=".repeat(100));

  console.log(
    `\n${"PDF File".padEnd(52)} ${"Text".padEnd(12)} ${"Vision".padEnd(12)} ${"Text Time".padEnd(12)} ${"Vision Time".padEnd(12)} ${"Text Cost".padEnd(12)} ${"Vision Cost"}`,
  );
  console.log(
    `${"-".repeat(52)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(12)}`,
  );

  let textSuccesses = 0,
    visionSuccesses = 0;
  let textTotalTime = 0,
    visionTotalTime = 0;
  let textTotalCost = 0,
    visionTotalCost = 0;

  for (const r of allResults) {
    const tStatus = r.text.status === "SUCCESS" ? "✅ OK" : "❌ FAIL";
    const vStatus = r.vision.status === "SUCCESS" ? "✅ OK" : "❌ FAIL";
    const tTime = r.text.time ? `${(r.text.time / 1000).toFixed(1)}s` : "-";
    const vTime = r.vision.time ? `${(r.vision.time / 1000).toFixed(1)}s` : "-";
    const tCost = r.text.cost ? `$${r.text.cost.toFixed(4)}` : "-";
    const vCost = r.vision.cost ? `$${r.vision.cost.toFixed(4)}` : "-";

    if (r.text.status === "SUCCESS") {
      textSuccesses++;
      textTotalTime += r.text.time;
      textTotalCost += r.text.cost;
    }
    if (r.vision.status === "SUCCESS") {
      visionSuccesses++;
      visionTotalTime += r.vision.time;
      visionTotalCost += r.vision.cost;
    }

    console.log(
      `${r.file.padEnd(52)} ${tStatus.padEnd(12)} ${vStatus.padEnd(12)} ${tTime.padEnd(12)} ${vTime.padEnd(12)} ${tCost.padEnd(12)} ${vCost}`,
    );
  }

  console.log(`\n--- TOTALS ---`);
  console.log(
    `Success rate:  Text: ${textSuccesses}/${allResults.length} | Vision: ${visionSuccesses}/${allResults.length}`,
  );
  console.log(
    `Avg time:      Text: ${textSuccesses ? (textTotalTime / textSuccesses / 1000).toFixed(1) : 0}s | Vision: ${visionSuccesses ? (visionTotalTime / visionSuccesses / 1000).toFixed(1) : 0}s`,
  );
  console.log(
    `Total cost:    Text: $${textTotalCost.toFixed(4)} | Vision: $${visionTotalCost.toFixed(4)}`,
  );
  console.log(
    `Avg cost:      Text: $${textSuccesses ? (textTotalCost / textSuccesses).toFixed(4) : 0} | Vision: $${visionSuccesses ? (visionTotalCost / visionSuccesses).toFixed(4) : 0}`,
  );

  console.log("\nDONE.");

  // Save full results to JSON for later analysis
  fs.writeFileSync(
    path.join(__dirname, "ratecon-results.json"),
    JSON.stringify(
      allResults.map((r) => ({
        file: r.file,
        text: {
          status: r.text.status,
          time: r.text.time,
          tokens: r.text.tokens,
          cost: r.text.cost,
          fields: r.text.fields,
        },
        vision: {
          status: r.vision.status,
          time: r.vision.time,
          tokens: r.vision.tokens,
          cost: r.vision.cost,
          fields: r.vision.fields,
        },
      })),
      null,
      2,
    ),
  );
  console.log("\nFull results saved to ratecon-results.json");
}

run().catch(console.error);
