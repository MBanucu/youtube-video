{
  description = "Dev shell for bun + ffmpeg + faster-whisper transcription";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        pythonPackages = ps: with ps; [ faster-whisper ];
        pythonEnv = pkgs.python313.withPackages pythonPackages;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.bun
            pkgs.ffmpeg
            pythonEnv
          ];
          shellHook = ''
            echo "Bun, ffmpeg, and Python+faster-whisper available!"
            bun --version
            ffmpeg -version
            python3 --version
            python3 -c "import faster_whisper; print('faster-whisper is ready!')"
          '';
        };
      }
    );
}
