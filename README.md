# Loop - Habit Tracker PWA 🌿

A modern Progressive Web App for tracking daily habits and sessions with custom metrics, AI insights, and beautiful UI. Built with React, TypeScript, Vite, Tailwind CSS, and Firebase.

## ✨ Features

### 🔐 **Authentication**
- Email/Password signup and login
- Google Sign-In integration
- Secure Firebase Authentication
- Profile picture upload and management

### 📊 **Session Tracking**
- **Grid Layout** - Beautiful responsive grid (1/2/3 columns)
- **Session Cards** - Compact cards showing time, description, tags, and images
- **Daily Stats** - Gamified score system (0-100) based on sessions, tags, and images
- **Image Upload** - Attach photos to sessions (compressed to 30KB)
- **Image Viewer** - Full-screen viewer with zoom, pan, and download
- **Real-time Updates** - Firebase Realtime Database integration

### 📅 **Analysis Tab**
- **Interactive Calendar** - Plain month view; tap a day to see its sessions
- **Day View** - Grid display of all sessions for selected date with quick add button
- **Insights** - One card per tag, visualized by its type
  - Habits (Yes/No): day grid, current streak, completion rate
  - Numbers: trend line, average, change vs the previous period
  - Ratings: score distribution and average
  - Clock times: average time and consistency, correct across midnight
  - Notes (Text): entry count and latest note
  - Filter chips for the tag types you use; cards sorted by how much you use them
  - Pin cards to the top; unused tags collapse into their own section
  - Date ranges of 7, 14 or 30 days (compared with the period before, within the 60 days of history kept), saved to localStorage
- **Tag Detail** - Tap a card for the full view: Line/Bar/Area charts with daily
  average/total/min/max, habit heatmap with weekday breakdown, clock time trends,
  and searchable notes that jump to their day
- **Side-by-Side Layout** - Desktop: Calendar + Day View, Mobile: Stacked

### 💬 **AI Chat Assistant**
- **Gemini AI Integration** - Powered by Google's Gemini 2.0 Flash
- **Conversation Management** - Saved locally in localStorage
- **Sliding Sidebar** - Mobile-friendly with hamburger menu
- Create multiple conversations
- Delete old conversations
- **Context-Aware Responses** - Analyzes your last 7 days of session data
- **Markdown Support** - Formatted AI responses with React Markdown
- **Suggested Questions** - Quick insights about your habits

### 🏷️ **Custom Tags System**
Create custom tracking metrics:
- **Number** - Values with min/max range
- **Rating** - Star ratings (1-10)
- **Checkbox** - Yes/No tracking
- **Text** - Free-form notes
- **Time** - Duration in minutes

### 👤 **Profile Management**
- **Profile Picture Upload** - Upload and compress images
- Shows in top-right header throughout app
- Tag creation and management
- User settings
- Logout functionality

### 🎨 **Modern UI/UX**
- **Pure Black Dark Mode** - OLED-friendly with subtle green tint
- **Zoom Prevention** - Feels like a native app on mobile
- **Smooth Animations** - Sliding sidebars and transitions
- **Theme-aware Scrollbars** - Custom styled scrollbars
- **Responsive Design** - Works on mobile, tablet, desktop
- **Bottom Navigation** - Analysis, Add Session, Chat tabs
- **Top Header** - App branding with profile picture and hamburger menu (context-aware for chat)

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Firebase Account** - [Sign up](https://console.firebase.google.com/)
- **Google AI Studio Account** (optional, for chat) - [Sign up](https://aistudio.google.com/)

### Step 1: Clone the Repository

```bash
git clone https://github.com/imnexerio/loop.git
cd loop
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Firebase Setup

1. **Create a Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click **"Add project"**
   - Enter project name (e.g., "Loop Habit Tracker")
   - Disable Google Analytics (optional)
   - Click **"Create project"**

2. **Enable Realtime Database:**
   - In Firebase Console, go to **Build** → **Realtime Database**
   - Click **"Create Database"**
   - Choose location closest to you
   - Start in **"Test mode"** (we'll secure it later)
   - Click **"Enable"**

3. **Set up Database Rules:**
   - Go to **Realtime Database** → **Rules** tab
   - Replace with this secure configuration:

```javascript
{
  "rules": {
    "users": {
      "$userId": {
        ".read": "$userId === auth.uid",
        ".write": "$userId === auth.uid"
      }
    }
  }
}
```

   - Click **"Publish"**

4. **Enable Authentication:**
   - Go to **Build** → **Authentication**
   - Click **"Get started"**
   - Enable **Email/Password** sign-in method
   - Enable **Google** sign-in method (optional but recommended)

5. **Get Firebase Config:**
   - Go to **Project Settings** (gear icon)
   - Scroll down to **"Your apps"**
   - Click **"</>** (Web)" to add a web app
   - Register app with nickname (e.g., "Loop Web")
   - Copy the `firebaseConfig` object

6. **Create `.env` file in project root:**

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Gemini AI Configuration (Optional)
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

   > **Important:** Replace all values with your actual Firebase config values!

### Step 4: Gemini AI Setup (Optional - for Chat Feature)

1. **Get Gemini API Key:**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Click **"Get API key"** or **"Create API key"**
   - Select your Firebase project or create new project
   - Copy the API key

2. **Add to `.env` file:**

```bash
VITE_GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

   > **Note:** The chat feature will work without a key but show setup instructions. Free tier includes 60 requests/minute.

### Step 5: Run the App

```bash
npm run dev
```

Open your browser at [http://localhost:5173](http://localhost:5173)

### Step 6: Build for Production

```bash
npm run build
npm run preview
```

The optimized build will be in the `dist/` folder.

## 📱 Deployment

### Deploy to Firebase Hosting

1. **Install Firebase CLI:**
```bash
npm install -g firebase-tools
```

2. **Login to Firebase:**
```bash
firebase login
```

3. **Initialize Firebase:**
```bash
firebase init hosting
```

   - Select your Firebase project
   - Set public directory to: `dist`
   - Configure as single-page app: **Yes**
   - Set up automatic builds: **No**

4. **Build and Deploy:**
```bash
npm run build
firebase deploy
```

Your app will be live at: `https://your-project.web.app`

### Deploy to Vercel/Netlify

1. **Connect your Git repository**
2. **Set build command:** `npm run build`
3. **Set output directory:** `dist`
4. **Add environment variables** from your `.env` file

## 🗄️ Database Structure

```
users/{userId}/
  ├── profile/
  │     ├── name: string
  │     ├── email: string
  │     ├── photoImageId: string (reference to image)
  │     ├── createdAt: ISO timestamp
  │     └── settings/
  │           ├── llmProvider: "gemini" | "chatgpt" | "claude"
  │           └── llmApiKey: string (optional)
  ├── tags/{tagId}/
  │     ├── id: string (auto-generated)
  │     ├── name: string
  │     ├── type: "number" | "rating" | "checkbox" | "text" | "time"
  │     ├── config/
  │     │     ├── min: number (optional)
  │     │     ├── max: number (optional)
  │     │     └── unit: string (optional)
  │     └── createdAt: ISO timestamp
  ├── sessions/{YYYY-MM-DD}/
  │     ├── date: string (YYYY-MM-DD)
  │     ├── lastUpdated: ISO timestamp
  │     └── sessions/{timestamp}/
  │           ├── timestamp: string (ISO format)
  │           ├── description: string
  │           ├── tags: Record<tagId, value>
  │           └── imageId: string (optional)
  └── images/{imageId}/
        ├── id: string (auto-generated)
        ├── type: "profile" | "session"
        ├── base64: string (compressed image data)
        ├── createdAt: number (Unix timestamp)
        ├── size: number (bytes)
        ├── sessionTimestamp: number (optional, for session images)
        └── date: string (optional, YYYY-MM-DD for session images)
```

## 🛠️ Tech Stack

- **React 18** - UI library with hooks
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Firebase Realtime Database** - Real-time data sync
- **Firebase Authentication** - User management
- **Google Gemini AI** - AI chat assistant (Gemini 2.0 Flash)
- **Recharts** - Responsive charting library for data visualization
- **React Markdown** - Markdown rendering in chat
- **React Router DOM** - Client-side routing
- **Vite PWA Plugin** - Progressive Web App features

## � Project Structure

```
Loop/
├── src/
│   ├── components/
│   │   ├── analysis/
│   │   │   ├── Calendar.tsx          # Interactive month calendar with session indicators
│   │   │   ├── Charts.tsx            # Recharts visualizations (line/bar/area)
│   │   │   ├── DayView.tsx           # Grid layout of session cards for selected date
│   │   │   └── SessionCard.tsx       # Individual session card with tags/images
│   │   ├── AddSessionModal.tsx       # Create/edit session modal
│   │   ├── AddSessionView.tsx        # Add Session tab (3rd tab in nav)
│   │   ├── AnalysisTab.tsx           # Analysis tab with calendar + day view + charts
│   │   ├── ChatTab.tsx               # AI chat interface with Gemini integration
│   │   ├── Dashboard.tsx             # Main app shell with bottom nav + top header
│   │   ├── ImageViewer.tsx           # Full-screen image viewer with zoom/pan
│   │   ├── Login.tsx                 # Authentication page (login/signup)
│   │   └── ProfileTab.tsx            # Profile settings and tag management
│   ├── contexts/
│   │   └── AuthContext.tsx           # Firebase Authentication context
│   ├── firebase/
│   │   └── config.ts                 # Firebase SDK initialization
│   ├── services/
│   │   ├── dataManager.ts            # Unified data layer with caching
│   │   ├── firebaseService.ts        # Firebase Realtime Database operations
│   │   ├── gemini.ts                 # Gemini AI API integration
│   │   └── imageService.ts           # Image compression to 30KB base64
│   ├── types/
│   │   └── index.ts                  # TypeScript type definitions
│   ├── App.tsx                       # Root component with routing
│   ├── index.css                     # Global styles + custom scrollbars
│   ├── main.tsx                      # React entry point
│   └── vite-env.d.ts                 # Vite environment type declarations
├── public/                           # Static assets (PWA icons, manifest)
├── .env                              # Environment variables (gitignored)
├── .env.example                      # Environment variables template
├── firebase.json                     # Firebase hosting configuration
├── index.html                        # HTML entry point
├── package.json                      # Dependencies and scripts
├── postcss.config.js                 # PostCSS configuration
├── tailwind.config.js                # Tailwind CSS + custom colors
├── tsconfig.json                     # TypeScript configuration
├── tsconfig.node.json                # TypeScript config for Node scripts
└── vite.config.ts                    # Vite + PWA plugin configuration
```

## 🎯 **Usage Guide**

### 1. **First Time Setup**
- Sign up with email/password or Google
- Click profile icon (top-right)
- Upload profile picture (optional)
- Create your first tags (e.g., Mood, Energy, Focus, Sleep Hours)

### 2. **Logging a Session**
- Go to **Add Session** tab (middle tab in bottom nav)
- Or click "Add Session" button in Day View header
- Describe what you're tracking
- Fill in your tag values (number, rating, checkbox, text, time)
- Optionally attach an image
- Session auto-saves as you type!

### 3. **Viewing History**
- Go to **Analysis** tab (first tab in bottom nav)
- **Desktop:** Calendar and Day View side-by-side
- **Mobile:** Stacked layout
- Calendar shows green dots for days with sessions
- Click any date to view that day's sessions in grid layout
- Scroll down to see **Charts** with your habit trends

### 4. **Analyzing Trends**
- In Analysis tab, scroll to Charts section
- Select tags to visualize (number, rating, or time tags)
- Choose chart type: Line, Bar, or Area
- Pick aggregation: Average, Sum, Min, or Max
- Adjust date range: 7, 14, or 30 days
- Compare multiple metrics with different colors
- Preferences saved automatically

### 5. **AI Insights**
- Go to **Chat** tab (third tab in bottom nav)
- Click hamburger menu (mobile) to manage conversations
- Ask questions about your habits (e.g., "What patterns do you notice?")
- Get personalized suggestions based on your data
- Use suggested questions for quick insights
- AI analyzes your last 7 days of sessions automatically
- Responses formatted in Markdown

## 🔧 **Future Enhancements**

- [x] Gemini AI integration for chat ✅
- [x] Markdown-formatted AI responses ✅
- [x] Context-aware AI using user data ✅
- [x] Data visualization with Recharts ✅
- [x] Multiple chart types (line, bar, area) ✅
- [x] Chart preferences persistence ✅
- [ ] Weekly/monthly summaries dashboard
- [ ] Export data to CSV/JSON
- [ ] Habit streaks and goal tracking
- [ ] Push notifications and reminders
- [ ] Cloud backup and restore
- [ ] Tag categories and custom colors
- [ ] Advanced search and filtering
- [ ] Custom date range selection for charts
- [ ] Comparison views (week-over-week, month-over-month)
- [ ] Share insights with others

## 📝 **Data Flow**

1. User creates **tags** in Profile (e.g., "Mood", "Energy", "Sleep Hours")
2. User navigates to **Add Session** tab or clicks "Add Session" in Day View
3. Modal opens with description textarea and dynamic tag inputs based on tag type
4. User fills out form (description, tags, optional image)
5. Session **auto-saves** to Firebase Realtime Database as user types
6. Data saved to: `/users/{uid}/sessions/{YYYY-MM-DD}/sessions/{timestamp}`
7. Images compressed to 30KB base64 and stored in: `/users/{uid}/images/{imageId}`
8. Real-time listeners update UI instantly across all tabs
9. Calendar shows green dots for days with sessions
10. Click date to view all sessions in grid layout with Day View
11. Charts automatically aggregate data for selected tags and date ranges

## 🌐 **PWA Features**

- ✅ Installable on mobile and desktop
- ✅ Service worker with caching strategy
- ✅ Fast loading with asset caching
- ✅ App-like experience with native feel
- ✅ Auto-updates on reload
- ✅ Manifest with app icons and theme colors
- ✅ Responsive design for all screen sizes


## 📄 **License**

MIT

## 🤝 **Contributing**

Contributions welcome! Feel free to open issues or submit PRs.

---

Built with ❤️ using React, TypeScript, and Firebase
