# Firebase Storage Setup Guide

## ✅ What You Have Now

Complete Firebase Storage implementation for both **Unity** and **JavaScript** clients!

---

## 🚀 Quick Setup Steps

### 1️⃣ Enable Anonymous Authentication

Since both Unity and JS need to upload/download without user accounts:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **catfished-759e1**
3. Navigate to: **Build → Authentication → Get Started**
4. Click **Sign-in method** tab
5. Enable **Anonymous** authentication
6. Click **Save**

✅ This allows players to connect securely without accounts.

---

### 2️⃣ Create Storage Bucket

1. In Firebase Console: **Build → Storage → Get Started**
2. Choose **Production mode** (we'll use our custom rules)
3. Choose location closest to your users (or leave default)
4. Click **Create**

Your bucket will be: `gs://catfished-759e1.firebasestorage.app`

---

### 3️⃣ Deploy Security Rules

Copy the rules from `storage.rules` to Firebase:

1. In Firebase Console: **Build → Storage → Rules** tab
2. Replace everything with the contents of `storage.rules`
3. Click **Publish**

Or deploy via CLI:
```bash
firebase deploy --only storage
```

---

### 4️⃣ Import Firebase Storage SDK to Unity

1. Download the latest [Firebase Unity SDK](https://firebase.google.com/download/unity)
2. In Unity: **Assets → Import Package → Custom Package**
3. Import: **FirebaseStorage.unitypackage**
4. Wait for import to complete

Your existing `google-services.json` will automatically work with Storage!

---

## 📁 Files Created

### JavaScript (Web Client)
- ✅ `lib/firebase.ts` - Added Storage + Auth initialization
- ✅ `app/components/DrawingCanvas.tsx` - Uploads to Storage
- ✅ `app/components/ProfilePage.tsx` - Updated to use URLs
- ✅ `app/page.tsx` - Stores Storage URLs in Firestore

### Unity (Host)
- ✅ `Assets/Scripts/StorageManager.cs` - Downloads images from Storage
- ✅ `Assets/Scripts/ProfileViewer.cs` - Example profile viewer
- ✅ `Assets/Scripts/GameManager.cs` - Updated with Storage support

---

## 🎮 How It Works

### Upload Flow (JavaScript)
```
Player draws → Canvas.toDataURL() → Upload to Storage → Get URL → Store URL in Firestore
```

### Download Flow (Unity)
```
Read Firestore profile → Get imageUrl → Download from Storage → Convert to Texture2D → Display
```

---

## 🔥 Storage Structure

```
gs://catfished-759e1.firebasestorage.app/
└── drawings/
    ├── ABCD/              (room code)
    │   ├── John.png       (player drawings)
    │   ├── Sarah.png
    │   └── Mike.png
    └── EFGH/
        ├── Alice.png
        └── Bob.png
```

---

## 🔐 Security Rules Explained

```javascript
// Players can upload their own drawings
allow write: if request.auth != null 
          && request.resource.size < 5 * 1024 * 1024  // Max 5MB
          && request.resource.contentType.matches('image/.*');

// Anyone authenticated can read (so Unity can display)
allow read: if request.auth != null;
```

---

## 💰 Spark Plan Limits

Firebase Storage on **FREE tier**:
- ✅ **5 GB** storage (10x more than Firestore)
- ✅ **1 GB/day** downloads
- ✅ **20,000/day** upload operations

**Estimate:**
- Average drawing: 100 KB
- 50,000 drawings = 5 GB
- 10,000 image views/day = 1 GB bandwidth
- **You're good for thousands of games per day!**

---

## 🧪 Testing

### Test JavaScript Upload
```javascript
import { ensureAuth } from '../lib/firebase';

// This happens automatically when DrawingCanvas saves
await ensureAuth();
console.log('Authenticated!', auth.currentUser.uid);
```

### Test Unity Download
```csharp
// In your Unity script:
string imageUrl = "YOUR_STORAGE_URL_FROM_FIRESTORE";
Texture2D drawing = await StorageManager.DownloadImageFromUrlAsync(imageUrl);
rawImage.texture = drawing;
```

---

## 🐛 Troubleshooting

### "Permission Denied" Error
- ✅ Check Anonymous Auth is enabled
- ✅ Check Storage Rules are published
- ✅ Verify `ensureAuth()` is called before upload

### Unity Can't Download
- ✅ Import FirebaseStorage.unitypackage
- ✅ Check `google-services.json` is in StreamingAssets
- ✅ Verify Storage Rules allow read

### Images Not Appearing
- ✅ Check Firebase Console → Storage to see uploaded files
- ✅ Verify Firestore has `imageUrl` field (not `imageData`)
- ✅ Check browser/Unity console for errors

---

## 📊 Monitoring Usage

**Firebase Console:**
- Build → Storage → Usage tab
- View storage used and bandwidth

**Enable Budget Alerts:**
- Google Cloud Console → Billing → Budgets & alerts
- Set alert at 80% of free tier limits

---

## ✨ Benefits Over Base64 in Firestore

| Feature | Base64 in Firestore | Firebase Storage |
|---------|-------------------|------------------|
| Max size | 1 MB per doc | 5 GB total |
| Efficiency | +33% overhead | Optimized |
| Cost | $$ per read/write | ¢ per GB |
| Cleanup | Manual | Auto with TTL |
| CDN | ❌ | ✅ |

---

## 🎯 Next Steps

1. ✅ Enable Anonymous Auth
2. ✅ Create Storage bucket
3. ✅ Deploy storage.rules
4. ✅ Import FirebaseStorage.unitypackage in Unity
5. ✅ Test uploading a drawing from JS
6. ✅ Test downloading in Unity
7. 🎨 Build your profile display UI!

---

**You're all set!** Both Unity and JS can now share images through Firebase Storage. 🚀

