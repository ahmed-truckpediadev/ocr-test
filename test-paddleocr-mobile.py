"""PaddleOCR test using PP-OCRv5 mobile (lighter model for faster CPU inference)"""
import os
import sys
import time
import re

os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

from paddleocr import PaddleOCR

IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")

PDF_GROUPS = {
    "Work_Order_2___Samsara.pdf (Digital)": ["samsara-1.png"],
    "Take Off Tire (Scanned)": ["invoice1-1.png"],
    "Thermo King (Scanned)": ["invoice1-2.png"],
    "TA Truck Service (Scanned)": ["invoice1-3.png"],
    "Bauer Built Tire (Scanned)": ["invoice1-4.png"],
    "Truck Center Freightliner (Scanned, 2pg)": ["invoice2-1.png", "invoice2-2.png"],
    "MCT Carrier (Scanned, 2pg)": ["invoice2-3.png", "invoice2-4.png"],
}

print("=" * 80)
print("APPROACH 5: PaddleOCR (PP-OCRv5 Mobile)")
print("=" * 80)
print("Open-source OCR from Baidu — 75k+ GitHub stars.")
print("Using mobile (lighter) model for CPU inference.\n")

print("Initializing PaddleOCR (mobile model)...")
init_start = time.time()
ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    text_detection_model_name="PP-OCRv5_mobile_det",
    text_recognition_model_name="PP-OCRv5_mobile_rec",
)
init_time = time.time() - init_start
print(f"Initialization time: {init_time:.1f}s\n")

for pdf_name, pages in PDF_GROUPS.items():
    print("-" * 80)
    print(f"FILE: {pdf_name}")
    print("-" * 80)
    sys.stdout.flush()

    full_text = ""
    total_time = 0

    for page in pages:
        image_path = os.path.join(IMAGES_DIR, page)
        start = time.time()
        result = ocr.predict(input=image_path)
        elapsed = time.time() - start
        total_time += elapsed

        page_text = ""
        page_scores = []
        
        if result:
            for res in result:
                if hasattr(res, 'rec_texts') and res.rec_texts:
                    for i, text in enumerate(res.rec_texts):
                        page_text += text + "\n"
                        if hasattr(res, 'rec_scores') and i < len(res.rec_scores):
                            page_scores.append(float(res.rec_scores[i]))

        avg_score = sum(page_scores) / len(page_scores) if page_scores else 0
        print(f"  Page {page}: {len(page_scores)} boxes, avg score: {avg_score:.1%}, time: {elapsed:.1f}s")
        sys.stdout.flush()
        full_text += page_text

    print(f"\nTotal time: {total_time:.1f}s")
    print(f"Text length: {len(full_text)} chars")
    print(f"\n--- EXTRACTED TEXT (first 1500 chars) ---\n")
    print(full_text[:1500])
    if len(full_text) > 1500:
        print(f"\n... [{len(full_text) - 1500} more chars]")

    has_vin = bool(re.search(r'\b[A-HJ-NPR-Z0-9]{17}\b', full_text, re.I))
    has_dollar = bool(re.search(r'\$[\d,]+\.?\d*', full_text))
    has_date = bool(re.search(r'\d{1,2}/\d{1,2}/\d{2,4}', full_text))

    print(f"\n--- QUALITY ---")
    print(f"VIN found: {'✅' if has_vin else '❌'} | Dollar amounts: {'✅' if has_dollar else '❌'} | Dates: {'✅' if has_date else '❌'}")
    print("")
    sys.stdout.flush()

print("DONE.")
