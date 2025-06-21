# 🤖 A1 Evo Acoustica Release Workflows Guide

## **📋 Overview**

Your repository has **two smart release workflows** that automatically handle versioning, building executables, and creating GitHub releases. Here's how they work:

---

## **🔄 Automatic Release Workflow**

### **What It Does:**

- **Triggers automatically** when you push code changes to important files
- **Detects version numbers** in your commit messages (like "v8" or "v8.5")
- **Builds executables** for all platforms (Linux, macOS, Windows)
- **Creates GitHub releases** with smart release notes
- **Updates version numbers** in all your code files

### **How to Use It:**

#### **For Major Releases (like v8, v9):**

1. **Make your changes** locally and commit with a message like:

   ```text
   A1 Evo Acoustica v8

   - Added double bass mode
   - Improved measurements
   - Fixed bugs
   ```

2. **Push to GitHub** using Git - the workflow automatically:
   - Creates version `8.0`
   - Marks it as "latest release"
   - Builds all executables
   - Generates release notes

   **Or if you're uploading directly to GitHub:**

   1. **Upload your files** via GitHub's web interface
   2. **Use this commit message** format in the commit box:

      ```text
      A1 Evo Acoustica v8

      - Added double bass mode
      - Improved measurements
      - Fixed bugs
      ```

   3. **Click "Commit changes"** - same automatic process happens!

#### **For Silent Updates:**

1. **Make small changes** and commit normally with messages like:

   ```text
   Add files via upload
   ```

   or

   ```text
   Fix minor bug
   ```

2. **Push to GitHub** or **upload via web interface** - the workflow automatically:
   - Increments patch version (8.0 → 8.0.1 → 8.0.2)
   - Creates release but doesn't mark as "latest"

### **Skip Auto-Release:**

Add `[skip-release]` to your commit message to prevent automatic releases.

---

## **🎯 Manual Release Workflow**

### **Manual Workflow Features:**

- **Full control** over version numbers and release settings
- **Custom release notes** with markdown support
- **Platform selection** (build only what you need)
- **Dry run mode** to test before releasing
- **Smart auto-increment** when changes are detected

### **Manual Workflow Usage:**

1. **Go to GitHub Actions:**
   - Visit your repository on GitHub
   - Click **"Actions"** tab
   - Find **"Manual Release with Custom Version"**
   - Click **"Run workflow"**

2. **Fill in the form:**

   ```text
   Version: 8.1              (or 8, or 8.1.5)
   Release Type: major       (major/minor/patch/hotfix)
   Release Notes: (optional) Custom description
   Mark as Latest: ✓         (yes/no)
   Platforms: all            (or specific platforms)
   Pre-release: ✗            (for testing versions)
   Dry Run: ✗                (test without releasing)
   ```

3. **Click "Run workflow"** - it will:
   - Validate your inputs
   - Show you exactly what it will create
   - Build and release according to your settings

### **Smart Auto-Increment Examples:**

- **Current: 8.1, Input: 8.1, Changes detected** → Creates `8.1.1`
- **Current: 8.1, Input: 8, Changes detected** → Creates `8.1.1`
- **Current: 8.1, Input: 9, Changes detected** → Creates `9.0`

---

## **📊 Version Strategy**

### **Version Format:**

- **X.Y** = Major/minor releases (marked as "latest")
- **X.Y.Z** = Silent updates/patches (third digit)

### **Examples:**

```text
8.0     ← Major release (from "v8" in commit)
8.0.1   ← Silent update
8.0.2   ← Another silent update
8.1     ← Minor release (from "v8.1" in commit)
9.0     ← Next major release
```

---

## **🚀 Quick Start Guide**

### **For Regular Updates (Recommended - Git Push):**

1. **Edit your files** locally (A1Evo.html, main.js, etc.)
2. **Commit with version** in message: `"A1 Evo Acoustica v8"`
3. **Push to GitHub** - automatic release happens!

### **For Regular Updates (Alternative - Web Upload):**

1. **Go to your GitHub repository**
2. **Upload/edit files** via web interface
3. **Use commit message**: `"A1 Evo Acoustica v8"` in the commit box
4. **Click "Commit changes"** - automatic release happens!

### **For Small Fixes (Recommended - Git Push):**

1. **Edit your files** locally
2. **Commit normally**: `"Fix bug"` or `"Add files via upload"`
3. **Push to GitHub** - patch release happens automatically

### **For Small Fixes (Alternative - Web Upload):**

1. **Upload/edit files** via GitHub web interface
2. **Use simple commit message**: `"Add files via upload"`
3. **Click "Commit changes"** - patch release happens automatically

### **For Special Releases:**

1. **Use manual workflow** from GitHub Actions
2. **Set custom version and options**
3. **Add custom release notes**
4. **Choose platforms to build**

---

## **💡 Pro Tips**

- **Always check the Actions tab** after pushing/uploading to see workflow progress
- **Use dry run** in manual workflow to test before releasing
- **Version detection works** with: "v8", "v8.5", "A1 Evo Acoustica v8"
- **Skip releases** by adding `[skip-release]` to commit messages
- **Major versions** (X.Y) are marked as "latest" on GitHub
- **Patch versions** (X.Y.Z) are for silent updates
- **Git push is recommended** for better version control and history
- **Web upload works great** for quick fixes when you don't have Git setup

The workflows handle all the technical details - you just focus on your code and version numbers! 🎉