# Advisory Agent Transparency Update

## Problem
The Advisory Agent was running for ~14-16 seconds with no visual feedback, creating "dead time" where users didn't know what was happening. The modal eventually appeared but felt abrupt.

## Solution
Added a beautiful loading overlay that appears while the Advisory Agent is thinking.

### What Was Added

#### 1. **AdvisoryLoading Component** (`src/components/advisory-loading.tsx`)
- Full-screen backdrop with blur effect
- Animated sparkles icon with rotating loader
- Clear messaging: "Preparing Your Recommendations"
- Subtext: "Our advisory agent is reviewing your application and crafting personalized guidance..."
- Animated bouncing dots for progress indication
- Emerald gradient theme matching the advisory agent colors
- Auto-translates based on selected language

#### 2. **State Management** (`src/app/analyze/page.tsx`)
- Added `isAdvisoryRunning` state
- Tracks when Advisory Agent starts (`agent_start` event)
- Clears when Advisory Agent completes (`agent_complete` event)
- Shows loading overlay during this period

#### 3. **User Flow**
**Before:**
1. Documents finish analyzing ✓
2. *[14-16 seconds of nothing visible]*
3. Modal suddenly pops up

**After:**
1. Documents finish analyzing ✓
2. Beautiful loading overlay appears immediately
3. Shows "Preparing Your Recommendations" with animations
4. Advisory Agent thinking panels visible in background (through translucent backdrop)
5. Loading overlay smoothly transitions to modal when ready

### Visual Design
- **Backdrop**: Black with 40% opacity + backdrop blur
- **Card**: White/slate with emerald gradient background
- **Icon**: Sparkles (primary) + spinning loader (secondary)
- **Animation**:
  - Sparkles pulse gently
  - Loader spins slowly (3s rotation)
  - 3 dots bounce with staggered delays
- **Colors**: Emerald theme (matches Advisory Agent)

### Technical Details
- **Loading State**: Managed via `isAdvisoryRunning` boolean
- **Trigger**: Sets true on `orchestrator/agent_start` with agent="Advisory Agent"
- **Clear**: Sets false on `orchestrator/agent_complete`
- **Translation**: All text wrapped in `t()` for i18n support
- **Z-Index**: 40 (below modal's 50, above everything else)

### Benefits
1. **No more dead time**: Users see immediate feedback
2. **Clear communication**: Explains what's happening
3. **Professional feel**: Smooth transitions, no jarring jumps
4. **Maintains context**: Can still see thinking panels through backdrop
5. **Accessible**: Works with translations, theme toggle

## Testing
Build successful ✓
All TypeScript checks passed ✓
Translations ready ✓

## Files Modified
- `src/app/analyze/page.tsx` - Added state management and rendering
- `src/components/advisory-loading.tsx` - New loading component
