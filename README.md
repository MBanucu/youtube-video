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

---

## 🚀 Development Environment (Nix Flake)

This project uses Nix flakes to provide all dependencies (Bun, ffmpeg, Python with `faster-whisper` and `pysubs2`, and the OpenCode CLI) for reproducible cross-platform workflows.

### 🟢 On NixOS
If you want to add the OpenCode CLI system-wide using Nix flakes, you can do so on any NixOS system—no access to a prebuilt `/etc/nixos` is required.

#### 1. Enable Flakes and Nix Command
Add to `/etc/nixos/configuration.nix`:
```nix
nix.settings.experimental-features = [ "nix-command" "flakes" ];
```

#### 2. Add OpenCode as a Flake Input
Create or edit `/etc/nixos/flake.nix` to add OpenCode:
```nix
{
  description = "NixOS system with OpenCode CLI";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    opencode.url = "github:anomalyco/opencode";
  };
  outputs = { self, nixpkgs, opencode, ... }: {
    nixosConfigurations.myhostname = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      specialArgs = { inherit opencode; };
      modules = [ ./configuration.nix ];
    };
  };
}
```
Replace `"myhostname"` with your own system name.

#### 3. Add OpenCode CLI to systemPackages and Import the Input
Edit `/etc/nixos/configuration.nix`:
```nix
{ pkgs, opencode, ... }:
{
  environment.systemPackages = with pkgs; [
    # ... your apps ...
    (opencode.packages.${pkgs.system}.default)
  ];
}
```

#### 4. Apply and Test
```bash
sudo nixos-rebuild switch --flake /etc/nixos
opencode --version  # Should output CLI version if successful
```

**You can now use `opencode` globally, from any user account.**

#### • User-only alternative:
If you don't want to install globally, use:
```bash
nix profile install github:anomalyco/opencode
```

For more: [OpenCode Install Docs](https://opencode.ai)

To enter a dev shell with all tools available:
```bash
nix develop
```

## 🏃‍♂️ Running Scripts (Bun/Flake)

You can run your Bun scripts using the Nix flake app:
```bash
nix run .#bun -- src/batchTranscribe.ts
```
Or any Bun script:
```bash
nix run .#bun -- <filename>.ts
```

This ensures all necessary dependencies (ffmpeg, Python modules, Bun) are available at runtime.

## 🔀 Alternative: Running Without Nix (System Bun)

You can run this project outside Nix if you install all dependencies manually on your system:

- **Bun** (JavaScript/TypeScript runtime): [Official install guide](https://bun.sh/)
  - Quick install: `curl -fsSL https://bun.sh/install | bash` (Linux/macOS)
- **ffmpeg**: Available via your OS package manager
- **Python 3.13+** with these modules:
  - `faster-whisper`
  - `pysubs2`
- **OpenCode CLI**: You must have the `opencode` CLI installed and available in your `PATH` for automated workflows (referenced e.g. in `src/generate-description.ts`). If you do not have it, consult your organization or platform for installation instructions.

Install Python modules with:
```bash
pip install faster-whisper pysubs2
```

After installing dependencies, run scripts directly with Bun:
```bash
bun src/batchTranscribe.ts
```
Or
```bash
bun <filename>.ts
```

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
- If you see errors about missing Bun or Python modules, ensure you're inside the dev shell (`nix develop`).
- For flake errors, make sure you have the latest Nix and your `flake.nix` provides `apps.bun` and `devShells.default` using shared `runtimeInputs`.
- Foreground run errors: run scripts via `nix run .#bun -- script.ts`.
- For background jobs, monitor notifications or request logs if troubleshooting is needed.

## 📝 Project Initialization
This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

---

For advanced diagnostics or workflow automation, see the centralized `src/paths.ts` config and scripts within `src/` and `python/`.
