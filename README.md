# youtube-video

A full automation toolkit for preparing, processing, and (soon) uploading video files to YouTube—including splitting, batch transcription, subtitle creation, AI-powered video description generation, and (planned) automated YouTube uploads via the YouTube API.

> **Note:** The upload-to-YouTube feature is not yet implemented. All processing and preparation steps are fully functional; actual upload automation will be added in a future release.

## ✨ Features

- **Automated Video Processing Pipeline**
  - End-to-end handling of large video files: splitting, audio extraction, transcoding, AI transcription, and multilingual video description generation.

- **Video Splitting**
  - `split_video_precise.ts`: Precisely splits `.MTS` videos into equal-duration parts for better processing/uploading.
  - `split_video_precise_test.ts`: Ensures the total duration of split parts matches the original via automated test.

- **Video Concatenation**
  - `concat-mts.ts`: Concatenates multiple `.MTS` segments, producing a merged video and validating durations.

- **Batch Transcription**
  - `batchTranscribe.ts`: Batch-converts video segments to `.wav` audio and generates `.srt` subtitles for each, auto-invoking the Python LLM backend.
  - `runTranscribe.ts`: Executes transcription for one file using a Python backend, generating robust `.srt` output.

- **AI-Powered (LLM) Video Description Generation**
  - `generate-description.ts`: Calls OpenCode AI to generate engaging, SEO-optimized YouTube descriptions (EN & DE) from transcripts, handling retries/cleaning.
  - `batchGenerateDescription.ts`: Batch-processes all transcript files and creates dual-language video descriptions for each video part in parallel, with smart skipping and job scheduling.

- **Centralized, Cross-Platform Path Management**
  - `paths.ts`: Provides canonical paths for every batch/script action, ensuring a reproducible, cross-language workflow.

## 🛡️ Code Quality and Best Practices

This project enforces code quality through a combination of automated tools, pre-commit hooks, and continuous integration (CI) checks. These ensure consistent formatting, type safety, and clean codebases.

- **Linting and Formatting**: Powered by [Biome](https://biomejs.dev/) (configured in `biome.json`). Run `bun run check` to lint, format, and fix issues. Biome is integrated into Bun via a wrapper in `flake.nix` for seamless usage.

- **Type Checking**: Uses TypeScript (configured in `tsconfig.json`) for static type safety. Run `bun tsc --noEmit` to check types without emitting files.

- **Unused Code and Dependency Detection**: [Knip](https://knip.dev/) (configured in `knip.jsonc`) identifies unused exports, files, and dependencies. Run `bun run knip` to scan the project.

- **Pre-Commit Hooks**: Managed by [Lefthook](https://github.com/evilmartians/lefthook) (configured in `lefthook.yml`). Automatically runs Biome checks and TypeScript type checks on staged files before commits. Install hooks with `lefthook install` (Lefthook is included in the Nix dev shell).

- **Continuous Integration (CI)**: GitHub Actions (in `.github/workflows/test.yml`) runs all checks on pushes and pull requests:
  - Biome lint/format validation.
  - TypeScript type checks.
  - Knip scans.
  - Unit tests (discovered dynamically via `discover-tests.ts`).
  - The workflow fails if any checks don't pass, ensuring quality before merging.

To contribute, ensure all checks pass locally before pushing. Use the Nix dev shell (`nix develop`) for a consistent environment.

---

## Development Environment Setup

To get started with this project, you'll need a Nix-based development environment. This project uses a Nix flake to provide a reproducible dev shell with all dependencies (Bun, FFmpeg, Python with faster-whisper, etc.). If you're on NixOS or have Nix installed, follow these steps.

### Prerequisites
- **Nix**: Ensure Nix is installed with flakes enabled (add `experimental-features = nix-command flakes` to your `~/.config/nix/nix.conf` or system config).
- **Direnv**: For automatic shell loading. On NixOS, this is enabled via Home Manager (see below). If not using Home Manager, install direnv globally with `nix-env -i direnv` or add it to your shell.
- **Home Manager**: This project assumes you're using Home Manager for user-specific configurations (e.g., enabling direnv). If you're on NixOS, integrate it as shown in your system configuration (e.g., `/etc/nixos/configuration.nix`):
  ```nix
  home-manager = {
    useGlobalPkgs = true;
    useUserPackages = true;
    users.<your-username> = { pkgs, ... }: {
      programs.direnv = {
        enable = true;
        enableBashIntegration = true;  # Or your shell of choice
        nix-direnv.enable = true;  # For flake support
      };
      home.stateVersion = "<your-version>";  # e.g., "25.11"
    };
  };
  ```
  After updating your NixOS config, run `sudo nixos-rebuild switch` to apply changes. This sets up direnv to automatically hook into your shell (e.g., add `eval "$(direnv hook bash)"` to `~/.bashrc` if not auto-configured).

### Entering the Dev Shell
1. Clone the repository:
   ```
   git clone <repo-url>
   cd youtube-video
   ```

2. **With Direnv (Recommended for Auto-Loading)**:
   - Create a `.envrc` file in the project root (if not already present):
     ```
     use flake
     ```
   - Run `direnv allow` to approve it. Direnv will automatically load the Nix dev shell whenever you enter the directory.
   - Verify: Run `echo $SHELL` or check if `bun --version` works without prefixing.

3. **Manual Entry (Without Direnv)**:
   - Enter the dev shell manually:
     ```
     nix develop
     ```
   - This activates the environment with all tools (Bun, FFmpeg, Python packages, etc.).

Once in the dev shell, you can run scripts as described below. If direnv is set up via Home Manager, the shell will load seamlessly on `cd` into the project.

> **Note:** If you encounter issues with direnv not loading, ensure it's hooked into your shell profile (e.g., via Home Manager) and restart your terminal.

## Running Scripts
- Foreground: `bun <filename>.ts`
- Using flake app: `nix run .#bun -- <filename>.ts`

> **Note:** Dependency setup is manual and may vary by OS. Ensure `ffmpeg`, Python, and `opencode` are in your `PATH` and callable from any terminal.

## 🌟 Background Execution with Notification
To run a script in the background and get notified when it finishes (using OpenCode):
- Request to run via "background" with notification on exit, e.g.:
  - "run batchTranscribe.ts using flake in background with notify on exit set to true"

> **Note:**
> This background/notification feature requires the `opencode-pty` plugin for OpenCode. For plugin discovery, installation, and management, see the official documentation: [https://opencode.ai/docs/plugins/](https://opencode.ai/docs/plugins/)
> Ensure `opencode-pty` is installed and enabled in your environment to make PTY/background execution features available.

## 🔤 Subtitle Transcriptions
- Transcription scripts produce SRT subtitle files by default using Python (`faster-whisper` + `pysubs2`).
- All audio/video/split/descriptions directory paths are managed centrally for consistency.
- Outputs are stored in the correct folders with robust error handling.

## 🔧 Troubleshooting
- If you see errors about missing Bun or Python modules, ensure you're inside the dev shell (`nix develop` or via direnv).
- For flake errors, make sure you have the latest Nix and your `flake.nix` provides `apps.bun` and `devShells.default` using shared `runtimeInputs`.
- Foreground run errors: run scripts via `nix run .#bun -- script.ts`.
- For background jobs, monitor notifications or request logs if troubleshooting is needed.
- Direnv issues: Run `direnv status` to debug. Ensure Home Manager has enabled it correctly.

## 📝 Project Initialization
This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

---

For advanced diagnostics or workflow automation, see the centralized `src/paths.ts` config and scripts within `src/` and `python/`.
