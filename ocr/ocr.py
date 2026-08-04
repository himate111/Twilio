from paddleocr import PaddleOCR
import sys

image_path = sys.argv[1]

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False
)

results = ocr.predict(image_path)

text = []

for page in results:
    if hasattr(page, "res"):
        for item in page.res.get("rec_texts", []):
            text.append(item)

print("\n".join(text))