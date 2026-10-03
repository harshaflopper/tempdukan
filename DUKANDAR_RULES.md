# DUKANDAR APP DEVELOPMENT RULES & DESIGN PRINCIPLES

## 1. Mindset Principle
- **Think as an Indian Village Dukandar (Kirana Shopkeeper)**: Always design features, workflows, and voice interfaces from the perspective of a rural or semi-urban shopkeeper in India. 
- **Zero Complexity**: The shopkeeper is busy handling customers, giving change, and weighing goods. Every action must take **1-2 seconds** with maximum 1 tap or 1 spoken sentence.
- **Voice & Visual First**: Prioritize camera snapping and spoken Hindi/Hinglish speech over typing or filling long digital forms.

## 2. UI & Design Rules
- **NEVER USE EMOJIS IN THE UI**: Emojis are strictly forbidden across all screens, buttons, badges, toasts, and headers. Use clean Lucide SVG icons, crisp typography, and harmonious color badges instead.
- **Clean & High Contrast**: Use clean backgrounds (Slate/White), high-contrast text, clear borders, and readable font sizes.
- **Vernacular Clarity**: Use simple, natural terms familiar to shopkeepers (e.g., *Bikri*, *Maal Aaya*, *Kharab*, *Stock Ginti*, *Inventory*).

## 3. Automatic Inventory Sync Rules
- Every shop action (Sales, Purchases/Restock, Damage/Loss, Physical Count) must automatically adjust digital stock in Supabase.
- Always provide natural audio voice feedback in Hindi/Hinglish so the shopkeeper knows stock was updated without staring at the screen.
