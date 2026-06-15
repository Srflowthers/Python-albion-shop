import os
import sys
import asyncio
import pygetwindow as gw
from PIL import Image, ImageGrab

# Import AlbionAPI and calculate_score from App.py
try:
    sys.path.append(os.path.abspath(os.path.dirname(__file__)))
    from App import AlbionAPI, calculate_score, is_blacklisted
    print("[INFO] Successfully imported AlbionAPI from App.py")
except Exception as e:
    print(f"[ERROR] Could not import from App.py: {e}")

try:
    import winrt.windows.media.ocr as ocr
    from winrt.windows.graphics.imaging import SoftwareBitmap, BitmapPixelFormat, BitmapAlphaMode
    import winrt.windows.storage.streams as streams
    WINRT_OCR_AVAILABLE = True
    print("[INFO] WinRT OCR library is available.")
except Exception as e:
    WINRT_OCR_AVAILABLE = False
    print(f"[ERROR] WinRT OCR library is NOT available. Error: {e}")

# Enable DPI awareness on Windows to prevent coordinate scaling issues
if sys.platform == 'win32':
    try:
        import ctypes
        ctypes.windll.user32.SetProcessDPIAware()
        print("[INFO] SetProcessDPIAware success.")
    except Exception as e:
        print(f"[WARNING] Could not set DPI awareness: {e}")

def run_ocr_on_image(img):
    if not WINRT_OCR_AVAILABLE:
        return "Error: WinRT OCR not available"
    try:
        # Convert PIL Image to SoftwareBitmap (same as App.py)
        image = img.convert("RGBA")
        data_writer = streams.DataWriter()
        data_writer.write_bytes(bytes(image.tobytes()))
        bitmap = SoftwareBitmap(BitmapPixelFormat.RGBA8, image.width, image.height, BitmapAlphaMode.STRAIGHT)
        bitmap.copy_from_buffer(data_writer.detach_buffer())
        
        # Create OCR Engine
        engine = ocr.OcrEngine.try_create_from_user_profile_languages()
        if not engine:
            langs = ocr.OcrEngine.all_supported_languages
            if len(langs) > 0:
                engine = ocr.OcrEngine.try_create_from_language(langs[0])
                
        if not engine:
            return "Error: Could not create OCR Engine"
            
        async def run_recognize():
            result = await engine.recognize_async(bitmap)
            return result.text
            
        return asyncio.run(run_recognize())
    except Exception as e:
        return f"Error during OCR execution: {e}"

def main():
    print("\n--- Starting Capture, OCR and Zone Matching Test ---\n")
    
    # Initialize API and database
    api = AlbionAPI()
    db_res = api.loadZonesDatabase()
    print(f"[INFO] Zones DB Load status: {db_res}")
    print(f"[INFO] Total loaded zones in DB: {len(api.zones)}")
    
    # 1. Search for Albion Online client windows
    print("Searching for 'Albion Online Client' or 'Albion' windows...")
    wins = [w for w in gw.getWindowsWithTitle('Albion Online Client') if w.title and not w.isMinimized and w.width > 500 and w.height > 400]
    if not wins:
        wins = [w for w in gw.getWindowsWithTitle('Albion') if w.title and not w.isMinimized and w.width > 500 and w.height > 400
                and "python-albion" not in w.title.lower()
                and "analizador" not in w.title.lower()
                and "ide" not in w.title.lower()]
    if not wins:
        wins = [w for w in gw.getWindowsWithTitle('Albion Online Client') if w.title and not w.isMinimized]
    if not wins:
        wins = [w for w in gw.getWindowsWithTitle('Albion') if w.title and not w.isMinimized
                and "python-albion" not in w.title.lower()
                and "analizador" not in w.title.lower()
                and "ide" not in w.title.lower()]
                
    target_win = None
    if wins:
        target_win = wins[0]
        print(f"[FOUND] Found target window: '{target_win.title}'")
        print(f"        Coordinates: Left={target_win.left}, Top={target_win.top}, Width={target_win.width}, Height={target_win.height}")
    else:
        print("[NOT FOUND] No Albion client window found.")
        # Fallback to the currently active window or just full primary screen
        try:
            active_win = gw.getActiveWindow()
            if active_win and active_win.title:
                print(f"[FALLBACK] Using currently active window: '{active_win.title}'")
                target_win = active_win
        except Exception:
            pass

    if target_win:
        left, top, right, bottom = target_win.left, target_win.top, target_win.right, target_win.bottom
        width = right - left
        height = bottom - top
        
        if width <= 0 or height <= 0:
            print("[ERROR] Window has invalid dimensions. Capturing full screen instead.")
            target_win = None
        else:
            # Replicate the cropping bbox from App.py
            crop_x1 = left + int(width * 0.77)
            crop_y1 = top + int(height * 0.95)
            crop_x2 = left + int(width * 0.99)
            crop_y2 = top + int(height * 0.995)
            bbox = (crop_x1, crop_y1, crop_x2, crop_y2)
    
    if not target_win:
        print("[INFO] Capturing entire screen as fallback...")
        # Capture the main screen and grab a small portion from bottom right or center
        screen_width, screen_height = ImageGrab.grab().size
        print(f"Primary screen resolution: {screen_width}x{screen_height}")
        crop_x1 = int(screen_width * 0.77)
        crop_y1 = int(screen_height * 0.95)
        crop_x2 = int(screen_width * 0.99)
        crop_y2 = int(screen_height * 0.995)
        bbox = (crop_x1, crop_y1, crop_x2, crop_y2)
        print(f"Fallback crop bbox: {bbox}")

    print(f"Capturing screen region using PIL.ImageGrab.grab(bbox={bbox})...")
    try:
        # Save a full screenshot for reference
        if target_win:
            full_screenshot = ImageGrab.grab(bbox=(left, top, right, bottom))
        else:
            full_screenshot = ImageGrab.grab()
        full_screenshot.save("test_full_screenshot.png")
        print("[SUCCESS] Saved full window/screen screenshot to 'test_full_screenshot.png'")
        
        # Grab the specific cropped area
        img = ImageGrab.grab(bbox=bbox)
        img.save("test_cropped_raw.png")
        print("[SUCCESS] Saved cropped region to 'test_cropped_raw.png'")
        
        # 3x Resize matching App.py
        resized_img = img.resize((img.width * 3, img.height * 3), Image.Resampling.LANCZOS)
        resized_img.save("test_cropped_resized_3x.png")
        print("[SUCCESS] Saved 3x resized cropped region to 'test_cropped_resized_3x.png'")
        
        # Run OCR
        print("Running WinRT OCR on the 3x resized cropped image...")
        text = run_ocr_on_image(resized_img)
        
        print("\n================ OCR RESULT ================")
        print(f"Raw Text recognized:\n'{text}'")
        print("============================================")
        
        # Process lines similarly to App.py
        if text and not text.startswith("Error:"):
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            print("\nProcessing and matching lines against Zone DB:")
            
            for line in lines:
                words = line.split()
                filtered_words = []
                for w in words:
                    w_clean = "".join([c for c in w if c.isalpha()])
                    if len(w_clean) >= 3 and not any(c.isdigit() for c in w):
                        filtered_words.append(w_clean)
                    elif w_clean.lower() in ["of", "in", "de", "el", "la", "on", "t4", "t5", "t6", "t7", "t8"]:
                        filtered_words.append(w_clean)
                
                cleaned_line = " ".join(filtered_words).strip()
                print(f"\n- Raw line: '{line}'\n  Cleaned:  '{cleaned_line}'")
                
                if len(cleaned_line) < 3:
                    print("  [SKIP] Cleaned line too short (< 3 chars)")
                    continue
                
                # Find best matches
                matches = []
                for z in api.zones:
                    score = calculate_score(cleaned_line, z["n"])
                    matches.append((score, z))
                
                # Sort matches by score descending
                matches.sort(key=lambda x: -x[0])
                
                print("  Top 3 matches in DB:")
                for i in range(min(3, len(matches))):
                    score, z = matches[i]
                    print(f"    {i+1}. '{z['n']}' (ID: {z['id']}, Tier: T{z['t']}) -> Score: {score:.1f}%")
                
                # Report if it meets threshold
                best_score, best_match = matches[0]
                if best_score >= 75:
                    print(f"  [MATCH SUCCESS] Will detect zone: '{best_match['n']}' (Score {best_score:.1f}% >= 75%)")
                else:
                    print(f"  [MATCH FAILED] Best score {best_score:.1f}% is below threshold (75%)")
                
    except Exception as e:
        print(f"[ERROR] Capture/OCR pipeline failed: {e}")

if __name__ == "__main__":
    main()
