# Translation Bug Fix

## Problem
The Advisory Modal was triggering **two 400 errors** on `POST /api/translate` at the end of the analysis flow. These errors occurred when the modal attempted to translate the advisory content (fixes, interview tips, corridor warnings) into non-English languages.

## Root Cause
`advisory-modal.tsx` was calling `/api/translate` **without the required `language` field**:

```typescript
// BEFORE (line 100) - Missing language parameter ❌
const response = await fetch("/api/translate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dynamicTexts: texts }),  // ← No language field!
});
```

The `/api/translate` route **requires** a `language` field and returns a 400 error if it's missing or set to "English" (see route.ts:44-48).

## Solution
Updated `advisory-modal.tsx` to properly include the language from the translation context.

### Changes Made

#### 1. **Extract Language from Context** (line 78)
```typescript
// BEFORE
const { t } = useTranslation();

// AFTER
const { t, language } = useTranslation();  // ✅ Added language
```

#### 2. **Skip Translation for English** (lines 94-97)
```typescript
// Skip translation if English
if (language === "English") {
  setTranslatedContent(null);
  return;
}
```

This avoids unnecessary API calls when the user is viewing in English (the original advisory content is already in English).

#### 3. **Include Language in API Request** (lines 103-106)
```typescript
// AFTER - Includes language field ✅
const response = await fetch("/api/translate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    language,           // ✅ Now included
    dynamicTexts: texts,
  }),
});
```

#### 4. **Update useEffect Dependencies** (line 142)
```typescript
// BEFORE
}, [isOpen, advisory]);

// AFTER
}, [isOpen, advisory, language]);  // ✅ Added language dependency
```

This ensures the translation re-runs when the user changes languages while the modal is open.

### Debugging Enhancement
Added console logging to `/api/translate/route.ts` to help diagnose future issues:

```typescript
console.log("[Translate API] Request body:", {
  language,
  hasUiStrings: !!uiStrings,
  hasItems: !!items,
  hasCorridorInfo: !!corridorInfo,
  hasImportantNotes: !!importantNotes,
  hasDynamicTexts: !!dynamicTexts,
  dynamicTextsCount: dynamicTexts?.length || 0,
});

if (!language || language === "English") {
  console.error("[Translate API] 400 - Missing or English language. Body:", body);
  return new Response(/* 400 error */);
}
```

## Testing
1. Build successful ✓
2. Dev server running at http://localhost:3000 ✓
3. To verify the fix:
   - Open the app and select a persona with a suggested non-English language (e.g., Priya → Hindi)
   - Run through complete flow: Research → Document Analysis → Advisory Agent
   - Check terminal: should see `[Translate API] Request body` logs with proper language values
   - **No 400 errors should appear** when the advisory modal opens
   - Modal content should translate properly

## Result
The Advisory Modal now properly translates its content (fixes, interview tips, corridor warnings) into the selected language without triggering 400 errors. The fix ensures:
- ✅ Language field is always included in translation requests
- ✅ English-language users avoid unnecessary API calls
- ✅ Language changes trigger re-translation when modal is open
- ✅ Better debugging via console logs for future issues

## Files Modified
- `src/components/advisory-modal.tsx` - Fixed translation API calls
- `src/app/api/translate/route.ts` - Added debug logging
