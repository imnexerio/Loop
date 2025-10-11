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
- **Interactive Calendar** - Month view with session indicators
- **Day View** - Grid display of all sessions for selected date
- **Charts & Insights** - Visualize your habit data
- **Add Session** - Quick button in day view header

### 💬 **AI Chat Assistant**
- **Gemini AI Integration** - Powered by Google's Gemini 2.0 Flash
- Conversation history saved locally
- Sliding sidebar with chat management
- Create multiple conversations
- Delete old conversations
- Context-aware responses using your last 7 days
- Markdown-formatted responses
- Suggested questions for quick insights

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
- **Top Header** - App branding with hamburger menu (context-aware)

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
  │     ├── name
  │     ├── email
  │     ├── photoImageId (reference to image)
  │     ├── createdAt
  │     └── settings/
  │           └── llmProvider
  ├── tags/{tagId}/
  │     ├── name
  │     ├── type (number|rating|checkbox|text|time)
  │     ├── config/ {min, max, unit}
  │     └── createdAt
  ├── sessions/{YYYY-MM-DD}/
  │     ├── date
  │     ├── lastUpdated
  │     └── sessions/{timestamp}/
  │           ├── description
  │           ├── tags/ {tagId: value}
  │           └── imageId (optional)
  └── images/{imageId}/
        ├── id
        ├── type (profile|session)
        ├── base64 (compressed image data)
        ├── createdAt
        ├── size
        ├── sessionTimestamp (for session images)
        └── date (for session images)
```

## 🛠️ Tech Stack

- **React 18** - UI library with hooks
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **Firebase Realtime Database** - Real-time data sync
- **Firebase Authentication** - User management
- **Google Gemini AI** - AI chat assistant
- **Vite PWA Plugin** - Progressive Web App features
- **React Markdown** - Markdown rendering in chat

## � Project Structure

```
Loop/
├── src/
│   ├── components/
│   │   ├── analysis/
│   │   │   ├── Calendar.tsx          # Month calendar view
│   │   │   ├── DayView.tsx           # Grid of session cards
│   │   │   ├── SessionCard.tsx       # Individual session card
│   │   │   ├── DayStatsCard.tsx      # Daily score/stats card
│   │   │   └── Charts.tsx            # Data visualizations
│   │   ├── AddSessionModal.tsx       # Create session modal
│   │   ├── AddSessionView.tsx        # Add Session tab view
│   │   ├── AnalysisTab.tsx           # Analysis tab container
│   │   ├── ChatTab.tsx               # AI chat interface
│   │   ├── Dashboard.tsx             # Main app with navigation
│   │   ├── ImageViewer.tsx           # Full-screen image viewer
│   │   ├── Login.tsx                 # Login/signup page
│   │   └── ProfileTab.tsx            # Profile management
│   ├── contexts/
│   │   └── AuthContext.tsx           # Authentication state
│   ├── firebase/
│   │   └── config.ts                 # Firebase configuration
│   ├── services/
│   │   ├── firebaseService.ts        # Firebase CRUD operations
│   │   ├── dataManager.ts            # Unified data layer
│   │   ├── gemini.ts                 # Gemini AI integration
│   │   └── imageService.ts           # Image compression
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces
│   ├── App.tsx                       # Root component
│   ├── main.tsx                      # Entry point
│   └── index.css                     # Global styles & scrollbars
├── public/                           # Static assets & PWA icons
├── .env                              # Environment variables (gitignored)
├── .env.example                      # Environment template
├── index.html                        # HTML entry point
├── package.json                      # Dependencies
├── tailwind.config.js                # Tailwind & color config
├── tsconfig.json                     # TypeScript configuration
└── vite.config.ts                    # Vite & PWA configuration
```

## 🎯 **Usage Guide**

### 1. **First Time Setup**
- Sign up with email/password or Google
- Go to Profile tab
- Create your first tags (e.g., Mood, Energy, Focus)

### 2. **Logging a Session**
- Click the **+** Floating Action Button
- Describe what you're doing
- Fill in your tag values (optional)
- Session auto-saves as you type!

### 3. **Viewing History**
- Go to Analysis tab
- Calendar shows green dots for days with sessions
- Click any date to view that day's sessions
- See all your logged data with timestamps

### 4. **AI Insights**
- Go to Chat tab
- Ask questions about your habits (e.g., "What patterns do you notice?")
- Get personalized suggestions based on your data
- Use suggested questions for quick insights
- AI analyzes your last 7 days of sessions automatically

## 🔧 **Future Enhancements**

- [x] Gemini AI integration for chat ✅
- [x] Markdown-formatted AI responses ✅
- [x] Context-aware AI using user data ✅
- [ ] Data visualization and charts
- [ ] Weekly/monthly summaries
- [ ] Export data to CSV/JSON
- [ ] Habit streaks and goals
- [ ] Reminders and notifications
- [ ] Data backup and sync
- [ ] Multiple user profiles
- [ ] Tag categories and colors
- [ ] Search and filter sessions

## 📝 **Data Flow**

1. User creates **tags** in Profile (e.g., "Mood", "Energy")
2. User clicks **FAB** to add a session
3. Modal opens with description textarea and tag inputs
4. User fills out form and clicks **Save Session**
5. Data saved to Firestore: `/users/{uid}/logs/{year}/months/{month}/days/{day}`
6. If offline, queued in IndexedDB and synced when connection returns
7. Calendar updates with session indicator
8. Click date to view all sessions for that day

## 🌐 **PWA Features**

- ✅ Installable on mobile and desktop
- ✅ **Full offline support** with IndexedDB
- ✅ **Background sync** when connection returns
- ✅ Fast loading with caching
- ✅ App-like experience
- ✅ Auto-updates

## 📚 **Documentation**

- **[OFFLINE_GUIDE.md](./OFFLINE_GUIDE.md)** - Complete offline functionality guide
- **[OFFLINE_IMPLEMENTATION.md](./OFFLINE_IMPLEMENTATION.md)** - Implementation summary
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data flow diagrams
- **[CHAT_SETUP.md](./CHAT_SETUP.md)** - AI chat setup instructions

## ❓ FAQ: Where do I get the .env values? Is it free?

- Firebase values (VITE_FIREBASE_...)
  - Get them from Firebase Console:
    1) Go to https://console.firebase.google.com
    2) Open your project > Gear icon (Project settings)
    3) General tab > Your apps > Web app > SDK setup and configuration > Config
    4) Copy these fields into your .env:
       - apiKey            -> VITE_FIREBASE_API_KEY
       - authDomain        -> VITE_FIREBASE_AUTH_DOMAIN
       - projectId         -> VITE_FIREBASE_PROJECT_ID
       - storageBucket     -> VITE_FIREBASE_STORAGE_BUCKET
       - messagingSenderId -> VITE_FIREBASE_MESSAGING_SENDER_ID
       - appId             -> VITE_FIREBASE_APP_ID

- Gemini API key (VITE_GEMINI_API_KEY)
  - Get it from Google AI Studio:
    1) Visit https://aistudio.google.com/app/apikey (or https://makersuite.google.com/app/apikey)
    2) Create an API key
    3) Put it in your .env as VITE_GEMINI_API_KEY

Is it free?
- Firebase: You can start on the Spark (Free) plan. It includes generous free quotas for Authentication and Firestore suitable for development and small personal projects. For production apps with higher traffic, you may need to upgrade to a paid plan. See official pricing: https://firebase.google.com/pricing
- Gemini API: Google AI Studio offers a free tier for development with rate limits. It’s typically enough for testing the chat feature locally. For heavier/prod usage you may need to enable billing or use Google Cloud’s Generative AI pricing. See: https://ai.google.dev/pricing

Tip: After creating or changing the .env file, restart the Vite dev server so the new values are picked up.

## 📄 **License**

MIT

## 🤝 **Contributing**

Contributions welcome! Feel free to open issues or submit PRs.

---

Built with ❤️ using React, TypeScript, and Firebase
