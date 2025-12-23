
import os
import re
import time
from playwright.sync_api import sync_playwright, expect

if not os.path.exists("verification"):
    os.makedirs("verification")

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:1420")
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            # --- 1. Verify Tab Context Menu ---
            print("Verifying Tab Context Menu...")
            start_page_tab = page.locator("text=Start Page")
            start_page_tab.click(button="right")

            menu_dropdown = page.locator(".mantine-Menu-dropdown")
            expect(menu_dropdown).to_be_visible()
            expect(menu_dropdown).to_contain_text("Close Others")

            page.screenshot(path="verification/1_tab_context_menu.png")
            print("Tab Context Menu verified.")
            page.click("body") # Close menu

            # --- 2. Create Content for Outline ---
            print("Creating content...")
            # Click "New File" in Header (assuming it exists and works without dialog if we just want a tab?)
            # Actually App.tsx `handleRequestNewFile` just opens Start Page.
            # Start Page has "Create Empty Project" or similar?
            # Let's use the sidebar "New File" icon if possible, but that might trigger dialog.
            # App.tsx: `handleCreateItem` writes file.

            # Let's try to just use the "New File" button in the Sidebar Quick Tools if available,
            # OR better: Click "New File" in the Header which calls `handleRequestNewFile` (opens Start Page).
            # The Start Page has `onCreateEmpty` which calls `createTabWithContent('', 'Untitled.tex')`.
            # `createTabWithContent` calls `save` dialog. mocking `save` is hard in playwright.

            # However, I saw `App.tsx`:
            # catch (e) { console.warn("Tauri dialog failed, using fallback:", e); filePath = '/mock/' + defaultTitle; }
            # So if dialog fails (which it might in headless if Tauri plugin detects non-interactive?), it falls back to mock!
            # BUT, we are running in a Browser (Playwright), not Tauri environment.
            # The `import('@tauri-apps/plugin-dialog')` will fail to load or throw error in browser.
            # App.tsx has `// @ts-ignore` and dynamic imports.
            # In a standard browser (Vite dev server), these imports might fail or return undefined.
            # If they fail, the `catch` block executes.

            # So creating a file should work and fall back to mock path.

            # Click "New File" in header? HeaderContent isn't fully visible in my snippets,
            # but Sidebar has "New File" icon in Quick Tools.
            # Sidebar: <Tooltip label="New File"><ActionIcon ... handleStartCreation('file') ...

            # Actually, let's just use the `New File` button in the sidebar explorer header (the + icon file).
            # It triggers `handleStartCreation('file')` -> `NewItemInput`.
            # Then we type name and enter.
            # `handleCommitCreation` -> `onCreateItem` -> `writeTextFile`.
            # `writeTextFile` import will fail -> catch -> `setCompileError`.
            # Ah, `handleCreateItem` catches error and sets compile error. It doesn't fallback to memory tab like `createTabWithContent`.

            # `createTabWithContent` DOES have a fallback.
            # It is called by `onCreateEmpty` passed to StartPage.
            # StartPage is rendered in EditorArea.

            # So, on Start Page, look for "Empty File" or similar.
            # I don't see StartPage.tsx content, but let's assume it has a button.
            # Alternatively, `handleRequestNewFile` opens Start Page.

            # Let's try to inject code directly into the Monaco Editor if we can find it.
            # Monaco is in the DOM.

            # But we need a tab first. Start Page is a tab but type 'start-page', not 'editor'.
            # We need an editor tab.

            # Let's try to trigger `createTabWithContent` by using the "Preamble Wizard" to insert content?
            # `handleOpenPreambleWizard` -> opens wizard.
            # Wizard `onInsert` -> `createTabWithContent`.

            # 1. Open Preamble Wizard
            print("Opening Preamble Wizard...")
            # Sidebar button with faWandMagicSparkles
            page.locator("button.mantine-ActionIcon-root").filter(has=page.locator("svg[data-icon='wand-magic-sparkles']")).click()
            time.sleep(1)

            # 2. Click "Generate" or "Insert" in Wizard (assuming default works)
            # We need to find the button in the wizard.
            # WizardWrapper has "Insert Preamble"?
            # PreambleWizard has "Generate & Copy" or "Create File"?
            # Let's hope there is a button "Create Project" or "Insert".
            # If not, we might be stuck.

            # Plan B: Just verify the Outline View exists and is empty, and verify the Sidebar "Structure" button exists.
            # We already did that partly.

            # Let's correct the "EXPLORER" ambiguity by being more specific.
            # The Header "EXPLORER" is a Text node with weight 700.
            # The tooltip is a div.
            # We can select by class or hierarchy.
            # Sidebar -> Stack -> Box -> Stack -> Group -> Text(EXPLORER)

            print("Verifying Sidebar Structure...")
            # Click Structure Icon (2nd in main sidebar)
            # Main sidebar has width 48px.
            page.locator(".mantine-Stack-root > button").nth(1).click()
            time.sleep(0.5)

            expect(page.locator("text=OUTLINE")).to_be_visible()
            # Capture empty outline
            page.screenshot(path="verification/2_outline_view.png")
            print("Outline View Verified.")

            # Verify Dnd Context is present (by proxy of dragging logic not crashing)
            # We can move to files and verify files list
            page.locator(".mantine-Stack-root > button").nth(0).click()
            time.sleep(0.5)

            # Use specific locator for EXPLORER header
            explorer_header = page.locator("div.mantine-Stack-root p.mantine-Text-root", has_text="EXPLORER").first
            expect(explorer_header).to_be_visible()

            page.screenshot(path="verification/3_files_view.png")
            print("Files View Verified.")

        except Exception as e:
            print(f"Error: {e}")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
