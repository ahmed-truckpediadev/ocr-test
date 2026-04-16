"""
Approach 5: PaddleOCR (PP-OCRv5)
Open-source OCR engine from Baidu with 75k+ GitHub stars.
Supports 100+ languages, includes text detection + recognition.
Tests both raw OCR text extraction and structured output quality.
"""
import os
import sys
import time
import json
import re

# PDF page images are already in images/ directory from previous tests
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")

# Same test structure as other approaches
PDF_GROUPS = {
    "Work_Order_2___Samsara.pdf (Digital)": ["samsara-1.png"],
    "20260331081932790.pdf - Take Off Tire (Scanned)": ["invoice1-1.png"],
    "20260331081932790.pdf - Thermo King (Scanned)": ["invoice1-2.png"],
    "20260331081932790.pdf - TA Truck Service (Scanned)": ["invoice1-3.png"],
    "20260331081932790.pdf - Bauer Built Tire (Scanned)": ["invoice1-4.png"],
    "20260331075307659.pdf - Truck Center (Scanned, 2pg)": ["invoice2-1.png", "invoice2-2.png"],
    "20260331075307659.pdf - MCT Carrier (Scanned, 2pg)": ["invoice2-3.png", "invoice2-4.png"],
}


def test_paddleocr():
    from paddleocr import PaddleOCR

    print("=" * 80)
    print("APPROACH 5: PaddleOCR (PP-OCRv5)")
    print("=" * 80)
    print("Open-source OCR engine with text detection + recognition.")
    print("75k+ GitHub stars, supports 100+ languages.\n")

    # Initialize PaddleOCR - first run downloads models (~150MB)
    print("Initializing PaddleOCR (downloading models on first run)...")
    init_start = time.time()
    ocr = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    init_time = time.time() - init_start
    print(f"Initialization time: {init_time:.1f}s\n")

    for pdf_name, pages in PDF_GROUPS.items():
        print("-" * 80)
        print(f"FILE: {pdf_name}")
        print("-" * 80)

        full_text = ""
        total_time = 0
        total_boxes = 0
        all_confidences = []

        for page in pages:
            image_path = os.path.join(IMAGES_DIR, page)
            start = time.time()

            result = ocr.predict(input=image_path)
            elapsed = time.time() - start
            total_time += elapsed

            # Extract text and confidence from results
            page_text = ""
            page_boxes = 0
            page_confidences = []

            if result and len(result) > 0:
                for res in result:
                    if hasattr(res, 'rec_texts') and res.rec_texts:
                        for i, text in enumerate(res.rec_texts):
                            page_text += text + "\n"
                            page_boxes += 1
                            if hasattr(res, 'rec_scores') and i < len(res.rec_scores):
                                page_confidences.append(res.rec_scores[i])
                    elif isinstance(res, dict):
                        # Handle dict-style output
                        if 'rec_text' in res:
                            page_text += res['rec_text'] + "\n"
                            page_boxes += 1
                            if 'rec_score' in res:
                                page_confidences.append(res['rec_score'])

            # Fallback: try iterating differently if no text extracted
            if not page_text.strip() and result:
                try:
                    for res in result:
                        # Try accessing as list of dicts or objects
                        text_data = str(res)
                        page_text = text_data
                except:
                    pass

            avg_conf = sum(page_confidences) / len(page_confidences) if page_confidences else 0
            all_confidences.extend(page_confidences)
            total_boxes += page_boxes

            print(f"  Page {page}: {page_boxes} text boxes, "
                  f"avg confidence: {avg_conf:.1%}, time: {elapsed:.1f}s")
            full_text += f"\n--- PAGE: {page} ---\n" + page_text

        overall_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 0

        print(f"\nTotal processing time: {total_time:.1f}s")
        print(f"Total text boxes: {total_boxes}")
        print(f"Overall confidence: {overall_conf:.1%}")
        print(f"Total text length: {len(full_text)} chars")
        print(f"\n--- EXTRACTED TEXT (first 2000 chars) ---\n")
        print(full_text[:2000])
        if len(full_text) > 2000:
            print(f"\n... [{len(full_text) - 2000} more characters truncated]")

        # Quality assessment
        has_text = len(full_text.strip()) > 50
        has_vin = bool(re.search(r'\b[A-HJ-NPR-Z0-9]{17}\b', full_text, re.IGNORECASE))
        has_dollar = bool(re.search(r'\$[\d,]+\.?\d*', full_text))
        has_date = bool(re.search(r'\d{1,2}/\d{1,2}/\d{2,4}', full_text))

        print(f"\n--- QUALITY ASSESSMENT ---")
        print(f"Has meaningful text: {'✅ YES' if has_text else '❌ NO'}")
        print(f"Contains VIN pattern: {'✅ YES' if has_vin else '❌ NO'}")
        print(f"Contains dollar amounts: {'✅ YES' if has_dollar else '❌ NO'}")
        print(f"Contains dates: {'✅ YES' if has_date else '❌ NO'}")
        print("")


if __name__ == "__main__":
    test_paddleocr()
