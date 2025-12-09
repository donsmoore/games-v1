# Deployment Guide for AWS EC2

**Target Directory**: `/var/www/html/donsmoore.com/games/v1/`
**Current Location**: You are here.

## 1. Fix Permissions
Since you are logged in as `ubuntu`, ensure you own this folder to avoid permission errors.

```bash
# Go up one level to set permissions on the v1 folder itself
cd ..

# Set ownership of the 'v1' directory and everything inside it to 'ubuntu'
sudo chown -R ubuntu:ubuntu v1

# Go back into the folder
cd v1
```

## 2. Deploy Code
Now that you have permission, pull the code from GitHub.

### Scenario A: Folder is Empty (First Run)
```bash
# Clone the repository content into the current directory
git clone git@github.com:donsmoore/games-v1.git .
```

### Scenario B: Folder has Files (Update)
```bash
# Initialize git if needed
git init

# Link to the repository
git remote add origin git@github.com:donsmoore/games-v1.git || git remote set-url origin git@github.com:donsmoore/games-v1.git

# Force pull the latest version
git fetch origin
git reset --hard origin/main
```

## 3. Done!
The latest version of the game is now deployed.
