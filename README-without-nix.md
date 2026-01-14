# YouTube Video Automation - Without Nix

This guide explains how to set up and use the YouTube video automation workspace on systems without Nix. This includes manual installation of dependencies and running scripts directly with Bun.

## Prerequisites

Before getting started, ensure you have the following installed on your system:

### 1. Bun (JavaScript/TypeScript Runtime)
Bun is the primary runtime for this project.

- **Installation**:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
  - Follow the on-screen instructions to add Bun to your PATH.
  - Verify: `bun --version` (should show v1.3.5 or later)

- **Why Bun?** It's fast, includes a bundler, test runner, and package manager—all in one tool.

### 2. FFmpeg
FFmpeg is used for video/audio processing (splitting, concatenation, extraction).

- **Installation**:
  - **Ubuntu/Debian**: `sudo apt install ffmpeg`
  - **macOS**: `brew install ffmpeg`
  - **Windows**: Download from [FFmpeg official site](https://ffmpeg.org/download.html) and add to PATH
  - **Other Linux**: Use your package manager (e.g., `dnf install ffmpeg` on Fedora)

- **Verify**: `ffmpeg -version`

### 3. Python 3.13+
Python is required for AI transcription using faster-whisper.

- **Installation**:
  - Download from [python.org](https://www.python.org/downloads/) or use your OS package manager.
  - Ensure Python 3.13 or higher.

- **Required Packages**:
  ```bash
  pip install faster-whisper pysubs2
  ```

- **Verify**: `python3 --version` and `python3 -c "import faster_whisper; print('OK')"`

### 4. OpenCode CLI
OpenCode is used for AI-powered video description generation.

- **Installation**: Follow the official docs at [opencode.ai/install](https://opencode.ai/install).
  - For most users: `curl -fsSL https://opencode.ai/install | bash`
  - Ensure it's in your PATH.

- **Verify**: `opencode --version`

### 5. Git
For cloning the repository.

- **Installation**: `sudo apt install git` (Ubuntu) or equivalent.
- **Verify**: `git --version`

## Setup

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd youtube-video
   ```

2. **Install Dependencies**:
   ```bash
   bun install
   ```
   This installs all Node.js/TypeScript dependencies listed in `package.json`.

3. **Verify Setup**:
   Run a quick test to ensure everything works:
   ```bash
   bun --version
   ffmpeg -version
   python3 -c "import faster_whisper, pysubs2; print('Python OK')"
   opencode --version
   ```

## Running Scripts

Once set up, you can run the automation scripts directly with Bun:

### Foreground Execution
```bash
bun src/batchTranscribe.ts
bun src/split_video_precise.ts
bun src/concat-mts.ts
bun src/generate-description.ts
bun src/batchGenerateDescription.ts
```

### Background Execution with Notifications
For long-running tasks, use OpenCode to run in background with notifications:
- Example: Request "run batchTranscribe.ts in background with notify on exit set to true"
- Requires the `opencode-pty` plugin (see [OpenCode plugins](https://opencode.ai/docs/plugins/))

## Code Quality Tools

The project includes automated tools for code quality:

- **Linting/Formatting**: `bun run check` (uses Biome)
- **Type Checking**: `bun tsc --noEmit`
- **Unused Code Check**: `bun run knip`

Run these locally before committing to ensure quality.

## Project Structure

- `src/`: Main TypeScript scripts for video processing
- `test/`: Unit tests (run with `bun test`)
- `python/`: Any Python-specific utilities
- `.github/workflows/`: CI configuration (GitHub Actions)

## Troubleshooting

### Common Issues
- **Bun not found**: Ensure Bun is in your PATH after installation.
- **FFmpeg errors**: Verify FFmpeg is installed and in PATH.
- **Python import errors**: Ensure `faster-whisper` and `pysubs2` are installed via pip.
- **OpenCode not found**: Ensure the CLI is installed and in PATH.
- **Permission errors**: Make scripts executable if needed (`chmod +x src/*.ts`).

### Performance Notes
- Video processing can be CPU/GPU intensive—ensure your system has adequate resources.
- For large videos, processing may take time; monitor with `top` or Task Manager.

### Getting Help
- Check the main README.md for feature overviews.
- Open issues on GitHub for bugs or feature requests.
- Consult OpenCode documentation for AI-related features.

---

This setup provides the full functionality of the YouTube video automation toolkit without requiring Nix. For the most reproducible experience, consider using Nix if possible.