# How to Deploy Your Blog to GitHub

Follow these steps to host your blog live on GitHub Pages:

## Step 1: Initialize Git and Commit Your Files Locally

Open your terminal (PowerShell, Command Prompt, or Git Bash) in this folder and run:

```bash
# 1. Initialize local Git repository
git init

# 2. Add all files to staging
git add .

# 3. Commit your files
git commit -m "Initial commit - Serendibware Blog"

# 4. Rename main branch
git branch -M main
```

---

## Step 2: Create Repository on GitHub

1. Go to [GitHub.com](https://github.com/) and click **New Repository**.
2. Name it exactly:
   - `CerberusMrXi.github.io` (Recommended: Your blog will be hosted directly at `https://CerberusMrXi.github.io/`)
3. Leave it **Public**.
4. Do **NOT** initialize it with a README, gitignore, or license.
5. Click **Create repository**.

---

## Step 3: Link Local Files to GitHub & Push

Copy the commands shown on your GitHub repository page under "push an existing repository from the command line" and run them in your local terminal:

```bash
# 1. Link your local project to GitHub
git remote add origin https://github.com/CerberusMrXi/CerberusMrXi.github.io.git

# 2. Push to GitHub
git push -u origin main
```

---

## Step 4: Verify GitHub Pages is Live

1. Go to your repository settings page: `https://github.com/CerberusMrXi/CerberusMrXi.github.io/settings`
2. Scroll down to **Pages** in the left sidebar menu.
3. Verify that under **Build and deployment**:
   - **Source** is set to `Deploy from a branch`.
   - **Branch** is set to `main` and folder `/ (root)`.
4. Click **Save** if it was not already configured.
5. In a few minutes, your site will be live at `https://CerberusMrXi.github.io/`.
