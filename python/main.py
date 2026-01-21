import sys
import os

# FIX: Force Playwright to look in global cache (avoid _MEI temp dir issues)
# MUST BE DONE BEFORE IMPORTING PLAYWRIGHT
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "0"

import json
import time
import asyncio
import argparse
from typing import Optional, List, Dict, Any
from playwright.async_api import async_playwright, Page, BrowserContext
import pandas as pd
import openpyxl
import urllib.parse

# Force stdout to be line-buffered or unbuffered
sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')


class WhatsAppSender:
    def __init__(self):
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.playwright = None
        self.is_running = False
        self.should_cancel = False
        
    async def log(self, type: str, message: str, data: Any = None):
        """Emit a JSON log event to stdout for Tauri."""
        event = {
            "type": type,
            "message": message,
            "data": data,
            "timestamp": time.time()
        }
        print(json.dumps(event), flush=True)

    def find_chromium_path(self) -> Optional[str]:
        """Finds the Playwright Chromium executable in the standard local location."""
        import glob
        
        def _get_path():
            try:
                # Metadata for Windows: %LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe
                local_app_data = os.environ.get("LOCALAPPDATA")
                if not local_app_data:
                    return None
                
                base_path = os.path.join(local_app_data, "ms-playwright")
                pattern = os.path.join(base_path, "chromium-*", "chrome-win64", "chrome.exe")
                
                matches = glob.glob(pattern)
                if matches:
                    # Return the latest version found
                    return sorted(matches)[-1]
                return None
            except Exception:
                return None

        # First attempt
        path = _get_path()
        if path:
            return path

        # If not found, try to install
        try:
            print(json.dumps({"type": "info", "message": "Installing Playwright browsers (first run only)...", "timestamp": time.time()}), flush=True)
            from playwright.__main__ import main as playwright_cli
            # We need to run this in a way that doesn't exit the process
            # subprocess might be safer if we can trust sys.executable, but frozen app is tricky.
            # importing directly runs in same process. playwright cli handles sys.argv, we needs to mock it or call internal
            # Actually playwright.main just calls sys.exit(main()) which is bad.
            # We should subprocess if possible, or use internal driver.
            
            # Using subprocess with the bundled python environment is safest if we can access the module
            # But in PyInstaller onefile/onedir, we don't have easy access to 'python -m playwright'.
            
            # Alternative: Catch SystemExit?
            try:
                # Mock sys.argv for the cli
                old_argv = sys.argv
                sys.argv = ["playwright", "install", "chromium"]
                playwright_cli()
            except SystemExit:
                pass # Playwright CLI exits on success
            finally:
                sys.argv = old_argv
                
            # Check again
            return _get_path()
            
        except Exception as e:
            print(json.dumps({"type": "error", "message": f"Auto-install failed: {e}", "timestamp": time.time()}), flush=True)
            return None

    async def start_session(self, user_data_dir: str, headless: bool = False):
        try:
            self.playwright = await async_playwright().start()
            # Use a persistent context to save the session (login)
            if not os.path.exists(user_data_dir):
                os.makedirs(user_data_dir, exist_ok=True)
                
            await self.log("info", "Starting browser...", {"user_data_dir": user_data_dir})

            # FIX: Manually find the global playwright browser path
            # PyInstaller environment often ignores PLAYWRIGHT_BROWSERS_PATH="0"
            executable_path = self.find_chromium_path()
            if not executable_path:
                await self.log("warning", "Could not find global Chromium. Letting Playwright decide (may fail).")
            else:
                 await self.log("info", f"Using browser at: {executable_path}")
            
            self.context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                executable_path=executable_path, # Explicitly pass the path
                headless=headless,
                args=["--disable-blink-features=AutomationControlled"], # Basic evasion
                viewport={"width": 1280, "height": 800}
            )
            
            self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()
            
            await self.log("info", "Navigating to WhatsApp Web...")
            await self.page.goto("https://web.whatsapp.com")
            
            # Wait a bit for potential load
            await self.log("info", "Esperando inicio de sesión...")
            
            # Race condition: Check for Login (Side panel) OR QR Code (Canvas)
            try:
                # We wait for either the side panel (logged in) or the QR canvas (needs login)
                # This prevents waiting 60s if already logged in.
                
                # Check if we are already logged in fast
                try:
                    await self.page.wait_for_selector("#side", timeout=5000)
                    await self.log("ready", "Sesión detectada (Panel lateral).")
                    return
                except:
                    pass
                
                # If not immediately found, wait for either QR or Side
                await self.log("info", "Escanea el código QR si aparece en pantalla.")
                
                # Poll for success
                start_time = time.time()
                while time.time() - start_time < 60:
                    if await self.page.query_selector("#side"):
                        await self.log("ready", "WhatsApp Web cargado correctamente.")
                        return
                    if await self.page.query_selector("div[data-testid='chat-list-search']"):
                         await self.log("ready", "WhatsApp Web cargado correctamente.")
                         return
                    await asyncio.sleep(1)
                
                # If loop finishes without return
                await self.log("action_required", "Tiempo de espera agotado. Si ya escaneaste, intenta de nuevo.")
                
            except Exception as e:
                # If timeout, it means maybe QR is showing
                 await self.log("error", f"Error detectando sesión: {str(e)}")
                
        except Exception as e:
            await self.log("error", f"Failed to start session: {str(e)}")

    async def normalize_phone(self, phone: Any) -> Optional[str]:
        # Simple normalization: keep only digits
        if pd.isna(phone):
            return None
        s = str(phone)
        digits = "".join(filter(str.isdigit, s))
        if len(digits) < 7: # Basic sanity check
            return None
        return digits

    async def send_message(self, phone: str, message: str, dry_run: bool = False) -> bool:
        if not self.page:
            return False
            
        try:
            # URL encode message
            encoded_msg = urllib.parse.quote(message)
            
            # Using wa.me link is robust
            url = f"https://web.whatsapp.com/send?phone={phone}&text={encoded_msg}"
            await self.page.goto(url)
            
            # Wait for the send button or text input to be ready
            # The textbox usually has 'data-testid="conversation-compose-box-input"' or similar
            # The send button 'data-testid="send"' or 'span[data-icon="send"]'
            
            chat_loaded = False
            try:
                # Wait for chat input
                await self.page.wait_for_selector("div[contenteditable='true'][role='textbox']", timeout=20000)
                chat_loaded = True
            except:
                # Maybe invalid number window
                if await self.page.query_selector("div[data-testid='popup-contents']"): 
                     # "Phone number shared via url is invalid." popup
                     await self.log("fail", f"Invalid number: {phone}")
                     return False
                await self.log("fail", f"Chat load timeout for {phone}")
                return False

            if chat_loaded:
                # Wait a random tiny bit
                await asyncio.sleep(1 + (time.time() % 1)) 
                
                if not dry_run:
                    # Press Enter to send
                    await self.page.keyboard.press("Enter")
                    # Verify sent (check for single checkmark or just assume sent if no error)
                    # Ideally wait for message bubble to appear status pending
                    await asyncio.sleep(1) # Safety wait
                else:
                    await self.log("info", f"[SIMULACIÓN] Mensaje preparado para {phone}. No enviado.")
                    await asyncio.sleep(1)
                
                return True
                
        except Exception as e:
            await self.log("error", f"Error sending to {phone}: {str(e)}")
            return False

    async def run_batch(self, excel_path: str, config: Dict[str, Any]):
        self.is_running = True
        self.should_cancel = False
        
        try:
            df = pd.read_excel(excel_path)
            
            phone_col = config.get("phone_col", "celular")
            country_col = config.get("country_col", "")
            msg_template = config.get("message", "Hello")
            interval = config.get("interval_seconds", 60)
            dry_run = config.get("dry_run", False)
            
            if phone_col not in df.columns:
                await self.log("error", f"Column '{phone_col}' not found in Excel.")
                return

            total = len(df)
            await self.log("start", f"Starting batch of {total} messages.")
            
            for index, row in df.iterrows():
                if self.should_cancel:
                    await self.log("cancel", "Batch cancelled by user.")
                    break
                    
                phone_raw = row[phone_col]
                
                # Handle country code if provided
                if country_col and country_col in df.columns:
                    country_val = row[country_col]
                    if pd.notna(country_val):
                         phone_raw = str(country_val) + str(phone_raw)
                
                phone = await self.normalize_phone(phone_raw)
                
                if not phone:
                    await self.log("skip", f"Invalid phone at row {index+1}")
                    continue
                    
                # Personalization
                # Simple replacement {{col_name}}
                msg = msg_template
                for col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        msg = msg.replace(f"{{{{{col}}}}}", str(val))
                
                success = await self.send_message(phone, msg, dry_run=dry_run)
                status = "sent" if success else "fail"
                
                await self.log("progress", f"Processed row {index+1}", {
                    "index": index,
                    "phone": phone,
                    "status": status,
                    "total": total
                })
                
                # Wait interval
                if index < total - 1:
                    await asyncio.sleep(interval)
                    
        except Exception as e:
            await self.log("error", f"Batch error: {str(e)}")
        finally:
            self.is_running = False
            await self.log("finished", "Batch processing finished.")
            if self.context:
                await self.context.close()
            if self.playwright:
                await self.playwright.stop()

    async def handle_command(self, line: str):
        try:
            cmd = json.loads(line)
            action = cmd.get("action")
            
            if action == "start":
                payload = cmd.get("payload", {})
                excel_path = payload.get("excel_path")
                # Run in background task? 
                # For simplicity in this structure, we might block or use create_task
                # Ideally, we trigger the batch run task
                if not self.is_running:
                    # Move profile out of src-tauri to avoid hot-reload loop
                    # If CWD is src-tauri, go up one level.
                    base_dir = os.getcwd()
                    if base_dir.endswith("src-tauri"):
                        base_dir = os.path.dirname(base_dir)
                    
                    user_data = os.path.join(base_dir, "whatsapp_profile")
                    
                    # Ensure session is open
                    if not self.page:
                        await self.start_session(user_data, headless=False)
                    asyncio.create_task(self.run_batch(excel_path, payload))
            
            elif action == "open_browser":
                if not self.is_running and not self.page:
                    # Same logic for path
                    base_dir = os.getcwd()
                    if base_dir.endswith("src-tauri"):
                        base_dir = os.path.dirname(base_dir)
                        
                    user_data = os.path.join(base_dir, "whatsapp_profile")
                    await self.start_session(user_data, headless=False)
                    
            elif action == "cancel":
                self.should_cancel = True
                
        except json.JSONDecodeError:
            pass

async def main():
    sender = WhatsAppSender()
    
    # Simple stdin loop using run_in_executor to avoid Windows Proactor pipe issues
    loop = asyncio.get_running_loop()
    
    await sender.log("init", "Python sidecar ready.")
    
    while True:
        try:
            # Read line in a separate thread to prevent blocking main loop
            # and avoid ProactorReadPipeTransport crashes on Windows
            line = await loop.run_in_executor(None, sys.stdin.readline)
            
            if not line:
                break
                
            await sender.handle_command(line)
        except Exception as e:
            await sender.log("error", f"Stdin error: {str(e)}")
            break

if __name__ == "__main__":
    asyncio.run(main())
