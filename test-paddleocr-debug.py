"""Debug PaddleOCR result structure"""
import os
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

from paddleocr import PaddleOCR

IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    text_detection_model_name="PP-OCRv5_mobile_det",
    text_recognition_model_name="PP-OCRv5_mobile_rec",
)

image_path = os.path.join(IMAGES_DIR, "samsara-1.png")
print(f"Processing: {image_path}")

result = ocr.predict(input=image_path)

print(f"type(result): {type(result)}")
print(f"len(result): {len(result)}")

for i, r in enumerate(result):
    print(f"\n=== Item {i} ===")
    print(f"type: {type(r)}")
    if hasattr(r, '__dict__'):
        for k, v in vars(r).items():
            if k.startswith('_'):
                continue
            sv = str(v)
            if len(sv) > 200:
                sv = sv[:200] + "..."
            print(f"  .{k} = {sv}")
    # Also try dir
    attrs = [a for a in dir(r) if not a.startswith('_')]
    print(f"  public attrs: {attrs[:20]}")
    
    # Try json/str
    if hasattr(r, 'to_json'):
        j = r.to_json()
        print(f"  .to_json(): {str(j)[:500]}...")
    
    print(f"  str(): {str(r)[:500]}...")
    break  # just first result
