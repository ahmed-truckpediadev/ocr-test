"""Simple PaddleOCR test - just one image to understand the API output format"""
import os
import time
import json

os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

from paddleocr import PaddleOCR

IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")

print("Initializing PaddleOCR...")
ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)
print("Done.\n")

# Test just 1 image first
image_path = os.path.join(IMAGES_DIR, "samsara-1.png")
print(f"Processing: {image_path}")

start = time.time()
result = ocr.predict(input=image_path)
elapsed = time.time() - start
print(f"Time: {elapsed:.1f}s")

# Inspect the result type and structure
print(f"\nResult type: {type(result)}")
print(f"Result length: {len(result)}")

for i, res in enumerate(result):
    print(f"\n--- Result item {i} ---")
    print(f"Type: {type(res)}")
    
    # Try to see available attributes
    if hasattr(res, '__dict__'):
        print(f"Attributes: {list(vars(res).keys())}")
    
    # Try common attribute names from PaddleOCR v3 API
    for attr in ['rec_texts', 'rec_scores', 'rec_text', 'rec_score', 
                 'dt_polys', 'text', 'score', 'boxes']:
        if hasattr(res, attr):
            val = getattr(res, attr)
            if isinstance(val, list) and len(val) > 3:
                print(f"  {attr} (list, len={len(val)}): {val[:3]}...")
            else:
                print(f"  {attr}: {val}")

    # Try dict access
    if isinstance(res, dict):
        print(f"  Keys: {res.keys()}")
        for k, v in res.items():
            if isinstance(v, list) and len(v) > 3:
                print(f"    {k} (list, len={len(v)}): {v[:3]}...")
            else:
                print(f"    {k}: {v}")
    
    # Print string representation
    res_str = str(res)
    if len(res_str) > 500:
        print(f"  str repr (truncated): {res_str[:500]}...")
    else:
        print(f"  str repr: {res_str}")
    
    if i >= 2:
        print("... (stopping at 3 items)")
        break
